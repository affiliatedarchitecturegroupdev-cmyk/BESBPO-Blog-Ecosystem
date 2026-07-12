// Package feed implements per-tenant feed assembly and delivery. Mirrors the
// `Feed` / `ArticleSummary` schemas in
// besbpo-blog-architecture/openapi/syndication-api.yaml (Doc-02 Section 6).
package feed

import "time"

type SyndicationMeta struct {
	AttributionLine string `json:"attribution_line"`
	CanonicalRel    bool   `json:"canonical_rel"`
}

type ArticleSummary struct {
	ID                  string          `json:"id"`
	Slug                string          `json:"slug"`
	Title               string          `json:"title"`
	Excerpt             string          `json:"excerpt"`
	CanonicalURL        string          `json:"canonical_url"`
	DivisionTags        []string        `json:"division_tags"`
	HeroImage           string          `json:"hero_image,omitempty"`
	PublishedAt         time.Time       `json:"published_at"`
	ReadingTimeMinutes  int             `json:"reading_time_minutes"`
	SyndicationMeta     SyndicationMeta `json:"syndication_meta"`
}

type Pagination struct {
	NextCursor *string `json:"next_cursor"`
}

type Feed struct {
	TenantID    string           `json:"tenant_id"`
	GeneratedAt time.Time        `json:"generated_at"`
	Articles    []ArticleSummary `json:"articles"`
	Pagination  Pagination       `json:"pagination"`
}

// ArticleSource is the boundary to wherever published articles actually live
// (Phase 1: a read replica or API call against besbpo-blog-cms-api's
// Postgres database). Phase 0 ships an in-memory implementation in
// source_memory.go so the HTTP handler can be exercised end to end before
// that integration exists.
type ArticleSource interface {
	ListPublished(divisionTags []string, maxItems int, cursor string) ([]ArticleSummary, *string, error)
}
