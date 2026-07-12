package middleware

import (
	"context"
	"sync"

	"golang.org/x/time/rate"
)

// burstMultiplier allows a short burst above the steady-state rate —
// without this, a limiter configured for exactly N/minute rejects any
// request that arrives faster than one every (60/N) seconds, even if the
// tenant has been well under their budget for the preceding minute. A
// small burst allowance is the standard token-bucket fix.
const burstMultiplier = 2

// InMemoryRateLimiter implements RateLimiter with an in-process token
// bucket per tenant ID. Used for local dev and in-memory-backends mode
// (config.UseInMemoryBackends) — see the SCALING NOTE on RedisRateLimiter
// for why this is NOT suitable once this service runs more than one
// replica.
type InMemoryRateLimiter struct {
	mu       sync.Mutex
	limiters map[string]*rate.Limiter
}

func NewInMemoryRateLimiter() *InMemoryRateLimiter {
	return &InMemoryRateLimiter{limiters: make(map[string]*rate.Limiter)}
}

func (rl *InMemoryRateLimiter) Allow(_ context.Context, tenantID string, limitPerMinute int) bool {
	return rl.limiterFor(tenantID, limitPerMinute).Allow()
}

func (rl *InMemoryRateLimiter) limiterFor(tenantID string, limitPerMinute int) *rate.Limiter {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	if l, ok := rl.limiters[tenantID]; ok {
		return l
	}

	// rate.Limit is expressed in events/second; Doc-02 Section 10 specifies
	// requests/minute, hence the /60.0.
	limiter := rate.NewLimiter(rate.Limit(float64(limitPerMinute)/60.0), limitPerMinute*burstMultiplier)
	rl.limiters[tenantID] = limiter
	return limiter
}
