package analytics

import (
	"encoding/json"
	"net/http"
)

// Handler serves GET /api/v1/analytics/summary — guarded by
// middleware.RequireAdminJWT in main.go, since this is Corporate Comms /
// Syndication Admin reporting data (Doc-03 Section 8), not something any
// tenant or the public should read.
type Handler struct {
	Service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{Service: service}
}

func (h *Handler) ServeSummary(w http.ResponseWriter, r *http.Request) {
	summary, err := h.Service.FetchSummary(r.Context())
	if err != nil {
		http.Error(w, `{"error":"failed to fetch analytics summary"}`, http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(summary)
}
