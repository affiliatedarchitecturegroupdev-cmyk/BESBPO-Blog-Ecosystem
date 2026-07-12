package feed

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

// RedisCache implements Cache against a real Redis instance (Doc-01
// Section 6, Doc-04 Section 4). Feed values are JSON-encoded before
// storage — simplest reliable approach given Feed embeds nested structs
// (ArticleSummary, Pagination) that Redis has no native representation for.
type RedisCache struct {
	client *redis.Client
	// keyPrefix namespaces this service's cache keys within a shared Redis
	// instance, in case Redis ends up hosting more than just this cache
	// (Coolify's one-click Redis is often shared across services in
	// smaller deployments — see Doc-04 Section 4).
	keyPrefix string
}

func NewRedisCache(client *redis.Client) *RedisCache {
	return &RedisCache{client: client, keyPrefix: "syndication:feed:"}
}

func (c *RedisCache) Get(ctx context.Context, key string) (Feed, bool) {
	raw, err := c.client.Get(ctx, c.keyPrefix+key).Bytes()
	if err != nil {
		if !errors.Is(err, redis.Nil) {
			// A Redis error (timeout, connection issue) should degrade to a
			// cache miss, not a request failure — the feed handler falls
			// through to ArticleSource on a miss either way. Log it so an
			// operator can see Redis is unhealthy without the request path
			// breaking for tenants.
			log.Printf("redis cache Get error for key %q: %v", key, err)
		}
		return Feed{}, false
	}

	var f Feed
	if err := json.Unmarshal(raw, &f); err != nil {
		log.Printf("redis cache Get: corrupt cached value for key %q, treating as miss: %v", key, err)
		return Feed{}, false
	}
	return f, true
}

func (c *RedisCache) Set(ctx context.Context, key string, f Feed, ttl time.Duration) {
	raw, err := json.Marshal(f)
	if err != nil {
		log.Printf("redis cache Set: failed to encode feed for key %q: %v", key, err)
		return
	}
	if err := c.client.Set(ctx, c.keyPrefix+key, raw, ttl).Err(); err != nil {
		// Same reasoning as Get: a failed cache write shouldn't fail the
		// request that triggered it — the next request just misses the
		// cache and rebuilds the feed again.
		log.Printf("redis cache Set error for key %q: %v", key, err)
	}
}

func (c *RedisCache) Invalidate(ctx context.Context, key string) {
	if err := c.client.Del(ctx, c.keyPrefix+key).Err(); err != nil {
		log.Printf("redis cache Invalidate error for key %q: %v", key, err)
	}
}
