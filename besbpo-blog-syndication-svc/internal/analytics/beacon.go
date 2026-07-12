package analytics

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
)

// BeaconHandler serves POST /api/v1/analytics/beacon — deliberately
// UNAUTHENTICATED (no tenant API key, no HMAC signature required),
// consistent with the same architectural constraint already flagged for
// besbpo-embed-widget: a secret can't safely live in a script served to
// browsers, so this platform's public-facing widget calls never carry
// one. This endpoint only ever WRITES a low-value impression/click count
// — there's nothing here for an unauthenticated caller to read.
//
// Rate limited by client IP (middleware.RequireIPRateLimit, wired in
// main.go) rather than middleware.RequireRateLimit — that one depends on
// tenant auth context this deliberately-unauthenticated endpoint doesn't
// have. A forged or replayed beacon still only ever inflates a low-stakes
// analytics count, not a security boundary, but the IP-based limit bounds
// how much any single source can do that.
type BeaconHandler struct {
	pool *pgxpool.Pool
}

func NewBeaconHandler(pool *pgxpool.Pool) *BeaconHandler {
	return &BeaconHandler{pool: pool}
}

type BeaconPayload struct {
	TenantID  string `json:"tenant_id"`
	ArticleID string `json:"article_id"`
	EventType string `json:"event_type"` // "impression" | "click_through"
}

// validateBeaconPayload is pure — no I/O — so it's independently testable
// without a real database connection, unlike almost everything else this
// handler touches.
func validateBeaconPayload(p BeaconPayload) error {
	if p.EventType != "impression" && p.EventType != "click_through" {
		return errors.New(`event_type must be "impression" or "click_through"`)
	}
	if p.TenantID == "" || p.ArticleID == "" {
		return errors.New("tenant_id and article_id are required")
	}
	return nil
}

func (h *BeaconHandler) ServeBeacon(w http.ResponseWriter, r *http.Request) {
	var payload BeaconPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, `{"error":"invalid beacon payload"}`, http.StatusBadRequest)
		return
	}

	if err := validateBeaconPayload(payload); err != nil {
		http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	if h.pool == nil {
		// In-memory backends mode (Doc-01 Section 6 fallback) — accept
		// and no-op rather than error, consistent with this platform's
		// graceful-degradation philosophy elsewhere.
		w.WriteHeader(http.StatusAccepted)
		return
	}

	_, err := h.pool.Exec(r.Context(),
		`INSERT INTO analytics_events (tenant_id, article_id, event_type) VALUES ($1::uuid, $2::uuid, $3)`,
		payload.TenantID, payload.ArticleID, payload.EventType,
	)
	if err != nil {
		// A bad tenant_id/article_id (not valid UUIDs, or not existing
		// rows — the foreign keys are nullable but a malformed UUID
		// literal still fails to parse) ends up here too. Not worth
		// distinguishing from a genuine DB error for a fire-and-forget
		// beacon — either way the caller doesn't retry.
		http.Error(w, `{"error":"failed to record beacon"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusAccepted)
}
