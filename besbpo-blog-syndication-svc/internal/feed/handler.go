package feed

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/besbpo-group/besbpo-blog-syndication-svc/internal/tenant"
)

const defaultCacheTTL = 5 * time.Minute

// Handler implements GET /api/v1/feed/{tenantId} and GET /api/v1/feed/{tenantId}.rss
// per besbpo-blog-architecture/openapi/syndication-api.yaml. Authentication
// (tenant API key + HMAC, Doc-02 Section 4) is applied by
// internal/middleware.RequireTenantAuth before this handler runs; by the time
// this code executes, the caller is assumed to be verified for the tenant ID
// in the path.
type Handler struct {
	Tenants tenant.Store
	Source  ArticleSource
	Cache   Cache
}

func NewHandler(tenants tenant.Store, source ArticleSource, cache Cache) *Handler {
	return &Handler{Tenants: tenants, Source: source, Cache: cache}
}

// resolveFeed contains the tenant-lookup, status-check, cache-lookup, and
// article-source logic shared by both the JSON and RSS serving paths
// (added in Phase 3 alongside the RSS variant — previously this logic
// lived only inside ServeFeedJSON). Returns (feed, found, error) where
// `found` distinguishes "no such tenant" (404) from a caching/internal
// error (500) so callers can choose the right status code and body format
// for their content type.
func (h *Handler) resolveFeed(r *http.Request) (Feed, bool, error) {
	tenantID := strings.TrimSuffix(r.PathValue("tenantId"), ".rss")
	if tenantID == "" {
		return Feed{}, false, errMissingTenantID
	}

	t, err := h.Tenants.Get(r.Context(), tenantID)
	if err != nil {
		return Feed{}, false, errTenantNotFound
	}

	if t.Status != tenant.StatusActive {
		// Suspended/offboarded/pending tenants get an empty feed, not an
		// error — Doc-02 Section 3 step 7 ("suspended (temporary; key
		// remains valid but feed returns empty)").
		return Feed{TenantID: t.ID, GeneratedAt: time.Now().UTC(), Articles: []ArticleSummary{}}, true, nil
	}

	maxItems := 10
	if raw := r.URL.Query().Get("max_items"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 && parsed <= 50 {
			maxItems = parsed
		}
	}
	cursor := r.URL.Query().Get("cursor")

	cacheKey := tenantID + ":" + cursor + ":" + strconv.Itoa(maxItems)
	if cached, ok := h.Cache.Get(r.Context(), cacheKey); ok {
		return cached, true, nil
	}

	articles, nextCursor, err := h.Source.ListPublished(t.DivisionTags, maxItems, cursor)
	if err != nil {
		return Feed{}, true, errBuildingFeed
	}

	result := Feed{
		TenantID:    t.ID,
		GeneratedAt: time.Now().UTC(),
		Articles:    articles,
		Pagination:  Pagination{NextCursor: nextCursor},
	}
	h.Cache.Set(r.Context(), cacheKey, result, defaultCacheTTL)

	return result, true, nil
}

// ServeFeed is the single handler registered for GET /api/v1/feed/{tenantId}
// in main.go. It dispatches to JSON or RSS rendering based on whether the
// raw path value ends in ".rss" — Go's net/http.ServeMux requires a
// wildcard to span an entire path segment, so {tenantId} and {tenantId}.rss
// can't be two different registered patterns; this is the same registered
// route doing its own suffix check instead. See the matching comment in
// internal/middleware/auth.go's RequireTenantAuth, which strips the same
// suffix before comparing the path tenant ID to the authenticated tenant.
func (h *Handler) ServeFeed(w http.ResponseWriter, r *http.Request) {
	if strings.HasSuffix(r.PathValue("tenantId"), ".rss") {
		h.serveFeedRSS(w, r)
		return
	}
	h.serveFeedJSON(w, r)
}

func (h *Handler) serveFeedJSON(w http.ResponseWriter, r *http.Request) {
	result, found, err := h.resolveFeed(r)
	if err != nil {
		writeFeedError(w, found, err)
		return
	}
	writeJSON(w, result)
}

// serveFeedRSS renders GET /api/v1/feed/{tenantId}.rss (Doc-02 Section 5),
// sharing the same tenant/cache/article-source resolution as
// serveFeedJSON via resolveFeed, differing only in the response format.
func (h *Handler) serveFeedRSS(w http.ResponseWriter, r *http.Request) {
	result, found, err := h.resolveFeed(r)
	if err != nil {
		writeFeedError(w, found, err)
		return
	}

	xml := BuildRSSFeed(result)
	w.Header().Set("Content-Type", "application/rss+xml; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=300")
	_, _ = w.Write([]byte(xml))
}

func writeFeedError(w http.ResponseWriter, tenantFound bool, err error) {
	switch {
	case err == errMissingTenantID:
		http.Error(w, `{"error":"tenant id required"}`, http.StatusBadRequest)
	case !tenantFound:
		http.Error(w, `{"error":"tenant not found"}`, http.StatusNotFound)
	default:
		http.Error(w, `{"error":"internal error building feed"}`, http.StatusInternalServerError)
	}
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=300")
	_ = json.NewEncoder(w).Encode(v)
}
