// Package tenant defines the syndication tenant model. Mirrors the `Tenant`
// schema in besbpo-blog-architecture/openapi/syndication-api.yaml and the
// `tenants` table in besbpo-blog-architecture/db/schema.sql.
package tenant

import "time"

type Status string

const (
	StatusPending    Status = "pending"
	StatusActive     Status = "active"
	StatusSuspended  Status = "suspended"
	StatusOffboarded Status = "offboarded"
)

type DeliveryMode string

const (
	DeliveryClientSide DeliveryMode = "client_side"
	DeliveryBuildTime  DeliveryMode = "build_time"
	DeliveryBoth       DeliveryMode = "both"
)

type DisplayConfig struct {
	Placement string `json:"placement"` // timeline | sidebar_widget | body_embed | build_time_feature
	MaxItems  int    `json:"max_items"`
	ThemeHint string `json:"theme_hint,omitempty"`
	// HighTraffic opts a tenant into the higher rate-limit tier (300 rpm
	// vs. the 60 rpm default) — Doc-02 Section 10: "High-traffic tenant
	// ... opt-in via display_config." Set by a Syndication Admin for a
	// small number of flagship subsidiary sites expected to generate
	// heavier widget-polling traffic.
	HighTraffic bool `json:"high_traffic,omitempty"`
}

type Tenant struct {
	ID            string        `json:"tenant_id"`
	Name          string        `json:"name"`
	Domain        string        `json:"domain"`
	DivisionTags  []string      `json:"division_tags"`
	DisplayConfig DisplayConfig `json:"display_config"`
	DeliveryMode  DeliveryMode  `json:"delivery_mode"`
	Status        Status        `json:"status"`
	APIKeyHash    string        `json:"-"` // never serialised in API responses
	GitHubRepo    string        `json:"github_repo,omitempty"`
	CreatedAt     time.Time     `json:"created_at"`
	UpdatedAt     time.Time     `json:"updated_at"`
}

// HasAnyDivision reports whether the tenant subscribes to at least one of
// the given division tags — the core routing predicate for feed filtering
// (Doc-02 Section 6).
func (t Tenant) HasAnyDivision(articleDivisions []string) bool {
	subscribed := make(map[string]struct{}, len(t.DivisionTags))
	for _, d := range t.DivisionTags {
		subscribed[d] = struct{}{}
	}
	for _, d := range articleDivisions {
		if _, ok := subscribed[d]; ok {
			return true
		}
	}
	return false
}
