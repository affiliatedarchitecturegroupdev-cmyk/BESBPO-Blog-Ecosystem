package feed

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/besbpo-group/besbpo-blog-syndication-svc/internal/middleware"
)

// CMSArticleSource implements ArticleSource by calling besbpo-blog-cms-api's
// GET /articles endpoint (see besbpo-blog-cms-api's ArticlesController and
// besbpo-blog-architecture/openapi/syndication-api.yaml). This replaces
// InMemoryArticleSource (source_memory.go) for anything beyond local
// development/tests.
//
// AUTH NOTE (Phase 9): authenticates via a short-lived, self-signed admin
// JWT (middleware.SignAdminJWT), minted fresh per request rather than
// reused — matching besbpo-blog-cms-api's GET /articles, which is guarded
// by JwtAuthGuard + RolesGuard and requires a genuine signed JWT carrying
// an authorized role. This replaces a static bearer token from Phase 3
// that stopped working the moment that guard was added (a Docker Compose
// integration review found this; see besbpo-blog-cms-api's README for the
// matching note from its side). adminJWTSecret must match cms-api's
// JWT_SECRET — same shared-secret convention as everywhere else this
// service signs/verifies HS256 tokens (see middleware/jwt.go's header
// comment).
type CMSArticleSource struct {
	baseURL        string
	httpClient     *http.Client
	adminJWTSecret string
}

func NewCMSArticleSource(baseURL string, adminJWTSecret string) *CMSArticleSource {
	return &CMSArticleSource{
		baseURL:        strings.TrimRight(baseURL, "/"),
		httpClient:     &http.Client{Timeout: 5 * time.Second},
		adminJWTSecret: adminJWTSecret,
	}
}

// cmsArticleResponse mirrors the shape ArticlesController.findAll returns
// in besbpo-blog-cms-api (see ArticleSummary in
// besbpo-blog-architecture/openapi/syndication-api.yaml) — a small
// unexported shadow of ArticleSummary so this file can decode the CMS
// core's actual field names independently of any drift in the public
// syndication schema.
type cmsArticleResponse struct {
	ID                 string   `json:"id"`
	Slug               string   `json:"slug"`
	Title              string   `json:"title"`
	Excerpt            string   `json:"excerpt"`
	CanonicalURL       string   `json:"canonical_url"`
	DivisionTags       []string `json:"division_tags"`
	HeroImage          string   `json:"hero_image"`
	PublishedAt        string   `json:"published_at"`
	ReadingTimeMinutes int      `json:"reading_time_minutes"`
}

// ListPublished implements the ArticleSource interface (model.go). It asks
// the CMS core for published articles matching ANY of the given division
// tags.
//
// PHASE 4 TODO for OpenHands: besbpo-blog-cms-api's ArticlesController
// currently only supports a single `?division=` value (see
// articles.controller.ts) — it does not yet accept multiple divisions or
// OR-matching in one call. This method works around that by calling the
// CMS core once per division tag and de-duplicating client-side, which is
// correct but does N calls instead of 1. Once the CMS core supports
// `?division=a,b,c` OR-matching, simplify this to a single call.
func (s *CMSArticleSource) ListPublished(divisionTags []string, maxItems int, cursor string) ([]ArticleSummary, *string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	seen := make(map[string]struct{})
	var combined []ArticleSummary

	tagsToQuery := divisionTags
	if len(tagsToQuery) == 0 {
		tagsToQuery = []string{""} // no division filter — fetch all published articles
	}

	for _, division := range tagsToQuery {
		articles, err := s.fetchByDivision(ctx, division)
		if err != nil {
			return nil, nil, err
		}
		for _, a := range articles {
			if _, dup := seen[a.ID]; dup {
				continue
			}
			seen[a.ID] = struct{}{}
			combined = append(combined, a)
			if len(combined) >= maxItems {
				break
			}
		}
		if len(combined) >= maxItems {
			break
		}
	}

	// Phase 3: no real pagination cursor yet, matching the honesty of
	// InMemoryArticleSource's Phase 0 stub — see the PHASE 4 TODO above,
	// which should land alongside real multi-division query support.
	_ = cursor
	return combined, nil, nil
}

func (s *CMSArticleSource) fetchByDivision(ctx context.Context, division string) ([]ArticleSummary, error) {
	reqURL := fmt.Sprintf("%s/articles?status=published", s.baseURL)
	if division != "" {
		reqURL += "&division=" + url.QueryEscape(division)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("building CMS request: %w", err)
	}

	// Short-lived (5m) — this call is made fresh per feed request anyway
	// (no token caching/reuse across requests), so there's no benefit to a
	// longer-lived token and real downside (a longer-lived leaked token is
	// a bigger exposure window) to one.
	token, err := middleware.SignAdminJWT("besbpo-blog-syndication-svc", []string{"syndication_admin"}, s.adminJWTSecret, 5*time.Minute)
	if err != nil {
		return nil, fmt.Errorf("signing CMS auth token: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")

	res, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("calling besbpo-blog-cms-api: %w", err)
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("besbpo-blog-cms-api returned %d for %s", res.StatusCode, reqURL)
	}

	var raw []cmsArticleResponse
	if err := json.NewDecoder(res.Body).Decode(&raw); err != nil {
		return nil, fmt.Errorf("decoding besbpo-blog-cms-api response: %w", err)
	}

	articles := make([]ArticleSummary, 0, len(raw))
	for _, a := range raw {
		publishedAt, err := time.Parse(time.RFC3339, a.PublishedAt)
		if err != nil {
			// Skip rather than fail the whole batch over one malformed
			// timestamp — log-worthy in a real deployment, but Phase 3
			// keeps this file focused on the happy path plumbing.
			continue
		}
		articles = append(articles, ArticleSummary{
			ID:                 a.ID,
			Slug:               a.Slug,
			Title:              a.Title,
			Excerpt:            a.Excerpt,
			CanonicalURL:       a.CanonicalURL,
			DivisionTags:       a.DivisionTags,
			HeroImage:          a.HeroImage,
			PublishedAt:        publishedAt,
			ReadingTimeMinutes: a.ReadingTimeMinutes,
			SyndicationMeta: SyndicationMeta{
				AttributionLine: "Originally published by Besbpo Group",
				CanonicalRel:    true,
			},
		})
	}
	return articles, nil
}
