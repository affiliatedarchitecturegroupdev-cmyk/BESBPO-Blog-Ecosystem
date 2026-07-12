package tenant

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
)

// generateAPIKey returns a new random plaintext API key and its sha256
// hash — the hash is what gets stored (tenants.api_key_hash); the plaintext
// is returned to the caller exactly once, per Doc-02 Section 3 step 2 and
// the OpenAPI `TenantCreateResponse` schema's api_key field description.
func generateAPIKey() (plaintext string, hash string, err error) {
	raw := make([]byte, 32) // 256 bits
	if _, err := rand.Read(raw); err != nil {
		return "", "", fmt.Errorf("generating random API key: %w", err)
	}
	plaintext = "bsk_" + hex.EncodeToString(raw) // "bsk_" = Besbpo Syndication Key, a recognisable prefix
	sum := sha256.Sum256([]byte(plaintext))
	hash = hex.EncodeToString(sum[:])
	return plaintext, hash, nil
}
