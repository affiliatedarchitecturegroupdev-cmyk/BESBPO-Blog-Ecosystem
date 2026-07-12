package tenant

import (
	"context"
	"errors"
	"sync"
)

var ErrNotFound = errors.New("tenant not found")

// Store is the persistence boundary for tenant data. Phase 0 ships an
// in-memory implementation so the HTTP layer and routing logic can be built
// and tested immediately; Phase 1 (Doc-05) should add a Postgres-backed
// implementation satisfying this same interface, reading the `tenants` /
// `tenant_subscriptions` tables defined in
// besbpo-blog-architecture/db/schema.sql.
type Store interface {
	Get(ctx context.Context, id string) (Tenant, error)
	GetByAPIKeyHash(ctx context.Context, apiKeyHash string) (Tenant, error)
	List(ctx context.Context) ([]Tenant, error)
	Create(ctx context.Context, t Tenant) (Tenant, error)
	Update(ctx context.Context, t Tenant) (Tenant, error)
}

// InMemoryStore is a concurrency-safe, non-persistent Store implementation.
// Suitable for local development and tests only — never use in production.
type InMemoryStore struct {
	mu      sync.RWMutex
	tenants map[string]Tenant
}

func NewInMemoryStore() *InMemoryStore {
	return &InMemoryStore{tenants: make(map[string]Tenant)}
}

func (s *InMemoryStore) Get(_ context.Context, id string) (Tenant, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	t, ok := s.tenants[id]
	if !ok {
		return Tenant{}, ErrNotFound
	}
	return t, nil
}

func (s *InMemoryStore) GetByAPIKeyHash(_ context.Context, apiKeyHash string) (Tenant, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, t := range s.tenants {
		if t.APIKeyHash == apiKeyHash {
			return t, nil
		}
	}
	return Tenant{}, ErrNotFound
}

func (s *InMemoryStore) List(_ context.Context) ([]Tenant, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]Tenant, 0, len(s.tenants))
	for _, t := range s.tenants {
		out = append(out, t)
	}
	return out, nil
}

func (s *InMemoryStore) Create(_ context.Context, t Tenant) (Tenant, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.tenants[t.ID] = t
	return t, nil
}

func (s *InMemoryStore) Update(_ context.Context, t Tenant) (Tenant, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.tenants[t.ID]; !ok {
		return Tenant{}, ErrNotFound
	}
	s.tenants[t.ID] = t
	return t, nil
}
