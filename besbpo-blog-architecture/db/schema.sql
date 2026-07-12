-- Besbpo Group Blog & Syndication Platform
-- Core PostgreSQL schema. Implements BESBPO-BLOG-ARCH-03, Section 4.
-- Requires: pgvector extension for the articles.embedding column.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- ==========================================================================
-- divisions: taxonomy nodes (Doc-03 Section 5)
-- ==========================================================================
CREATE TABLE divisions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key             TEXT NOT NULL UNIQUE,          -- e.g. 'built-environment'
    label           TEXT NOT NULL,                 -- e.g. 'Built Environment'
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================================================
-- users: real per-user identity (Doc-01 Section 8 / Doc-04 Section 5)
--
-- Deliberately NOT an SSO/OIDC integration against a specific external
-- identity provider — no IdP has been chosen (see besbpo-blog-cms-api's
-- README for that standing scoping decision), and guessing one isn't a
-- substitute for that decision being made. This is genuine per-user
-- identity in the narrower, still-real sense: an actual login with a
-- hashed password and a JWT issued to the specific person who logged in,
-- replacing the single shared admin JWT every service and the dashboard
-- ran on before this. Real SSO can layer on top of this table later
-- (e.g. nulling password_hash for SSO-only accounts) without a schema
-- rewrite -- it doesn't have to be reinvented from scratch.
-- ==========================================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,                 -- bcrypt
    display_name    TEXT NOT NULL,
    roles           TEXT[] NOT NULL DEFAULT '{}',  -- Role enum values (common/enums/role.enum.ts)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================================================
-- authors
-- ==========================================================================
CREATE TABLE authors (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id),     -- now a real FK -- see the users table above
    display_name    TEXT NOT NULL,
    division_id     UUID REFERENCES divisions(id),
    bio             TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================================================
-- media_assets
-- ==========================================================================
CREATE TABLE media_assets (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    s3_key          TEXT NOT NULL,
    variants        JSONB NOT NULL DEFAULT '{}',   -- { "thumbnail": "...", "webp_1200": "..." }
    alt_text        TEXT,
    uploaded_by     UUID REFERENCES authors(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================================================
-- tags: free-form, cross-cutting (orthogonal to divisions)
-- ==========================================================================
CREATE TABLE tags (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL UNIQUE
);

-- ==========================================================================
-- articles: primary content entity (Doc-03 Section 4.1)
-- ==========================================================================
CREATE TYPE article_status AS ENUM (
    'draft', 'division_review', 'corporate_review',
    'scheduled', 'published', 'syndicated', 'archived', 'rejected'
);

CREATE TABLE articles (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug                TEXT NOT NULL UNIQUE,
    title               TEXT NOT NULL,
    excerpt             TEXT,
    excerpt_source      TEXT NOT NULL DEFAULT 'human' CHECK (excerpt_source IN ('human', 'ai_proposed', 'human_approved')),
    body_mdx            TEXT NOT NULL DEFAULT '',
    status              article_status NOT NULL DEFAULT 'draft',
    author_id           UUID NOT NULL REFERENCES authors(id),
    division_tags       TEXT[] NOT NULL DEFAULT '{}',   -- denormalised division keys for fast feed filtering
    division_tags_source TEXT NOT NULL DEFAULT 'human' CHECK (division_tags_source IN ('human', 'ai_proposed', 'human_approved')),
    hero_image_id       UUID REFERENCES media_assets(id),
    seo_meta            JSONB NOT NULL DEFAULT '{}',
    seo_meta_source     TEXT NOT NULL DEFAULT 'human' CHECK (seo_meta_source IN ('human', 'ai_proposed', 'human_approved')),
    embedding           vector(1024), -- Voyage AI's default output dimension (voyage-3.5 et al.); NOT 1536 (that's an OpenAI convention this schema mistakenly followed in Phase 0 — see besbpo-blog-intelligence-svc's embedding_service.py)
    current_version_id  UUID,   -- FK added after article_versions exists (see ALTER TABLE below)
    scheduled_at        TIMESTAMPTZ,
    published_at        TIMESTAMPTZ,
    archived_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_articles_status ON articles(status);
CREATE INDEX idx_articles_division_tags ON articles USING GIN (division_tags);
CREATE INDEX idx_articles_published_at ON articles(published_at DESC);

-- ==========================================================================
-- article_tags: many-to-many join for free-form tags
-- ==========================================================================
CREATE TABLE article_tags (
    article_id  UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    tag_id      UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (article_id, tag_id)
);

-- ==========================================================================
-- article_versions: immutable snapshot per edit/approval step (Doc-03 4.2)
-- ==========================================================================
CREATE TABLE article_versions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id      UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    snapshot        JSONB NOT NULL,           -- full article field snapshot at this point
    status_at_save  article_status NOT NULL,
    saved_by        UUID REFERENCES authors(id),
    reviewer_notes  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE articles
    ADD CONSTRAINT fk_articles_current_version
    FOREIGN KEY (current_version_id) REFERENCES article_versions(id);

-- ==========================================================================
-- tenants / tenant_subscriptions (mirrors Doc-02 tenant model)
-- ==========================================================================
CREATE TYPE tenant_status AS ENUM ('pending', 'active', 'suspended', 'offboarded');
CREATE TYPE delivery_mode AS ENUM ('client_side', 'build_time', 'both');

CREATE TABLE tenants (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    domain          TEXT NOT NULL UNIQUE,
    display_config  JSONB NOT NULL DEFAULT '{}',
    delivery_mode   delivery_mode NOT NULL DEFAULT 'client_side',
    status          tenant_status NOT NULL DEFAULT 'pending',
    api_key_hash    TEXT NOT NULL,
    github_repo     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tenant_subscriptions (
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    division_id     UUID NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
    PRIMARY KEY (tenant_id, division_id)
);

-- ==========================================================================
-- syndication_events: append-only audit/analytics log (Doc-03 Section 8)
-- ==========================================================================
CREATE TABLE syndication_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id      UUID REFERENCES articles(id),
    tenant_id       UUID REFERENCES tenants(id),
    event_type      TEXT NOT NULL,   -- 'webhook_fired' | 'dispatch_sent' | 'feed_read' | 'cache_invalidated'
    metadata        JSONB NOT NULL DEFAULT '{}',
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_synd_events_tenant ON syndication_events(tenant_id, occurred_at DESC);
CREATE INDEX idx_synd_events_article ON syndication_events(article_id, occurred_at DESC);

-- ==========================================================================
-- analytics_events: per-tenant engagement counters (Doc-03 Section 8)
-- ==========================================================================
CREATE TABLE analytics_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID REFERENCES tenants(id),
    article_id      UUID REFERENCES articles(id),
    event_type      TEXT NOT NULL,   -- 'impression' | 'click_through'
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_analytics_tenant_article ON analytics_events(tenant_id, article_id, occurred_at DESC);

-- ==========================================================================
-- audit_events: immutable log of editorial/administrative actions
-- (Doc-01 Section 8, Doc-03 Section 6's human-approval gate). Owned by
-- besbpo-blog-enterprise-svc (Phase 7) — e.g. "user X approved an
-- AI-proposed SEO field for article Y." Distinct from syndication_events
-- above, which logs syndication DELIVERY events, not editorial/admin
-- actions.
--
-- IMMUTABILITY NOTE: this table is append-only by convention (the
-- application only ever INSERTs, never UPDATEs/DELETEs — see
-- AuditService.java) but that convention isn't yet enforced at the
-- database level (e.g. via REVOKE UPDATE/DELETE on a dedicated
-- least-privilege app role). Doing that properly needs a real role/grant
-- setup this platform doesn't have yet (everything currently connects as
-- one shared `besbpo` user) — flagged here rather than silently assumed
-- to be enforced.
-- ==========================================================================
CREATE TABLE audit_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id        TEXT NOT NULL,
    action          TEXT NOT NULL,
    target_type     TEXT,
    target_id       TEXT,
    metadata_json   TEXT NOT NULL DEFAULT '{}',
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_events_actor ON audit_events(actor_id, occurred_at DESC);
CREATE INDEX idx_audit_events_target ON audit_events(target_type, target_id, occurred_at DESC);

-- ==========================================================================
-- updated_at maintenance trigger (applied to articles and tenants)
-- ==========================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_articles_updated_at
    BEFORE UPDATE ON articles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
