// Package analytics implements the syndication analytics summary described
// in Doc-03 Section 8: "syndication_events and analytics_events feed a
// reporting view ... showing, per division and per tenant: articles
// syndicated, feed reads, and ... click-through from the embed widget back
// to the canonical article." Consumed by besbpo-editorial-dashboard.
package analytics

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type TenantSummary struct {
	TenantID string `json:"tenant_id"`
	Name     string `json:"name"`
	// BuildTimeDispatches counts syndication_events of type
	// 'dispatch_sent' — deliberately NOT labelled "articles_syndicated":
	// a client_side-delivery-mode tenant (Doc-02 Section 2) never
	// receives a dispatch_sent event at all (see
	// besbpo-blog-syndication-svc's internal/webhook/handler.go — dispatch
	// only fires for build_time/both tenants), so this metric would
	// silently read zero for most tenants and mislead a reader into
	// thinking they'd received nothing. FeedReads/ClickThroughs (below)
	// are the metrics that actually reflect client_side delivery too.
	BuildTimeDispatches int `json:"build_time_dispatches"`
	FeedReads           int `json:"feed_reads"`
	ClickThroughs       int `json:"click_throughs"`
}

type DivisionSummary struct {
	Division          string `json:"division"`
	PublishedArticles int    `json:"published_articles"`
	FeedReads         int    `json:"feed_reads"`
	ClickThroughs     int    `json:"click_throughs"`
}

type Summary struct {
	GeneratedAt time.Time         `json:"generated_at"`
	Tenants     []TenantSummary   `json:"tenants"`
	Divisions   []DivisionSummary `json:"divisions"`
}

type Service struct {
	// pool is nil in UseInMemoryBackends mode (Doc-01 Section 6 in-memory
	// fallback) — FetchSummary returns an empty-but-valid Summary rather
	// than erroring, consistent with this platform's graceful-degradation
	// philosophy elsewhere (besbpo-blog-web's fixture fallback, the
	// intelligence service's heuristic fallback, etc.).
	pool *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

func (s *Service) FetchSummary(ctx context.Context) (Summary, error) {
	if s.pool == nil {
		return Summary{GeneratedAt: time.Now().UTC(), Tenants: []TenantSummary{}, Divisions: []DivisionSummary{}}, nil
	}

	tenants, err := s.fetchTenantSummaries(ctx)
	if err != nil {
		return Summary{}, err
	}

	divisions, err := s.fetchDivisionSummaries(ctx)
	if err != nil {
		return Summary{}, err
	}

	return Summary{GeneratedAt: time.Now().UTC(), Tenants: tenants, Divisions: divisions}, nil
}

// fetchTenantSummaries deliberately pre-aggregates syndication_events and
// analytics_events in SEPARATE CTEs before joining to tenants, rather than
// joining both event tables directly to tenants in one query. Joining two
// independent one-to-many relationships (a tenant has many
// syndication_events AND many analytics_events) in a single query produces
// a fan-out: every syndication_event row would be cross-joined against
// every analytics_event row for that tenant, inflating every count by a
// multiple of the other table's row count. Aggregating each table to one
// row per tenant FIRST, then joining those already-aggregated results,
// avoids that entirely.
func (s *Service) fetchTenantSummaries(ctx context.Context) ([]TenantSummary, error) {
	const query = `
		WITH syndication_counts AS (
			SELECT tenant_id, COUNT(*) AS build_time_dispatches
			FROM syndication_events
			WHERE event_type = 'dispatch_sent'
			GROUP BY tenant_id
		),
		analytics_counts AS (
			SELECT
				tenant_id,
				COUNT(*) FILTER (WHERE event_type = 'impression') AS feed_reads,
				COUNT(*) FILTER (WHERE event_type = 'click_through') AS click_throughs
			FROM analytics_events
			GROUP BY tenant_id
		)
		SELECT
			t.id::text,
			t.name,
			COALESCE(sc.build_time_dispatches, 0),
			COALESCE(ac.feed_reads, 0),
			COALESCE(ac.click_throughs, 0)
		FROM tenants t
		LEFT JOIN syndication_counts sc ON sc.tenant_id = t.id
		LEFT JOIN analytics_counts ac ON ac.tenant_id = t.id
		ORDER BY t.name ASC
	`

	rows, err := s.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	summaries := make([]TenantSummary, 0)
	for rows.Next() {
		var ts TenantSummary
		if err := rows.Scan(&ts.TenantID, &ts.Name, &ts.BuildTimeDispatches, &ts.FeedReads, &ts.ClickThroughs); err != nil {
			return nil, err
		}
		summaries = append(summaries, ts)
	}
	return summaries, rows.Err()
}

// fetchDivisionSummaries joins through articles (division_tags lives
// there, not on either event table) via CROSS JOIN LATERAL UNNEST to
// explode each article's division_tags array into one row per division —
// the standard, unambiguous Postgres idiom for this, safer than
// referencing unnest() separately in SELECT and GROUP BY (which can
// evaluate the set-returning function twice, inconsistently). Analytics
// are pre-aggregated per-article in a CTE first, for the same fan-out
// reason as fetchTenantSummaries above.
func (s *Service) fetchDivisionSummaries(ctx context.Context) ([]DivisionSummary, error) {
	const query = `
		WITH analytics_by_article AS (
			SELECT
				article_id,
				COUNT(*) FILTER (WHERE event_type = 'impression') AS feed_reads,
				COUNT(*) FILTER (WHERE event_type = 'click_through') AS click_throughs
			FROM analytics_events
			GROUP BY article_id
		)
		SELECT
			d.division,
			COUNT(DISTINCT a.id) AS published_articles,
			COALESCE(SUM(ac.feed_reads), 0) AS feed_reads,
			COALESCE(SUM(ac.click_throughs), 0) AS click_throughs
		FROM articles a
		CROSS JOIN LATERAL UNNEST(a.division_tags) AS d(division)
		LEFT JOIN analytics_by_article ac ON ac.article_id = a.id
		WHERE a.status = 'published'
		GROUP BY d.division
		ORDER BY d.division ASC
	`

	rows, err := s.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	summaries := make([]DivisionSummary, 0)
	for rows.Next() {
		var ds DivisionSummary
		if err := rows.Scan(&ds.Division, &ds.PublishedArticles, &ds.FeedReads, &ds.ClickThroughs); err != nil {
			return nil, err
		}
		summaries = append(summaries, ds)
	}
	return summaries, rows.Err()
}
