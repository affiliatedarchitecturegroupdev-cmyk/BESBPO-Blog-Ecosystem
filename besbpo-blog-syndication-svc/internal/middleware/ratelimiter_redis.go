// Redis-backed RateLimiter — closes the distributed-correctness gap
// documented on InMemoryRateLimiter: with that implementation, running
// more than one replica of this service means each replica enforces its
// own independent limit, so the real aggregate ceiling for a tenant
// becomes (configured limit × replica count) instead of the configured
// limit. This implementation stores counts in Redis, shared across every
// replica, so the limit means what it says regardless of how many
// instances are running.
//
// ALGORITHM CHOICE: fixed-window counting (INCR + EXPIRE on a key scoped
// to the tenant AND the current 60-second window), not a token bucket.
// A correct distributed token bucket needs an atomic read-modify-write
// (typically a Lua script) to avoid a race between reading the current
// token count and writing the decremented value back; a fixed-window
// counter gets atomicity for free from Redis's INCR alone. The trade-off,
// and it's worth knowing about: a client can send up to `limit` requests
// right at the end of one window and another `limit` right at the start
// of the next, briefly achieving close to 2x the configured rate around
// window boundaries. That's an accepted, well-known property of fixed-window
// limiting — reach for a sliding-window-log or a Lua-scripted token bucket
// instead if that boundary burst is a real problem for a given deployment.
package middleware

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

type RedisRateLimiter struct {
	client    *redis.Client
	keyPrefix string
}

func NewRedisRateLimiter(client *redis.Client) *RedisRateLimiter {
	return &RedisRateLimiter{client: client, keyPrefix: "syndication:ratelimit:"}
}

// Allow increments this tenant's counter for the current 60-second window
// and reports whether it's still within limitPerMinute. Fails open (allows
// the request) on any Redis error — see the RateLimiter interface doc for
// why that's the deliberate choice rather than failing closed.
func (rl *RedisRateLimiter) Allow(ctx context.Context, tenantID string, limitPerMinute int) bool {
	key := rateLimitKey(rl.keyPrefix, tenantID, currentWindow())

	count, err := rl.client.Incr(ctx, key).Result()
	if err != nil {
		log.Printf("redis rate limiter error for tenant %s: %v — failing open (allowing request)", tenantID, err)
		return true
	}

	if count == 1 {
		// Only set the expiry on the first increment in this window, so a
		// steady stream of requests within the window doesn't keep pushing
		// the TTL back out. A short-lived key that outlives its window by
		// a few seconds is harmless; a key that never expires because it's
		// constantly refreshed is a slow memory leak in Redis.
		if err := rl.client.Expire(ctx, key, time.Minute).Err(); err != nil {
			log.Printf("redis rate limiter: failed to set expiry for key %q: %v", key, err)
		}
	}

	return count <= int64(limitPerMinute)
}

// currentWindow returns the current fixed 60-second window number (Unix
// seconds / 60). Extracted so rateLimitKey's per-window scoping can be
// tested deterministically without needing a real clock tick between
// assertions.
func currentWindow() int64 {
	return time.Now().Unix() / 60
}

// rateLimitKey builds the Redis key for a tenant's counter in a given
// window. Pure and deterministic — no Redis connection needed to test it.
func rateLimitKey(prefix string, tenantID string, window int64) string {
	return fmt.Sprintf("%s%s:%d", prefix, tenantID, window)
}
