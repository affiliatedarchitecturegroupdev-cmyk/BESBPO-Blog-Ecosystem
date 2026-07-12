package middleware

import (
	"context"
	"testing"
)

func TestInMemoryRateLimiter_ReturnsSameInstanceForSameTenant(t *testing.T) {
	rl := NewInMemoryRateLimiter()
	l1 := rl.limiterFor("tenant-1", standardRateLimitPerMinute)
	l2 := rl.limiterFor("tenant-1", standardRateLimitPerMinute)
	if l1 != l2 {
		t.Fatal("expected the same *rate.Limiter instance to be reused for the same tenant ID")
	}
}

func TestInMemoryRateLimiter_DifferentTenantsGetDifferentInstances(t *testing.T) {
	rl := NewInMemoryRateLimiter()
	l1 := rl.limiterFor("tenant-1", standardRateLimitPerMinute)
	l2 := rl.limiterFor("tenant-2", standardRateLimitPerMinute)
	if l1 == l2 {
		t.Fatal("expected different tenants to get different *rate.Limiter instances")
	}
}

func TestInMemoryRateLimiter_HighTrafficTenantGetsAHigherConfiguredRate(t *testing.T) {
	rl := NewInMemoryRateLimiter()
	standard := rl.limiterFor("tenant-standard", standardRateLimitPerMinute)
	highTraffic := rl.limiterFor("tenant-high-traffic", highTrafficRateLimitPerMinute)

	if !(highTraffic.Limit() > standard.Limit()) {
		t.Fatalf("expected high-traffic limit (%v) to exceed standard limit (%v)", highTraffic.Limit(), standard.Limit())
	}
}

func TestInMemoryRateLimiter_Allow_PermitsBurstThenRejects(t *testing.T) {
	rl := NewInMemoryRateLimiter()
	ctx := context.Background()

	// A fresh token-bucket limiter starts full (burst tokens available
	// immediately), so exhaustion can be tested without waiting on real
	// elapsed time for a refill.
	burst := standardRateLimitPerMinute * burstMultiplier
	for i := 0; i < burst; i++ {
		if !rl.Allow(ctx, "tenant-1", standardRateLimitPerMinute) {
			t.Fatalf("expected request %d of %d (within burst) to be allowed", i+1, burst)
		}
	}
	if rl.Allow(ctx, "tenant-1", standardRateLimitPerMinute) {
		t.Fatal("expected the request immediately after exhausting the burst to be rejected")
	}
}
