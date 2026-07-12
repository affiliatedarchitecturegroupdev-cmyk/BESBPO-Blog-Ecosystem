// Command besbpo-blog-syndication-svc serves the Syndication API described
// in besbpo-blog-architecture/openapi/syndication-api.yaml (Doc-02). This is
// the only dynamic-tier service the 30+ subsidiary sites talk to directly.
package main

import (
	"context"
	"log"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"github.com/besbpo-group/besbpo-blog-syndication-svc/internal/analytics"
	"github.com/besbpo-group/besbpo-blog-syndication-svc/internal/config"
	"github.com/besbpo-group/besbpo-blog-syndication-svc/internal/feed"
	"github.com/besbpo-group/besbpo-blog-syndication-svc/internal/middleware"
	"github.com/besbpo-group/besbpo-blog-syndication-svc/internal/tenant"
	"github.com/besbpo-group/besbpo-blog-syndication-svc/internal/webhook"
)

func main() {
	cfg := config.Load()
	ctx := context.Background()

	var (
		tenantStore   tenant.Store
		feedCache     feed.Cache
		articleSource feed.ArticleSource
		dispatcher    webhook.Dispatcher
		rateLimiter   middleware.RateLimiter
		// pool stays nil in UseInMemoryBackends mode — analytics.Service
		// and analytics.BeaconHandler both handle a nil pool gracefully
		// (see internal/analytics), matching this platform's
		// graceful-degradation philosophy elsewhere.
		pool *pgxpool.Pool
	)

	if cfg.UseInMemoryBackends {
		log.Println("USE_IN_MEMORY_BACKENDS is set (or DATABASE_URL is unset) — running against " +
			"in-memory tenant store, in-memory cache, in-memory article source, and a logging " +
			"dispatcher. Set DATABASE_URL (and REDIS_URL, CMS_CORE_API_URL) for a real deployment.")

		tenantStore = tenant.NewInMemoryStore()
		feedCache = feed.NewInMemoryCache()
		articleSource = feed.NewInMemoryArticleSource()
		dispatcher = webhook.NewLoggingDispatcher()
		rateLimiter = middleware.NewInMemoryRateLimiter()
	} else {
		var err error
		pool, err = pgxpool.New(ctx, cfg.DatabaseURL)
		if err != nil {
			log.Fatalf("connecting to Postgres: %v", err)
		}
		defer pool.Close()
		if err := pool.Ping(ctx); err != nil {
			log.Fatalf("Postgres ping failed: %v", err)
		}
		tenantStore = tenant.NewPostgresStore(pool)
		log.Println("connected to Postgres tenant store")

		redisOpts, err := redis.ParseURL(cfg.RedisURL)
		if err != nil {
			log.Fatalf("parsing REDIS_URL: %v", err)
		}
		redisClient := redis.NewClient(redisOpts)
		if err := redisClient.Ping(ctx).Err(); err != nil {
			log.Fatalf("Redis ping failed: %v", err)
		}
		defer redisClient.Close()
		feedCache = feed.NewRedisCache(redisClient)
		rateLimiter = middleware.NewRedisRateLimiter(redisClient)
		log.Println("connected to Redis feed cache + rate limiter")

		articleSource = feed.NewCMSArticleSource(cfg.CMSCoreAPIURL, cfg.AdminJWTSecret)
		log.Printf("using CMS core article source at %s", cfg.CMSCoreAPIURL)

		if cfg.GitHubDispatchToken == "" {
			log.Println("WARNING: GITHUB_DISPATCH_TOKEN is not set — build-time syndication " +
				"dispatch calls will fail for any tenant with delivery_mode=build_time/both. " +
				"Set it before onboarding any such tenant (Doc-02 Section 3).")
		}
		dispatcher = webhook.NewGitHubDispatcher(cfg.GitHubDispatchToken)
	}

	feedHandler := feed.NewHandler(tenantStore, articleSource, feedCache)
	webhookHandler := webhook.NewHandler(tenantStore, feedCache, dispatcher)
	adminHandler := tenant.NewAdminHandler(tenantStore)
	analyticsService := analytics.NewService(pool)
	analyticsHandler := analytics.NewHandler(analyticsService)
	beaconHandler := analytics.NewBeaconHandler(pool)

	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok","service":"besbpo-blog-syndication-svc"}`))
	})

	// Public/tenant-authenticated feed reads (Doc-02 Section 5). One
	// registered pattern serves both the JSON and .rss variants — see the
	// comment on feed.Handler.ServeFeed for why Go's mux can't register
	// {tenantId} and {tenantId}.rss as two separate patterns.
	tenantAuth := middleware.RequireTenantAuth(tenantStore)
	rateLimit := middleware.RequireRateLimit(rateLimiter)
	mux.Handle("GET /api/v1/feed/{tenantId}", tenantAuth(rateLimit(http.HandlerFunc(feedHandler.ServeFeed))))

	// Internal-only webhook (Doc-02 Section 5 & 7).
	serviceAuth := middleware.RequireServiceJWT(cfg.ServiceJWTSecret)
	mux.Handle("POST /api/v1/webhooks/publish", serviceAuth(http.HandlerFunc(webhookHandler.ServePublishWebhook)))

	// Tenant admin CRUD (Doc-02 Section 5) — Syndication Admin only, via
	// the CMS core's SSO-issued adminJwt (Doc-02 Section 4).
	adminAuth := middleware.RequireAdminJWT(cfg.AdminJWTSecret)
	mux.Handle("POST /api/v1/tenants", adminAuth(http.HandlerFunc(adminHandler.HandleCreate)))
	mux.Handle("GET /api/v1/tenants/{tenantId}", adminAuth(http.HandlerFunc(adminHandler.HandleGet)))
	mux.Handle("PATCH /api/v1/tenants/{tenantId}", adminAuth(http.HandlerFunc(adminHandler.HandleUpdate)))
	mux.Handle("POST /api/v1/tenants/{tenantId}/rotate-key", adminAuth(http.HandlerFunc(adminHandler.HandleRotateKey)))

	// Phase 8: syndication analytics (Doc-03 Section 8), for the new
	// besbpo-editorial-dashboard. Summary reporting is admin-only.
	//
	// The beacon endpoint is deliberately public (no tenant API key, no
	// HMAC — see analytics.BeaconHandler's doc comment for why) so it
	// can't use RequireRateLimit (which needs an authenticated tenant in
	// context, populated by RequireTenantAuth — a step this endpoint
	// deliberately skips). RequireIPRateLimit (Phase 9) closes the gap
	// this was originally shipped with in Phase 8 (no rate limiting at
	// all): 60/minute per IP — generous enough for a legitimate page view
	// firing several impression beacons at once (one per rendered
	// article), tight enough to bound abuse from any single source.
	beaconRateLimit := middleware.RequireIPRateLimit(rateLimiter, 60)
	mux.Handle("GET /api/v1/analytics/summary", adminAuth(http.HandlerFunc(analyticsHandler.ServeSummary)))
	mux.Handle("POST /api/v1/analytics/beacon", beaconRateLimit(http.HandlerFunc(beaconHandler.ServeBeacon)))

	log.Printf("besbpo-blog-syndication-svc listening on :%s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, mux); err != nil {
		log.Fatal(err)
	}
}
