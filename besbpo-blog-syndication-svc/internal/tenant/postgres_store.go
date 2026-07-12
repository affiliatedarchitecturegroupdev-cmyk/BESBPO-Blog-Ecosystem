// Postgres-backed implementation of the tenant.Store interface (Phase 0's
// store.go), against the schema in besbpo-blog-architecture/db/schema.sql.
//
// SCHEMA BRIDGING NOTE: the `tenants` table does NOT have a division_tags
// column — divisions are normalised via `tenant_subscriptions` (tenant_id,
// division_id) joined to `divisions` (id, key, label). The Tenant struct's
// DivisionTags []string field (matching the public API shape in
// besbpo-blog-architecture/openapi/syndication-api.yaml) is denormalised
// on read via array_agg, and re-normalised on write by resolving each
// division key to a divisions.id before upserting tenant_subscriptions
// rows. This bridging logic lives entirely in this file — callers of the
// Store interface never need to know the underlying schema is normalised.
//
// UUID note: every uuid column is explicitly cast to ::text in SQL rather
// than relying on pgx's implicit uuid<->string type mapping, so scanning
// into Go string fields is unambiguous regardless of pgx's default type
// registration for uuid.
package tenant

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresStore struct {
	pool *pgxpool.Pool
}

// NewPostgresStore wraps an already-connected pgxpool.Pool. Building the
// pool itself (reading DATABASE_URL, setting pool size limits, etc.) is
// main.go's job — this type only knows how to query it.
func NewPostgresStore(pool *pgxpool.Pool) *PostgresStore {
	return &PostgresStore{pool: pool}
}

const selectTenantColumns = `
	t.id::text, t.name, t.domain, t.display_config, t.delivery_mode::text, t.status::text,
	t.api_key_hash, COALESCE(t.github_repo, ''), t.created_at, t.updated_at,
	COALESCE(array_agg(d.key) FILTER (WHERE d.key IS NOT NULL), '{}') AS division_tags
`

const selectTenantFrom = `
	FROM tenants t
	LEFT JOIN tenant_subscriptions ts ON ts.tenant_id = t.id
	LEFT JOIN divisions d ON d.id = ts.division_id
`

const selectTenantGroupBy = `GROUP BY t.id`

func scanTenant(row pgx.Row) (Tenant, error) {
	var t Tenant
	var displayConfigJSON []byte

	err := row.Scan(
		&t.ID, &t.Name, &t.Domain, &displayConfigJSON, &t.DeliveryMode, &t.Status,
		&t.APIKeyHash, &t.GitHubRepo, &t.CreatedAt, &t.UpdatedAt,
		&t.DivisionTags,
	)
	if err != nil {
		return Tenant{}, err
	}

	if len(displayConfigJSON) > 0 {
		if err := json.Unmarshal(displayConfigJSON, &t.DisplayConfig); err != nil {
			return Tenant{}, fmt.Errorf("decoding display_config: %w", err)
		}
	}

	return t, nil
}

func (s *PostgresStore) Get(ctx context.Context, id string) (Tenant, error) {
	sql := "SELECT " + selectTenantColumns + selectTenantFrom + " WHERE t.id::text = $1 " + selectTenantGroupBy
	row := s.pool.QueryRow(ctx, sql, id)
	t, err := scanTenant(row)
	if err != nil {
		if err == pgx.ErrNoRows {
			return Tenant{}, ErrNotFound
		}
		return Tenant{}, err
	}
	return t, nil
}

func (s *PostgresStore) GetByAPIKeyHash(ctx context.Context, apiKeyHash string) (Tenant, error) {
	sql := "SELECT " + selectTenantColumns + selectTenantFrom + " WHERE t.api_key_hash = $1 " + selectTenantGroupBy
	row := s.pool.QueryRow(ctx, sql, apiKeyHash)
	t, err := scanTenant(row)
	if err != nil {
		if err == pgx.ErrNoRows {
			return Tenant{}, ErrNotFound
		}
		return Tenant{}, err
	}
	return t, nil
}

func (s *PostgresStore) List(ctx context.Context) ([]Tenant, error) {
	sql := "SELECT " + selectTenantColumns + selectTenantFrom + selectTenantGroupBy + " ORDER BY t.name ASC"
	rows, err := s.pool.Query(ctx, sql)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tenants []Tenant
	for rows.Next() {
		t, err := scanTenant(rows)
		if err != nil {
			return nil, err
		}
		tenants = append(tenants, t)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return tenants, nil
}

func (s *PostgresStore) Create(ctx context.Context, t Tenant) (Tenant, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Tenant{}, fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback(ctx) // no-op if Commit succeeds first

	displayConfigJSON, err := json.Marshal(t.DisplayConfig)
	if err != nil {
		return Tenant{}, fmt.Errorf("encoding display_config: %w", err)
	}

	var newID string
	insertSQL := `
		INSERT INTO tenants (name, domain, display_config, delivery_mode, status, api_key_hash, github_repo)
		VALUES ($1, $2, $3, $4::delivery_mode, $5::tenant_status, $6, NULLIF($7, ''))
		RETURNING id::text
	`
	err = tx.QueryRow(ctx, insertSQL,
		t.Name, t.Domain, displayConfigJSON, string(t.DeliveryMode), string(t.Status), t.APIKeyHash, t.GitHubRepo,
	).Scan(&newID)
	if err != nil {
		return Tenant{}, fmt.Errorf("inserting tenant: %w", err)
	}

	if err := replaceTenantSubscriptions(ctx, tx, newID, t.DivisionTags); err != nil {
		return Tenant{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return Tenant{}, fmt.Errorf("committing transaction: %w", err)
	}

	return s.Get(ctx, newID)
}

func (s *PostgresStore) Update(ctx context.Context, t Tenant) (Tenant, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Tenant{}, fmt.Errorf("beginning transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	displayConfigJSON, err := json.Marshal(t.DisplayConfig)
	if err != nil {
		return Tenant{}, fmt.Errorf("encoding display_config: %w", err)
	}

	updateSQL := `
		UPDATE tenants
		SET name = $1, domain = $2, display_config = $3, delivery_mode = $4::delivery_mode,
		    status = $5::tenant_status, github_repo = NULLIF($6, ''), updated_at = now()
		WHERE id::text = $7
	`
	tag, err := tx.Exec(ctx, updateSQL,
		t.Name, t.Domain, displayConfigJSON, string(t.DeliveryMode), string(t.Status), t.GitHubRepo, t.ID,
	)
	if err != nil {
		return Tenant{}, fmt.Errorf("updating tenant: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return Tenant{}, ErrNotFound
	}

	if err := replaceTenantSubscriptions(ctx, tx, t.ID, t.DivisionTags); err != nil {
		return Tenant{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return Tenant{}, fmt.Errorf("committing transaction: %w", err)
	}

	return s.Get(ctx, t.ID)
}

// replaceTenantSubscriptions resolves each division key to a divisions.id
// and replaces the tenant's full set of tenant_subscriptions rows within
// the given transaction. A full replace (delete-then-insert) is simpler
// and safe here since subscription changes are low-frequency admin
// operations (Doc-02 Section 3 step 6), not a hot path needing a more
// surgical diff.
func replaceTenantSubscriptions(ctx context.Context, tx pgx.Tx, tenantID string, divisionKeys []string) error {
	if _, err := tx.Exec(ctx, `DELETE FROM tenant_subscriptions WHERE tenant_id::text = $1`, tenantID); err != nil {
		return fmt.Errorf("clearing existing subscriptions: %w", err)
	}

	for _, key := range divisionKeys {
		var divisionID string
		err := tx.QueryRow(ctx, `SELECT id::text FROM divisions WHERE key = $1`, key).Scan(&divisionID)
		if err != nil {
			if err == pgx.ErrNoRows {
				return fmt.Errorf("unknown division key %q: not present in divisions table", key)
			}
			return fmt.Errorf("looking up division %q: %w", key, err)
		}

		_, err = tx.Exec(ctx,
			`INSERT INTO tenant_subscriptions (tenant_id, division_id) VALUES ($1::uuid, $2::uuid)`,
			tenantID, divisionID,
		)
		if err != nil {
			return fmt.Errorf("inserting subscription for division %q: %w", key, err)
		}
	}
	return nil
}
