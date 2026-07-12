package middleware

import "testing"

func TestRateLimitKey_IsScopedByTenantAndWindow(t *testing.T) {
	k1 := rateLimitKey("prefix:", "tenant-1", 1000)
	k2 := rateLimitKey("prefix:", "tenant-2", 1000)
	k3 := rateLimitKey("prefix:", "tenant-1", 1001)

	if k1 == k2 {
		t.Fatal("expected different tenants to produce different keys for the same window")
	}
	if k1 == k3 {
		t.Fatal("expected the same tenant in different windows to produce different keys")
	}
}

func TestRateLimitKey_IsDeterministic(t *testing.T) {
	k1 := rateLimitKey("prefix:", "tenant-1", 1000)
	k2 := rateLimitKey("prefix:", "tenant-1", 1000)
	if k1 != k2 {
		t.Fatalf("expected identical inputs to produce identical keys, got %q and %q", k1, k2)
	}
}

func TestRateLimitKey_IncludesThePrefix(t *testing.T) {
	k := rateLimitKey("syndication:ratelimit:", "tenant-1", 1000)
	want := "syndication:ratelimit:tenant-1:1000"
	if k != want {
		t.Fatalf("expected key %q, got %q", want, k)
	}
}

func TestCurrentWindow_ReturnsAPlausiblePositiveValue(t *testing.T) {
	// Not a real clock-dependent test (that would be slow/flaky) — just a
	// sanity check that the window number is a plausible, positive value
	// at 60-second granularity.
	w := currentWindow()
	if w <= 0 {
		t.Fatalf("expected a positive window number, got %d", w)
	}
}
