// Package middleware — HMAC request signature verification, closing the
// gap flagged in Phase 0 (see auth.go's original PHASE 1 TODO):
// besbpo-blog-architecture/openapi/syndication-api.yaml's `tenantApiKey`
// scheme requires "API key + HMAC signature, signature covers tenant_id,
// timestamp, and path" (Doc-02 Section 4) — this file implements that,
// on top of the existing API-key-hash lookup in auth.go.
//
// Key derivation note: the API key hash used for tenant lookup
// (sha256(apiKey), see auth.go) and the HMAC signing key derived here are
// deliberately DIFFERENT values computed from the same api key, via a
// domain-separation suffix, so the two purposes (lookup vs. signing) don't
// reuse the identical hash for two different cryptographic roles:
//
//	lookupHash  = sha256(apiKey)
//	signingKey  = sha256(apiKey + ":hmac-signing")
//
// The client (any build-time/server-side caller — see Doc-02 Section 7)
// must derive its signing key the same way.
package middleware

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"strconv"
	"time"
)

const (
	signatureHeader = "X-Besbpo-Signature"
	timestampHeader = "X-Besbpo-Timestamp"
	// MaxClockSkew bounds how old (or how far in the future) a signed
	// request's timestamp may be before it's rejected as a likely replay.
	MaxClockSkew = 5 * time.Minute
)

// DeriveSigningKey computes the HMAC signing key for a given plaintext API
// key. See the package doc comment above for why this is distinct from the
// lookup hash computed in auth.go.
func DeriveSigningKey(apiKey string) []byte {
	sum := sha256.Sum256([]byte(apiKey + ":hmac-signing"))
	return sum[:]
}

// ComputeSignature returns the hex-encoded HMAC-SHA256 signature over the
// message `tenantID\ntimestamp\npath`, per Doc-02 Section 4. `timestamp`
// should be a Unix-seconds string, matching what's sent in the
// X-Besbpo-Timestamp header.
func ComputeSignature(signingKey []byte, tenantID string, timestamp string, path string) string {
	message := tenantID + "\n" + timestamp + "\n" + path
	mac := hmac.New(sha256.New, signingKey)
	mac.Write([]byte(message))
	return hex.EncodeToString(mac.Sum(nil))
}

// VerifyRequestSignature checks the X-Besbpo-Signature and
// X-Besbpo-Timestamp headers on r against the expected signature for the
// given tenant/apiKey/path, using a constant-time comparison, and rejects
// timestamps outside MaxClockSkew of the server's clock.
func VerifyRequestSignature(r *http.Request, apiKey string, tenantID string) error {
	providedSignature := r.Header.Get(signatureHeader)
	if providedSignature == "" {
		return fmt.Errorf("missing %s header", signatureHeader)
	}

	timestampStr := r.Header.Get(timestampHeader)
	if timestampStr == "" {
		return fmt.Errorf("missing %s header", timestampHeader)
	}

	timestampSeconds, err := strconv.ParseInt(timestampStr, 10, 64)
	if err != nil {
		return fmt.Errorf("invalid %s header: %w", timestampHeader, err)
	}

	requestTime := time.Unix(timestampSeconds, 0)
	skew := time.Since(requestTime)
	if skew < 0 {
		skew = -skew
	}
	if skew > MaxClockSkew {
		return fmt.Errorf("request timestamp outside allowed clock skew of %s", MaxClockSkew)
	}

	signingKey := DeriveSigningKey(apiKey)
	expectedSignature := ComputeSignature(signingKey, tenantID, timestampStr, r.URL.Path)

	if !hmac.Equal([]byte(expectedSignature), []byte(providedSignature)) {
		return fmt.Errorf("signature mismatch")
	}
	return nil
}
