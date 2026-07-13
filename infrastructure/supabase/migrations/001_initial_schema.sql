-- Migration: 001_initial_schema
-- Description: Creates core PostgreSQL schema with pgvector extension
-- Reference: Master Plan Section 4, BESBPO-BLOG-ARCH-03

BEGIN;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ==========================================================================
-- divisions: taxonomy nodes (Doc-03 Section 5)
-- ==========================================================================
CREATE TABLE divisions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key             TEXT NOT NULL UNIQUE,
    label           TEXT NOT NULL,
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================================================
-- users: real per-user identity
-- ==========================================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    display_name    TEXT NOT NULL,
    roles           TEXT[] NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================================================
-- authors
-- ==========================================================================
CREATE TABLE authors (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id),
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
    variants        JSONB NOT NULL DEFAULT '{}',
    alt_text        TEXT,
    uploaded_by     UUID REFERENCES authors(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==========================================================================
-- tags: free-form, cross-cutting
-- ==========================================================================
CREATE TABLE tags (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL UNIQUE
);

-- ==========================================================================
-- article_status enum
-- ==========================================================================
DO $$ BEGIN
    CREATE TYPE article_status AS ENUM (
        'draft', 'division_review', 'corporate_review',
        'scheduled', 'published', 'syndicated', 'archived', 'rejected'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==========================================================================
-- articles: primary content entity
-- ==========================================================================
CREATE TABLE articles (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug                TEXT NOT NULL UNIQUE,
    title               TEXT NOT NULL,
    excerpt             TEXT,
    excerpt_source      TEXT NOT NULL DEFAULT 'human' CHECK (excerpt_source IN ('human', 'ai_proposed', 'human_approved')),
    body_mdx            TEXT NOT NULL DEFAULT '',
    status              article_status NOT NULL DEFAULT 'draft',
    author_id           UUID NOT NULL REFERENCES authors(id),
    division_tags       TEXT[] NOT NULL DEFAULT '{}',
    division_tags_source TEXT NOT NULL DEFAULT 'human' CHECK (division_tags_source IN ('human', 'ai_proposed', 'human_approved')),
    hero_image_id       UUID REFERENCES media_assets(id),
    seo_meta            JSONB NOT NULL DEFAULT '{}',
    seo_meta_source     TEXT NOT NULL DEFAULT 'human' CHECK (seo_meta_source IN ('human', 'ai_proposed', 'human_approved')),
    embedding           vector(1024),
    current_version_id  UUID,
    scheduled_at        TIMESTAMPTZ,
    published_at        TIMESTAMPTZ,
    archived_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_articles_status ON articles(status);
CREATE INDEX idx_articles_division_tags ON articles USING GIN (division_tags);
CREATE INDEX idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX idx_articles_embedding ON articles USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ==========================================================================
-- article_tags: many-to-many join for free-form tags
-- ==========================================================================
CREATE TABLE article_tags (
    article_id  UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    tag_id      UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (article_id, tag_id)
);

-- ==========================================================================
-- article_versions: immutable snapshot per edit/approval step
-- ==========================================================================
CREATE TABLE article_versions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id      UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    snapshot        JSONB NOT NULL,
    status_at_save  article_status NOT NULL,
    saved_by        UUID REFERENCES authors(id),
    reviewer_notes  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE articles
    ADD CONSTRAINT fk_articles_current_version
    FOREIGN KEY (current_version_id) REFERENCES article_versions(id);

-- ==========================================================================
-- tenant_status and delivery_mode enums
-- ==========================================================================
DO $$ BEGIN
    CREATE TYPE tenant_status AS ENUM ('pending', 'active', 'suspended', 'offboarded');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE delivery_mode AS ENUM ('client_side', 'build_time', 'both');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==========================================================================
-- tenants / tenant_subscriptions
-- ==========================================================================
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
-- syndication_events: append-only audit/analytics log
-- ==========================================================================
CREATE TABLE syndication_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id      UUID REFERENCES articles(id),
    tenant_id       UUID REFERENCES tenants(id),
    event_type      TEXT NOT NULL,
    metadata        JSONB NOT NULL DEFAULT '{}',
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_synd_events_tenant ON syndication_events(tenant_id, occurred_at DESC);
CREATE INDEX idx_synd_events_article ON syndication_events(article_id, occurred_at DESC);

-- ==========================================================================
-- analytics_events: per-tenant engagement counters
-- ==========================================================================
CREATE TABLE analytics_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id       UUID REFERENCES tenants(id),
    article_id      UUID REFERENCES articles(id),
    event_type      TEXT NOT NULL,
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_analytics_tenant_article ON analytics_events(tenant_id, article_id, occurred_at DESC);

-- ==========================================================================
-- audit_events: immutable log of editorial/administrative actions
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
-- updated_at maintenance trigger
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

COMMIT;
