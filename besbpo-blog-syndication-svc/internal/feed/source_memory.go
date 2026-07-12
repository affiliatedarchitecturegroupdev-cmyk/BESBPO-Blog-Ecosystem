package feed

import "sync"

// InMemoryArticleSource is a Phase 0 stand-in for the real integration with
// besbpo-blog-cms-api. Replace with an HTTP client or a read-only Postgres
// query against the `articles` table (besbpo-blog-architecture/db/schema.sql)
// filtering `status = 'published'` and `division_tags && $1`.
type InMemoryArticleSource struct {
	mu       sync.RWMutex
	articles []ArticleSummary
}

func NewInMemoryArticleSource() *InMemoryArticleSource {
	return &InMemoryArticleSource{}
}

func (s *InMemoryArticleSource) Seed(articles []ArticleSummary) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.articles = articles
}

func (s *InMemoryArticleSource) ListPublished(divisionTags []string, maxItems int, _ string) ([]ArticleSummary, *string, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	wanted := make(map[string]struct{}, len(divisionTags))
	for _, d := range divisionTags {
		wanted[d] = struct{}{}
	}

	matched := make([]ArticleSummary, 0, maxItems)
	for _, a := range s.articles {
		if len(matched) >= maxItems {
			break
		}
		for _, tag := range a.DivisionTags {
			if _, ok := wanted[tag]; ok {
				matched = append(matched, a)
				break
			}
		}
	}
	// Phase 0: no real pagination yet — always nil cursor.
	return matched, nil, nil
}
