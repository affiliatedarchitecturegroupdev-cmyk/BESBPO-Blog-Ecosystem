# ADR 0004: Embedding Provider is Voyage AI; pgvector Column is 1024-Wide, Not 1536

**Status:** Accepted
**Implements:** Doc-01 Section 9 (Content Intelligence & AI Layer);
supersedes the `vector(1536)` column width from the Phase 0 schema.

## Context

The original `db/schema.sql` (Phase 0) declared `articles.embedding` as
`vector(1536)` — a width that matches OpenAI's `text-embedding-ada-002`
and `text-embedding-3-small` models. That width was carried over from
general familiarity with pgvector tutorials, not from a decision about
which embedding provider this platform would actually use.

Phase 5 (Content Intelligence) requires making that decision for real.
Anthropic does not offer a first-party embeddings API — Claude is a
generation-only model — and officially recommends Voyage AI (now part of
MongoDB) as an embeddings partner; see
`docs.claude.com/en/docs/build-with-claude/embeddings`. Voyage's current
general-purpose models (`voyage-3.5`, `voyage-3.5-lite`, `voyage-3-large`)
default to **1024** output dimensions, with 256/512/2048 available as
alternatives via an `output_dimension` parameter. 1536 is not one of the
supported values for these models.

## Decision

- Use Voyage AI (`voyage-3.5` by default) for embeddings, called from
  `besbpo-blog-intelligence-svc`.
- Change `articles.embedding` from `vector(1536)` to `vector(1024)`,
  matching Voyage's default output dimension.
- Keep the dimension configurable in the intelligence service
  (`EMBEDDING_DIMENSIONS` env var / `Settings.embedding_dimensions`) rather
  than hardcoding 1024 in application code, so a future move to a
  different `output_dimension` (or provider) doesn't require touching
  more than config and a migration.

## Consequences

- Any environment that already ran the Phase 0 schema with `vector(1536)`
  needs a migration (`ALTER TABLE articles ALTER COLUMN embedding TYPE
  vector(1024)`) — safe only if no embeddings have been written yet, which
  is true for every environment this platform has actually been deployed
  to so far (none). If that's no longer true by the time this is read,
  treat this as a breaking migration requiring a full re-embed, not a
  transparent schema change.
- `besbpo-blog-search-media-svc`'s Rust search service (Doc-03 Section 7)
  should read `EMBEDDING_DIMENSIONS` from the same source of truth rather
  than assuming a number, once it starts querying `articles.embedding`
  directly — not yet implemented, flagged here so it's done consistently
  when that lands.
