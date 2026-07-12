// Tenant admin CRUD HTTP handlers — implements the `/tenants` paths from
// besbpo-blog-architecture/openapi/syndication-api.yaml (Doc-02 Section 5):
// POST /tenants, GET /tenants/{tenantId}, PATCH /tenants/{tenantId}, and
// POST /tenants/{tenantId}/rotate-key. Guarded by
// middleware.RequireAdminJWT at the routing layer (main.go) — this file
// assumes that's already been checked by the time these handlers run.
package tenant

import (
	"encoding/json"
	"errors"
	"net/http"
)

type AdminHandler struct {
	Store Store
}

func NewAdminHandler(store Store) *AdminHandler {
	return &AdminHandler{Store: store}
}

// CreateTenantRequest mirrors the OpenAPI TenantCreateRequest schema.
type CreateTenantRequest struct {
	Name          string        `json:"name"`
	Domain        string        `json:"domain"`
	DivisionTags  []string      `json:"division_tags"`
	DisplayConfig DisplayConfig `json:"display_config"`
	DeliveryMode  DeliveryMode  `json:"delivery_mode"`
	GitHubRepo    string        `json:"github_repo"`
}

// UpdateTenantRequest mirrors the OpenAPI TenantUpdateRequest schema. All
// fields are pointers/optional so a PATCH only touches what's provided —
// status is included here even though it's not in every onboarding step,
// since Doc-02 Section 3 step 7 (suspend/offboard) updates status via this
// same endpoint.
type UpdateTenantRequest struct {
	DivisionTags  *[]string      `json:"division_tags"`
	DisplayConfig *DisplayConfig `json:"display_config"`
	DeliveryMode  *DeliveryMode  `json:"delivery_mode"`
	Status        *Status        `json:"status"`
}

// TenantCreateResponse mirrors the OpenAPI TenantCreateResponse schema —
// used for both tenant creation and key rotation (Doc-02 Section 5).
type TenantCreateResponse struct {
	Tenant Tenant `json:"tenant"`
	APIKey string `json:"api_key"`
}

func (h *AdminHandler) HandleCreate(w http.ResponseWriter, r *http.Request) {
	var req CreateTenantRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name == "" || req.Domain == "" || req.DeliveryMode == "" {
		writeError(w, http.StatusBadRequest, "name, domain, and delivery_mode are required")
		return
	}

	plaintextKey, keyHash, err := generateAPIKey()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to generate API key")
		return
	}

	newTenant := Tenant{
		Name:          req.Name,
		Domain:        req.Domain,
		DivisionTags:  req.DivisionTags,
		DisplayConfig: req.DisplayConfig,
		DeliveryMode:  req.DeliveryMode,
		Status:        StatusPending, // Doc-02 Section 3 step 2 — go-live (step 5) flips this to active
		APIKeyHash:    keyHash,
		GitHubRepo:    req.GitHubRepo,
	}

	created, err := h.Store.Create(r.Context(), newTenant)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create tenant: "+err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, TenantCreateResponse{Tenant: created, APIKey: plaintextKey})
}

func (h *AdminHandler) HandleGet(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("tenantId")
	t, err := h.Store.Get(r.Context(), id)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			writeError(w, http.StatusNotFound, "tenant not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to fetch tenant: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, t)
}

func (h *AdminHandler) HandleUpdate(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("tenantId")

	existing, err := h.Store.Get(r.Context(), id)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			writeError(w, http.StatusNotFound, "tenant not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to fetch tenant: "+err.Error())
		return
	}

	var req UpdateTenantRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.DivisionTags != nil {
		existing.DivisionTags = *req.DivisionTags
	}
	if req.DisplayConfig != nil {
		existing.DisplayConfig = *req.DisplayConfig
	}
	if req.DeliveryMode != nil {
		existing.DeliveryMode = *req.DeliveryMode
	}
	if req.Status != nil {
		existing.Status = *req.Status
	}

	updated, err := h.Store.Update(r.Context(), existing)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			writeError(w, http.StatusNotFound, "tenant not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to update tenant: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, updated)
}

func (h *AdminHandler) HandleRotateKey(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("tenantId")

	existing, err := h.Store.Get(r.Context(), id)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			writeError(w, http.StatusNotFound, "tenant not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to fetch tenant: "+err.Error())
		return
	}

	plaintextKey, keyHash, err := generateAPIKey()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to generate API key")
		return
	}
	existing.APIKeyHash = keyHash

	updated, err := h.Store.Update(r.Context(), existing)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to rotate key: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, TenantCreateResponse{Tenant: updated, APIKey: plaintextKey})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
