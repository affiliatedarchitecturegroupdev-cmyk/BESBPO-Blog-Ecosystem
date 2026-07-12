// Package middleware implements the authentication schemes from Doc-02
// Section 4: tenant API key (+ HMAC signature, Phase 1) for feed reads, and
// service JWT for internal calls like the publish webhook.
package middleware

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"

	"github.com/besbpo-group/besbpo-blog-syndication-svc/internal/tenant"
)

type ctxKey string

const tenantCtxKey ctxKey = "besbpo_tenant"

// RequireTenantAuth verifies the X-Besbpo-Api-Key header against the tenant
// store, verifies the accompanying HMAC request signature (Doc-02 Section
// 4 — see hmac.go), confirms it matches the {tenantId} in the path, and
// attaches the resolved tenant to the request context.
func RequireTenantAuth(store tenant.Store) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			apiKey := r.Header.Get("X-Besbpo-Api-Key")
			if apiKey == "" {
				http.Error(w, `{"error":"missing X-Besbpo-Api-Key header"}`, http.StatusUnauthorized)
				return
			}

			hash := sha256.Sum256([]byte(apiKey))
			hashHex := hex.EncodeToString(hash[:])

			t, err := store.GetByAPIKeyHash(r.Context(), hashHex)
			if err != nil {
				http.Error(w, `{"error":"invalid api key"}`, http.StatusUnauthorized)
				return
			}

			pathTenantID := r.PathValue("tenantId")
			// GET /api/v1/feed/{tenantId}.rss (Doc-02 Section 5) is served by
			// the same registered pattern as the JSON variant, since Go's
			// net/http.ServeMux requires a wildcard to span an entire path
			// segment — {tenantId} can't have a literal ".rss" suffix within
			// the same segment. feed.ServeFeed (the actual handler) does its
			// own suffix detection to choose a response format; this
			// comparison just needs to look past that suffix too, or a
			// legitimate RSS request would be rejected as a tenant-ID
			// mismatch.
			cleanPathTenantID := strings.TrimSuffix(pathTenantID, ".rss")
			if cleanPathTenantID != "" && cleanPathTenantID != t.ID {
				http.Error(w, `{"error":"api key does not match tenant id in path"}`, http.StatusForbidden)
				return
			}

			if err := VerifyRequestSignature(r, apiKey, t.ID); err != nil {
				http.Error(w, fmt.Sprintf(`{"error":"invalid request signature: %s"}`, err.Error()), http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), tenantCtxKey, t)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// TenantFromContext retrieves the tenant attached by RequireTenantAuth.
func TenantFromContext(ctx context.Context) (tenant.Tenant, bool) {
	t, ok := ctx.Value(tenantCtxKey).(tenant.Tenant)
	return t, ok
}

const adminClaimsCtxKey ctxKey = "besbpo_admin_claims"
const serviceClaimsCtxKey ctxKey = "besbpo_service_claims"

// RequireAdminJWT guards tenant admin endpoints (create/update/rotate-key)
// per the `adminJwt` security scheme in
// besbpo-blog-architecture/openapi/syndication-api.yaml — "short-lived JWT
// issued by the CMS core after SSO login." Deliberately a separate function
// from RequireServiceJWT even though both were Phase 3 presence-only stubs
// initially: the two schemes identify different callers (a human admin via
// SSO vs. a trusted internal service) and diverge in what they verify (see
// jwt.go) — an admin token must additionally carry a Syndication Admin or
// Super Admin role, matching Doc-03's RBAC matrix.
func RequireAdminJWT(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if len(authHeader) < 8 || authHeader[:7] != "Bearer " {
				http.Error(w, `{"error":"missing admin bearer token"}`, http.StatusUnauthorized)
				return
			}
			tokenString := authHeader[7:]

			claims, err := verifyAdminJWT(tokenString, secret)
			if err != nil {
				http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), adminClaimsCtxKey, *claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// AdminClaimsFromContext retrieves the claims attached by RequireAdminJWT.
func AdminClaimsFromContext(ctx context.Context) (AdminClaims, bool) {
	c, ok := ctx.Value(adminClaimsCtxKey).(AdminClaims)
	return c, ok
}

// RequireServiceJWT guards internal-only endpoints (e.g. the publish
// webhook) so they can never be reached from the public internet even if
// mis-routed.
func RequireServiceJWT(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if len(authHeader) < 8 || authHeader[:7] != "Bearer " {
				http.Error(w, `{"error":"missing service bearer token"}`, http.StatusUnauthorized)
				return
			}
			tokenString := authHeader[7:]

			claims, err := verifyServiceJWT(tokenString, secret)
			if err != nil {
				http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), serviceClaimsCtxKey, *claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// ServiceClaimsFromContext retrieves the claims attached by RequireServiceJWT.
func ServiceClaimsFromContext(ctx context.Context) (ServiceClaims, bool) {
	c, ok := ctx.Value(serviceClaimsCtxKey).(ServiceClaims)
	return c, ok
}
