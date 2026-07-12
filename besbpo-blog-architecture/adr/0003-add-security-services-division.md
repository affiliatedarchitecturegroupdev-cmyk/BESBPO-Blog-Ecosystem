# ADR 0003: Add "security-services" to the Division Taxonomy

**Status:** Accepted
**Implements:** Doc-03 Section 5 (taxonomy is explicitly extensible);
surfaced during Doc-05 Phase 4 (Subsidiary Pilot Wave) tenant onboarding.

## Context

The Phase 4 pilot wave onboards one subsidiary site per major division
category to validate the syndication contract end-to-end (Doc-05 Phase 4).
Bouncer VIP Express (Pty) Ltd — a nightlife/event security and VIP
protection venture — doesn't fit any of the original ten categories
(built-environment, construction, real-estate, property-development,
logistics, last-mile-services, enterprise-software, bpo, consultancy,
corporate). The closest fits (`consultancy`, `corporate`) would misfile it
in a way that makes the syndication routing (Doc-02) meaningless for any
subsidiary site actually subscribed to those tags for their intended
purpose.

## Decision

Add an eleventh division: `security-services` — "Venue and event security,
VIP protection, nightlife security operations." Added in three places that
must stay in sync (there is no single source of truth enforced in code —
see the note below):

1. `db/seed_divisions.sql` and `taxonomy/divisions.seed.json` (this repo).
2. `besbpo-blog-web/lib/fixtures/divisions.json` (fixture fallback data).
3. Referenced in the Bouncer VIP Express pilot site's `config.json`
   (`besbpo-subsidiary-site-bouncer-vip-express`).

## Consequences

- Taxonomy now has 11 categories instead of 10. Nothing in the codebase
  hardcodes a count or an exhaustive list — `divisions` is a normal
  database table and `tenant_subscriptions` references it by ID, so this
  is a pure data change, not a schema migration.
- **Process gap worth naming honestly:** there are now three independent
  copies of this seed list (architecture repo's SQL, architecture repo's
  JSON, besbpo-blog-web's fixture JSON) that must be kept manually
  consistent. A future phase should consider generating the fixture/seed
  files from one canonical source rather than hand-editing three files per
  change — flagged here rather than silently accepted as fine.
