package middleware

import (
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"
)

func TestComputeSignature_IsDeterministic(t *testing.T) {
	key := DeriveSigningKey("test-api-key")
	sig1 := ComputeSignature(key, "tenant-1", "1700000000", "/api/v1/feed/tenant-1")
	sig2 := ComputeSignature(key, "tenant-1", "1700000000", "/api/v1/feed/tenant-1")
	if sig1 != sig2 {
		t.Fatalf("expected identical signatures for identical input, got %q and %q", sig1, sig2)
	}
}

func TestComputeSignature_DiffersWhenPathDiffers(t *testing.T) {
	key := DeriveSigningKey("test-api-key")
	sig1 := ComputeSignature(key, "tenant-1", "1700000000", "/api/v1/feed/tenant-1")
	sig2 := ComputeSignature(key, "tenant-1", "1700000000", "/api/v1/feed/tenant-2")
	if sig1 == sig2 {
		t.Fatalf("expected different signatures for different paths, both were %q", sig1)
	}
}

func TestDeriveSigningKey_DiffersFromPlainLookupHash(t *testing.T) {
	// Regression guard for the domain-separation property described in the
	// package doc comment: the HMAC signing key must not equal a bare
	// sha256(apiKey), which is what auth.go uses for the lookup hash.
	apiKey := "test-api-key"
	signingKeyHex := hex.EncodeToString(DeriveSigningKey(apiKey))
	lookupHashHex := plainLookupHash(apiKey)

	if signingKeyHex == lookupHashHex {
		t.Fatalf("signing key must differ from the plain lookup hash, both were %q", signingKeyHex)
	}
}

func TestVerifyRequestSignature_AcceptsAValidSignature(t *testing.T) {
	apiKey := "test-api-key"
	tenantID := "tenant-1"
	path := "/api/v1/feed/tenant-1"
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)

	signingKey := DeriveSigningKey(apiKey)
	signature := ComputeSignature(signingKey, tenantID, timestamp, path)

	req := httptest.NewRequest(http.MethodGet, path, nil)
	req.Header.Set("X-Besbpo-Timestamp", timestamp)
	req.Header.Set("X-Besbpo-Signature", signature)

	if err := VerifyRequestSignature(req, apiKey, tenantID); err != nil {
		t.Fatalf("expected a valid signature to verify, got error: %v", err)
	}
}

func TestVerifyRequestSignature_RejectsATamperedSignature(t *testing.T) {
	apiKey := "test-api-key"
	tenantID := "tenant-1"
	path := "/api/v1/feed/tenant-1"
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)

	req := httptest.NewRequest(http.MethodGet, path, nil)
	req.Header.Set("X-Besbpo-Timestamp", timestamp)
	req.Header.Set("X-Besbpo-Signature", "0000000000000000000000000000000000000000000000000000000000000000")

	if err := VerifyRequestSignature(req, apiKey, tenantID); err == nil {
		t.Fatal("expected a tampered signature to be rejected, got no error")
	}
}

func TestVerifyRequestSignature_RejectsAnExpiredTimestamp(t *testing.T) {
	apiKey := "test-api-key"
	tenantID := "tenant-1"
	path := "/api/v1/feed/tenant-1"
	staleTimestamp := strconv.FormatInt(time.Now().Add(-1*time.Hour).Unix(), 10)

	signingKey := DeriveSigningKey(apiKey)
	signature := ComputeSignature(signingKey, tenantID, staleTimestamp, path)

	req := httptest.NewRequest(http.MethodGet, path, nil)
	req.Header.Set("X-Besbpo-Timestamp", staleTimestamp)
	req.Header.Set("X-Besbpo-Signature", signature)

	err := VerifyRequestSignature(req, apiKey, tenantID)
	if err == nil {
		t.Fatal("expected a stale timestamp to be rejected, got no error")
	}
}

func TestVerifyRequestSignature_RejectsMissingHeaders(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/feed/tenant-1", nil)
	if err := VerifyRequestSignature(req, "test-api-key", "tenant-1"); err == nil {
		t.Fatal("expected missing headers to be rejected, got no error")
	}
}

// plainLookupHash mirrors the lookup-hash computation in auth.go
// (sha256.Sum256 + hex.EncodeToString), duplicated locally so this test
// package doesn't need to export that logic just to assert against it.
func plainLookupHash(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}
