package middleware

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const testSecret = "test-secret-for-jwt-verification"

func signAdminToken(t *testing.T, roles []string, expiresAt time.Time, method jwt.SigningMethod, secret string) string {
	t.Helper()
	claims := AdminClaims{
		Roles:      roles,
		DivisionID: "div-1",
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   "user-1",
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(method, claims)
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("failed to sign test token: %v", err)
	}
	return signed
}

func signServiceToken(t *testing.T, service string, expiresAt time.Time, secret string) string {
	t.Helper()
	claims := ServiceClaims{
		Service: service,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("failed to sign test token: %v", err)
	}
	return signed
}

func TestVerifyAdminJWT_AcceptsAValidSyndicationAdminToken(t *testing.T) {
	tokenString := signAdminToken(t, []string{"syndication_admin"}, time.Now().Add(time.Hour), jwt.SigningMethodHS256, testSecret)

	claims, err := verifyAdminJWT(tokenString, testSecret)
	if err != nil {
		t.Fatalf("expected a valid token to verify, got: %v", err)
	}
	if claims.Subject != "user-1" {
		t.Errorf("expected subject 'user-1', got %q", claims.Subject)
	}
}

func TestVerifyAdminJWT_AcceptsSuperAdminToken(t *testing.T) {
	tokenString := signAdminToken(t, []string{"super_admin"}, time.Now().Add(time.Hour), jwt.SigningMethodHS256, testSecret)

	if _, err := verifyAdminJWT(tokenString, testSecret); err != nil {
		t.Fatalf("expected a super_admin token to verify, got: %v", err)
	}
}

func TestVerifyAdminJWT_RejectsTokenMissingRequiredRole(t *testing.T) {
	// A valid, correctly-signed, unexpired token — but the role isn't
	// authorized to manage tenants (Doc-03 RBAC: only Syndication Admin /
	// Super Admin can). This must fail even though the signature is fine.
	tokenString := signAdminToken(t, []string{"division_author"}, time.Now().Add(time.Hour), jwt.SigningMethodHS256, testSecret)

	if _, err := verifyAdminJWT(tokenString, testSecret); err == nil {
		t.Fatal("expected a token without an authorized role to be rejected")
	}
}

func TestVerifyAdminJWT_RejectsExpiredToken(t *testing.T) {
	tokenString := signAdminToken(t, []string{"syndication_admin"}, time.Now().Add(-time.Hour), jwt.SigningMethodHS256, testSecret)

	if _, err := verifyAdminJWT(tokenString, testSecret); err == nil {
		t.Fatal("expected an expired token to be rejected")
	}
}

func TestVerifyAdminJWT_RejectsWrongSecret(t *testing.T) {
	tokenString := signAdminToken(t, []string{"syndication_admin"}, time.Now().Add(time.Hour), jwt.SigningMethodHS256, testSecret)

	if _, err := verifyAdminJWT(tokenString, "a-completely-different-secret"); err == nil {
		t.Fatal("expected a token signed with a different secret to be rejected")
	}
}

func TestVerifyAdminJWT_RejectsUnexpectedSigningMethod(t *testing.T) {
	// Algorithm confusion guard: even though this token is validly signed
	// with the SAME secret, HS384 isn't in the accepted method list
	// (jwt.WithValidMethods([]string{"HS256"}) in jwt.go) and must be
	// rejected. A server that accepts whatever `alg` a token claims for
	// itself is vulnerable to a well-known class of JWT bypass.
	tokenString := signAdminToken(t, []string{"syndication_admin"}, time.Now().Add(time.Hour), jwt.SigningMethodHS384, testSecret)

	if _, err := verifyAdminJWT(tokenString, testSecret); err == nil {
		t.Fatal("expected a token signed with an unexpected algorithm (HS384) to be rejected")
	}
}

func TestVerifyAdminJWT_RejectsMalformedToken(t *testing.T) {
	if _, err := verifyAdminJWT("not-a-real-jwt", testSecret); err == nil {
		t.Fatal("expected a malformed token string to be rejected")
	}
}

func TestVerifyServiceJWT_AcceptsAValidToken(t *testing.T) {
	tokenString := signServiceToken(t, "besbpo-blog-cms-api", time.Now().Add(time.Hour), testSecret)

	claims, err := verifyServiceJWT(tokenString, testSecret)
	if err != nil {
		t.Fatalf("expected a valid service token to verify, got: %v", err)
	}
	if claims.Service != "besbpo-blog-cms-api" {
		t.Errorf("expected service 'besbpo-blog-cms-api', got %q", claims.Service)
	}
}

func TestVerifyServiceJWT_RejectsExpiredToken(t *testing.T) {
	tokenString := signServiceToken(t, "besbpo-blog-cms-api", time.Now().Add(-time.Hour), testSecret)

	if _, err := verifyServiceJWT(tokenString, testSecret); err == nil {
		t.Fatal("expected an expired service token to be rejected")
	}
}

func TestVerifyServiceJWT_RejectsWrongSecret(t *testing.T) {
	tokenString := signServiceToken(t, "besbpo-blog-cms-api", time.Now().Add(time.Hour), testSecret)

	if _, err := verifyServiceJWT(tokenString, "wrong-secret"); err == nil {
		t.Fatal("expected a service token signed with a different secret to be rejected")
	}
}

func TestSignAdminJWT_RoundTripsThroughVerifyAdminJWT(t *testing.T) {
	tokenString, err := SignAdminJWT("besbpo-blog-syndication-svc", []string{"syndication_admin"}, testSecret, 5*time.Minute)
	if err != nil {
		t.Fatalf("expected signing to succeed, got: %v", err)
	}

	claims, err := verifyAdminJWT(tokenString, testSecret)
	if err != nil {
		t.Fatalf("expected a token signed by SignAdminJWT to verify successfully, got: %v", err)
	}
	if claims.Subject != "besbpo-blog-syndication-svc" {
		t.Errorf("expected subject 'besbpo-blog-syndication-svc', got %q", claims.Subject)
	}
	if !claims.HasAnyRole("syndication_admin") {
		t.Error("expected the signed token to carry the syndication_admin role")
	}
}

func TestSignAdminJWT_ProducesATokenThatExpiresAfterTheGivenTTL(t *testing.T) {
	tokenString, err := SignAdminJWT("besbpo-blog-syndication-svc", []string{"syndication_admin"}, testSecret, -1*time.Minute)
	if err != nil {
		t.Fatalf("expected signing to succeed, got: %v", err)
	}

	if _, err := verifyAdminJWT(tokenString, testSecret); err == nil {
		t.Fatal("expected a token signed with a negative TTL (already expired) to fail verification")
	}
}

func TestSignAdminJWT_FailsVerificationWithoutAnAuthorizedRole(t *testing.T) {
	// Signing succeeds regardless of which roles are requested — it's
	// verifyAdminJWT's job to enforce the role requirement, not
	// SignAdminJWT's. Confirms that division separation holds: a caller
	// can't sign their way around the role check just by calling this
	// function with an unauthorized role.
	tokenString, err := SignAdminJWT("someone", []string{"division_author"}, testSecret, 5*time.Minute)
	if err != nil {
		t.Fatalf("expected signing to succeed, got: %v", err)
	}

	if _, err := verifyAdminJWT(tokenString, testSecret); err == nil {
		t.Fatal("expected verification to fail for a role verifyAdminJWT doesn't authorize")
	}
}
