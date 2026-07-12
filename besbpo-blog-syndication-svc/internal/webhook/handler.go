// Package webhook implements POST /api/v1/webhooks/publish — the internal
// endpoint besbpo-blog-cms-api calls on publish/update/unpublish (Doc-02
// Section 5 & 7). It fans out to two places: cache invalidation (always) and
// repository_dispatch build triggers (only for build_time/both tenants whose
// subscription matches the article's division tags).
package webhook

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/besbpo-group/besbpo-blog-syndication-svc/internal/feed"
	"github.com/besbpo-group/besbpo-blog-syndication-svc/internal/tenant"
)

type PublishEvent string

const (
	EventPublished   PublishEvent = "published"
	EventUpdated     PublishEvent = "updated"
	EventUnpublished PublishEvent = "unpublished"
	EventArchived    PublishEvent = "archived"
)

type PublishWebhookPayload struct {
	ArticleID    string       `json:"article_id"`
	Event        PublishEvent `json:"event"`
	DivisionTags []string     `json:"division_tags"`
	OccurredAt   time.Time    `json:"occurred_at"`
}

// Dispatcher is the boundary to GitHub's repository_dispatch API. Phase 0
// ships a logging stub (see dispatcher_stub.go); Phase 1 (Doc-05) should
// implement this against the real GitHub REST API using a fine-grained PAT
// or GitHub App installation token stored in Coolify/Secrets Manager.
type Dispatcher interface {
	Dispatch(ctx context.Context, githubRepo string, articleID string) error
}

type Handler struct {
	Tenants    tenant.Store
	Cache      feed.Cache
	Dispatcher Dispatcher
}

func NewHandler(tenants tenant.Store, cache feed.Cache, dispatcher Dispatcher) *Handler {
	return &Handler{Tenants: tenants, Cache: cache, Dispatcher: dispatcher}
}

func (h *Handler) ServePublishWebhook(w http.ResponseWriter, r *http.Request) {
	var payload PublishWebhookPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, `{"error":"invalid payload"}`, http.StatusBadRequest)
		return
	}

	tenants, err := h.Tenants.List(r.Context())
	if err != nil {
		http.Error(w, `{"error":"could not list tenants"}`, http.StatusInternalServerError)
		return
	}

	for _, t := range tenants {
		if t.Status != tenant.StatusActive || !t.HasAnyDivision(payload.DivisionTags) {
			continue
		}

		// Always invalidate this tenant's cached feed so the next client-side
		// widget read picks up the change (Doc-02 Section 7 step 3).
		h.Cache.Invalidate(r.Context(), t.ID)

		// Only fire a rebuild for tenants configured for build-time syndication
		// (Doc-02 Section 7 step 4).
		if t.DeliveryMode == tenant.DeliveryBuildTime || t.DeliveryMode == tenant.DeliveryBoth {
			if t.GitHubRepo == "" {
				log.Printf("tenant %s is build_time/both but has no github_repo configured; skipping dispatch", t.ID)
				continue
			}
			if err := h.Dispatcher.Dispatch(r.Context(), t.GitHubRepo, payload.ArticleID); err != nil {
				log.Printf("dispatch failed for tenant %s (%s): %v", t.ID, t.GitHubRepo, err)
			}
		}
	}

	w.WriteHeader(http.StatusAccepted)
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "accepted"})
}
