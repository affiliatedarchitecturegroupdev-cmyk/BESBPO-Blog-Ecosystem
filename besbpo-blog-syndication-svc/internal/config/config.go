// Package config loads runtime configuration from environment variables.
// Implements the environment variable checklist referenced in
// BESBPO-BLOG-ARCH-04 (Infrastructure & DevOps Plan), Appendix.
package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port                 string
	DatabaseURL          string
	RedisURL             string
	ServiceJWTSecret     string
	AdminJWTSecret       string
	DefaultRateLimitRPM  int
	HighTierRateLimitRPM int
	CMSCoreAPIURL        string
	GitHubDispatchToken  string
	// UseInMemoryBackends, when true, skips connecting to Postgres/Redis/
	// the real CMS API and uses the Phase 0 in-memory implementations
	// instead — mirroring the fixture-fallback pattern in besbpo-blog-web's
	// lib/api.ts, so this service is runnable locally without standing up
	// the full stack first. Defaults to true unless DATABASE_URL is
	// explicitly set, on the theory that if you've bothered to set a real
	// database URL, you want the real backend.
	UseInMemoryBackends bool
}

func Load() Config {
	_, databaseURLSet := os.LookupEnv("DATABASE_URL")

	return Config{
		Port:                 getEnv("PORT", "8080"),
		DatabaseURL:          getEnv("DATABASE_URL", "postgres://besbpo:besbpo@localhost:5432/besbpo_blog"),
		RedisURL:             getEnv("REDIS_URL", "redis://localhost:6379"),
		ServiceJWTSecret:     getEnv("SERVICE_JWT_SECRET", "dev-secret-change-me"),
		AdminJWTSecret:       getEnv("ADMIN_JWT_SECRET", "dev-admin-secret-change-me"),
		DefaultRateLimitRPM:  getEnvInt("DEFAULT_RATE_LIMIT_RPM", 60),
		HighTierRateLimitRPM: getEnvInt("HIGH_TIER_RATE_LIMIT_RPM", 300),
		CMSCoreAPIURL:        getEnv("CMS_CORE_API_URL", "http://localhost:3000"),
		// CMS_SERVICE_TOKEN removed (Phase 9) — feed.CMSArticleSource now
		// authenticates to besbpo-blog-cms-api by signing a short-lived
		// admin-shaped JWT with AdminJWTSecret (above; see
		// middleware.SignAdminJWT) instead of sending a static bearer
		// token, which stopped working once that endpoint's JwtAuthGuard
		// was added (see besbpo-blog-cms-api's README for the Docker
		// Compose review that found this).
		GitHubDispatchToken: getEnv("GITHUB_DISPATCH_TOKEN", ""),
		UseInMemoryBackends: getEnvBool("USE_IN_MEMORY_BACKENDS", !databaseURLSet),
	}
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	v, ok := os.LookupEnv(key)
	if !ok {
		return fallback
	}
	parsed, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return parsed
}

func getEnvBool(key string, fallback bool) bool {
	v, ok := os.LookupEnv(key)
	if !ok || v == "" {
		return fallback
	}
	parsed, err := strconv.ParseBool(v)
	if err != nil {
		return fallback
	}
	return parsed
}
