//! A minimal in-process, in-memory rate limiter — fixed-window, keyed by
//! client IP.
//!
//! DESIGN DECISION, stated plainly rather than left implicit: this
//! service's `/api/v1/search` endpoint has had zero protection of any
//! kind since it was written. The fix here is deliberately rate limiting,
//! NOT authentication — the sync job only ever indexes `status='published'`
//! articles (see db.rs), which is exactly the same content already
//! publicly readable on the actual blog. There is no additional
//! information-disclosure risk from anonymous search access, since anyone
//! can already read this same content directly; a public search bar
//! needing no login is the normal shape for this kind of feature, not an
//! oversight. What a public, unauthenticated endpoint genuinely needs is
//! protection against abuse/DoS, which is what this actually is. Contrast
//! with besbpo-blog-syndication-svc's feed endpoint, which IS
//! tenant-authenticated — but that's because it's scoped to a specific
//! tenant's subscription (division filtering, tracking implications), not
//! because the underlying published content is sensitive.
//!
//! No Redis/external dependency — matching this service's Phase 0 "zero
//! external dependencies" constraint (see http.rs's header comment).
//! besbpo-blog-syndication-svc's Go rate limiter needs Redis specifically
//! to coordinate limits across multiple replicas; this service is a
//! single process today, so it doesn't have that coordination problem
//! yet. Revisit if this is ever deployed with more than one replica
//! behind a load balancer, since each replica would then enforce its own
//! independent limit rather than a shared one.
//!
//! KNOWN LIMITATION, not glossed over: the underlying map grows by one
//! entry per unique IP ever seen and nothing ever removes an entry. Fine
//! for a while; a real production deployment would want either a
//! periodic sweep of stale entries or an LRU-bounded cache instead of an
//! unbounded HashMap. Not attempted here — a genuine next-step item, not
//! a silent gap.

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

pub struct RateLimiter {
    window: Duration,
    limit: u32,
    // Maps a key (client IP) to (window_start, count_in_window).
    state: Mutex<HashMap<String, (Instant, u32)>>,
}

impl RateLimiter {
    pub fn new(limit: u32, window: Duration) -> Self {
        RateLimiter {
            window,
            limit,
            state: Mutex::new(HashMap::new()),
        }
    }

    /// Returns true if the request identified by `key` is allowed under
    /// the current window. Always increments the count either way (an
    /// over-limit request still counts against the window) — a client
    /// hammering past the limit doesn't get a "free" reset by continuing
    /// to try.
    ///
    /// Recovers from a poisoned mutex (a previous panic while holding the
    /// lock) rather than propagating the panic — this is rate-limiting
    /// state, not data whose correctness the rest of the service depends
    /// on, so continuing with whatever was in the map at the time of the
    /// panic is the right tradeoff over taking the whole server down.
    pub fn allow(&self, key: &str) -> bool {
        let mut state = self
            .state
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let now = Instant::now();
        let entry = state.entry(key.to_string()).or_insert((now, 0));

        if now.duration_since(entry.0) >= self.window {
            *entry = (now, 1);
            return true;
        }

        entry.1 += 1;
        entry.1 <= self.limit
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread::sleep;

    #[test]
    fn allows_requests_under_the_limit() {
        let limiter = RateLimiter::new(3, Duration::from_secs(60));
        assert!(limiter.allow("1.2.3.4"));
        assert!(limiter.allow("1.2.3.4"));
        assert!(limiter.allow("1.2.3.4"));
    }

    #[test]
    fn rejects_the_request_that_exceeds_the_limit() {
        let limiter = RateLimiter::new(3, Duration::from_secs(60));
        assert!(limiter.allow("1.2.3.4"));
        assert!(limiter.allow("1.2.3.4"));
        assert!(limiter.allow("1.2.3.4"));
        assert!(!limiter.allow("1.2.3.4")); // 4th request in the window
    }

    #[test]
    fn continues_rejecting_further_requests_past_the_limit_in_the_same_window() {
        // Confirms an over-limit client doesn't get a "free" reset just
        // by continuing to retry within the same window.
        let limiter = RateLimiter::new(1, Duration::from_secs(60));
        assert!(limiter.allow("1.2.3.4"));
        assert!(!limiter.allow("1.2.3.4"));
        assert!(!limiter.allow("1.2.3.4"));
        assert!(!limiter.allow("1.2.3.4"));
    }

    #[test]
    fn tracks_different_keys_independently() {
        let limiter = RateLimiter::new(1, Duration::from_secs(60));
        assert!(limiter.allow("1.2.3.4"));
        assert!(!limiter.allow("1.2.3.4"));
        // A different IP has its own, entirely separate budget.
        assert!(limiter.allow("5.6.7.8"));
    }

    #[test]
    fn allows_requests_again_once_the_window_has_elapsed() {
        let limiter = RateLimiter::new(1, Duration::from_millis(50));
        assert!(limiter.allow("1.2.3.4"));
        assert!(!limiter.allow("1.2.3.4"));
        sleep(Duration::from_millis(60));
        assert!(limiter.allow("1.2.3.4"));
    }

    #[test]
    fn resets_the_count_to_one_on_a_fresh_window_not_zero() {
        // The request that OPENS the new window must itself count against
        // it — otherwise a client could get one extra "free" request at
        // every window boundary indefinitely.
        let limiter = RateLimiter::new(1, Duration::from_millis(50));
        assert!(limiter.allow("1.2.3.4"));
        sleep(Duration::from_millis(60));
        assert!(limiter.allow("1.2.3.4")); // opens a new window, counts as 1
        assert!(!limiter.allow("1.2.3.4")); // still over the limit=1 for this new window
    }
}
