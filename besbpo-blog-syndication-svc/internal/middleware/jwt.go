// Real JWT verification for the two schemes described in Doc-02 Section 4
// — `adminJwt` (a human admin, via SSO, issued by besbpo-blog-cms-api) and
// `serviceJwt` (a trusted internal service). Closes the gap flagged
// throughout Phase 3: RequireAdminJWT and RequireServiceJWT previously
// only checked that a bearer token was present, not that it was valid.
//
// CLAIMS SHAPE ALIGNMENT: AdminClaims mirrors besbpo-blog-cms-api's
// JwtPayload exactly (src/auth/jwt.strategy.ts: `sub`, `roles`,
// `divisionId`) — `sub` comes for free via jwt.RegisteredClaims.Subject,
// so this Go service can verify tokens issued by that NestJS code without
// either side needing a translation layer.
//
// SHARED SECRET NOTE: besbpo-blog-cms-api currently signs every token it
// issues with a single JWT_SECRET (see its AuthModule) — it does not yet
// distinguish an "admin" signing key from a "service" signing key. This Go
// service's config deliberately keeps ADMIN_JWT_SECRET and
// SERVICE_JWT_SECRET as separate settings (better architecture going
// forward, and the two schemes may reasonably diverge later), but until
// the CMS core is updated to sign admin vs. service tokens with distinct
// keys, both env vars need to be set to the SAME value as the CMS core's
// JWT_SECRET for verification to succeed. Documented here and in
// .env.example so this isn't a surprise at deploy time.
//
// ALGORITHM CONFUSION GUARD: both verify functions explicitly restrict
// accepted signing methods to HS256 via jwt.WithValidMethods. Without
// this, a token crafted with `"alg": "none"` or an asymmetric algorithm
// the server doesn't expect is a well-known JWT bypass technique — never
// trust the `alg` header a token claims for itself.
package middleware

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// AdminClaims mirrors besbpo-blog-cms-api's JwtPayload (src/auth/jwt.strategy.ts).
type AdminClaims struct {
	Roles      []string `json:"roles"`
	DivisionID string   `json:"divisionId,omitempty"`
	jwt.RegisteredClaims
}

// HasAnyRole reports whether the token carries at least one of the given
// roles — mirrors the `some(role => user.roles.includes(role))` check in
// besbpo-blog-cms-api's RolesGuard, so the same authorization logic reads
// the same way on both sides of the platform.
func (c AdminClaims) HasAnyRole(roles ...string) bool {
	for _, want := range roles {
		for _, have := range c.Roles {
			if have == want {
				return true
			}
		}
	}
	return false
}

// ServiceClaims identifies an internal caller (e.g. besbpo-blog-cms-api
// calling this service's publish webhook). No equivalent NestJS-side
// issuer exists yet as of Phase 3 — WebhooksService in besbpo-blog-cms-api
// is still a logging stub (see its own TODO) — so this shape is Go-side
// only for now; align it there once that stub becomes a real HTTP client.
type ServiceClaims struct {
	Service string `json:"service"`
	jwt.RegisteredClaims
}

// Roles a token must carry to pass RequireAdminJWT, matching Doc-03's RBAC
// matrix: only Syndication Admin and Super Admin may manage tenants.
var tenantAdminRoles = []string{"syndication_admin", "super_admin"}

func verifyAdminJWT(tokenString string, secret string) (*AdminClaims, error) {
	claims := &AdminClaims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	}, jwt.WithValidMethods([]string{"HS256"}))
	if err != nil {
		return nil, fmt.Errorf("invalid admin token: %w", err)
	}
	if !token.Valid {
		return nil, fmt.Errorf("invalid admin token")
	}
	if !claims.HasAnyRole(tenantAdminRoles...) {
		return nil, fmt.Errorf("token does not carry a required role (%v)", tenantAdminRoles)
	}
	return claims, nil
}

func verifyServiceJWT(tokenString string, secret string) (*ServiceClaims, error) {
	claims := &ServiceClaims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	}, jwt.WithValidMethods([]string{"HS256"}))
	if err != nil {
		return nil, fmt.Errorf("invalid service token: %w", err)
	}
	if !token.Valid {
		return nil, fmt.Errorf("invalid service token")
	}
	return claims, nil
}

// SignAdminJWT mints a short-lived, self-signed admin-shaped JWT (Phase 9).
// Used by feed.CMSArticleSource to authenticate this service's OWN outbound
// calls to besbpo-blog-cms-api's GET /articles — that endpoint is guarded
// by JwtAuthGuard + RolesGuard (a real Docker Compose integration finding;
// see that repo's README), requiring a genuine signed JWT carrying an
// authorized role. What CMSArticleSource sent before this (a static bearer
// token) fails that check outright, regardless of the string's value —
// it was never going to work once that guard was added, and this is the
// fix.
//
// Signed with the SAME shared secret this service uses to VERIFY inbound
// admin JWTs (see the SHARED SECRET NOTE in this file's header) — this
// service ends up being both an issuer and a verifier of the same token
// shape, which is self-consistent as long as the shared-secret convention
// documented there holds. `roles` should carry a role besbpo-blog-cms-api's
// RolesGuard actually authorizes for the target endpoint — for
// GET /articles specifically, "syndication_admin" is one of the roles
// ArticlesController.findAll allows.
func SignAdminJWT(subject string, roles []string, secret string, ttl time.Duration) (string, error) {
	now := time.Now()
	claims := AdminClaims{
		Roles: roles,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   subject,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}
