// Per-tenant rate limiting — implements Doc-02 Section 10:
//
//	Standard tenant           60 requests/minute
//	High-traffic tenant      300 requests/minute (opt-in via display_config)
//
// Two RateLimiter implementations exist: InMemoryRateLimiter (Phase 3
// original, still used for local dev / in-memory-backends mode) and
// RedisRateLimiter (below, closes the distributed-correctness gap the
// in-memory version documented from the start). main.go picks one based on
// config.UseInMemoryBackends, mirroring how it picks Store/Cache/
// ArticleSource implementations.
//
// PHASE 4 TODO for OpenHands: Doc-02 Section 10 also describes a lower,
// bursty allowance for "Build-time (Actions runner)" callers (10 rpm) —
// this middleware does not yet distinguish that caller type from a normal
// client-side widget request, since both hit the same endpoint with the
// same tenant API key and the spec doesn't define a signal to tell them
// apart (a dedicated header, e.g. `X-Besbpo-Caller: github-actions`, would
// be the natural fix — add it to the OpenAPI spec and the subsidiary site
// template's rebuild workflow together). Until then, every caller for a
// given tenant shares that tenant's single (standard or high-traffic) rate
// limit tier.
package middleware

import (
	"context"
	"net"
	"net/http"
	"strings"
)

const (
	standardRateLimitPerMinute    = 60
	highTrafficRateLimitPerMinute = 300
)

// RateLimiter decides whether a request for a given tenant should proceed.
// Implementations MUST fail open (return true) on any internal error (e.g.
// Redis unreachable) rather than fail closed — a rate limiter should
// protect against abuse, not become a new single point of failure that
// blocks all traffic if its backing store hiccups.
type RateLimiter interface {
	Allow(ctx context.Context, tenantID string, limitPerMinute int) bool
}

// RequireRateLimit must run AFTER RequireTenantAuth in the middleware
// chain — it reads the resolved tenant from the request context (via
// TenantFromContext) to decide which rate-limit tier applies, so it can't
// be the first check in the chain.
func RequireRateLimit(limiter RateLimiter) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			t, ok := TenantFromContext(r.Context())
			if !ok {
				// Should be unreachable if this middleware is wired after
				// RequireTenantAuth as documented above, but fail closed
				// (reject) rather than silently skipping rate limiting if
				// the chain is ever misconfigured.
				http.Error(w, `{"error":"rate limiter requires an authenticated tenant"}`, http.StatusInternalServerError)
				return
			}

			limitPerMinute := standardRateLimitPerMinute
			if t.DisplayConfig.HighTraffic {
				limitPerMinute = highTrafficRateLimitPerMinute
			}

			if !limiter.Allow(r.Context(), t.ID, limitPerMinute) {
				w.Header().Set("Retry-After", "60")
				http.Error(w, `{"error":"rate limit exceeded"}`, http.StatusTooManyRequests)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RequireIPRateLimit rate-limits by client IP rather than by an
// authenticated tenant — for endpoints like the analytics beacon, which
// are deliberately unauthenticated (see analytics.BeaconHandler's doc
// comment for why: a secret can't safely live in a script served to
// browsers) and so have no TenantFromContext to key on. Reuses the same
// RateLimiter interface/implementations as RequireRateLimit (just keyed
// on an IP-derived string instead of a tenant ID) rather than building a
// second rate-limiting mechanism from scratch.
//
// Closes a gap flagged since Phase 8: the beacon endpoint previously had
// no rate limiting at all, documented at the time as needing exactly
// this before carrying real production traffic at scale.
func RequireIPRateLimit(limiter RateLimiter, limitPerMinute int) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := "ip:" + clientIP(r)
			if !limiter.Allow(r.Context(), key, limitPerMinute) {
				w.Header().Set("Retry-After", "60")
				http.Error(w, `{"error":"rate limit exceeded"}`, http.StatusTooManyRequests)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// clientIP extracts the client's IP address, preferring the first entry
// in X-Forwarded-For (set by a reverse proxy/load balancer in front of
// this service — see Doc-04 Section 4's Coolify deployment topology) and
// falling back to RemoteAddr for direct connections (e.g. local dev,
// or any deployment without a proxy in front).
//
// TRUST CAVEAT: X-Forwarded-For is trivially spoofable by any client that
// talks to this service directly rather than through the proxy — fine
// for a rate limiter (worst case, a bad actor's forged IP just gets its
// own separate bucket rather than sharing the real one, which if
// anything makes the limiter MORE generous to them, not less), but this
// header must NEVER be trusted for actual security/authorization
// decisions without a proxy that strips or overwrites client-supplied
// values before forwarding — not a concern here since this function is
// only ever used for rate-limiting, never for auth.
func clientIP(r *http.Request) string {
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		firstHop, _, _ := strings.Cut(forwarded, ",")
		if trimmed := strings.TrimSpace(firstHop); trimmed != "" {
			return trimmed
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		// RemoteAddr didn't have a port to split off (unusual, but not
		// worth failing the request over) — use it as-is.
		return r.RemoteAddr
	}
	return host
}
