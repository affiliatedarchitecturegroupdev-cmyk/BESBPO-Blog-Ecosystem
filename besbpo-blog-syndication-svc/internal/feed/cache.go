package feed

import (
	"context"
	"sync"
	"time"
)

// Cache is the boundary to the response cache described in Doc-01 Section 6
// (Redis) and Doc-02 Section 8 (feed caching/ETags).
//
// PHASE 3 NOTE: this interface takes a context.Context on every method —
// added when wiring the real Redis implementation (redis_cache.go), since
// a network-calling cache needs to respect request cancellation/timeouts.
// InMemoryCache (below) ignores the context, since it has no I/O to cancel,
// but keeps the same signature so callers don't need to know which
// implementation they're talking to.
type Cache interface {
	Get(ctx context.Context, key string) (Feed, bool)
	Set(ctx context.Context, key string, f Feed, ttl time.Duration)
	Invalidate(ctx context.Context, key string)
}

type entry struct {
	feed      Feed
	expiresAt time.Time
}

// InMemoryCache is a concurrency-safe, non-persistent Cache implementation.
// Suitable for local development and tests only — never use in production
// (Doc-01 Section 6 specifies Redis for this role).
type InMemoryCache struct {
	mu    sync.RWMutex
	items map[string]entry
}

func NewInMemoryCache() *InMemoryCache {
	return &InMemoryCache{items: make(map[string]entry)}
}

func (c *InMemoryCache) Get(_ context.Context, key string) (Feed, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	e, ok := c.items[key]
	if !ok || time.Now().After(e.expiresAt) {
		return Feed{}, false
	}
	return e.feed, true
}

func (c *InMemoryCache) Set(_ context.Context, key string, f Feed, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.items[key] = entry{feed: f, expiresAt: time.Now().Add(ttl)}
}

func (c *InMemoryCache) Invalidate(_ context.Context, key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.items, key)
}
