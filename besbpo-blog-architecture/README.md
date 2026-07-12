# besbpo-blog-architecture

**`.github/workflows/ci.yml`** now exists, and it's the single most
valuable CI addition across this whole platform: `db/schema.sql` gets
applied to a REAL Postgres instance (via `pgvector/pgvector:pg16`, since
the schema needs the pgvector extension) for the first time ever in this
platform's development — every prior check on it was static (parenthesis
balance, table-ordering checks). Also validates every JSON/YAML config
file and shell script syntax, and dry-runs the tenant onboarding script.
Closes a gap named throughout this platform's development: "no CI/CD
pipeline has ever actually triggered."

Source of truth for the Besbpo Group Corporate Blog & Content Syndication Platform.
This repo has no runtime code of its own — every other service repo builds *against*
what's defined here. If a change to the API contract, DB schema, or taxonomy isn't
reflected here first, it isn't real yet.

## Contents

| Path | Purpose |
|---|---|
| `adr/` | Architecture Decision Records — why we made the calls we made |
| `openapi/syndication-api.yaml` | OpenAPI 3.0 contract for the Syndication API (Document 2) |
| `db/schema.sql` | PostgreSQL DDL for the CMS core schema (Document 3, Section 4) |
| `db/seed_divisions.sql` | Seed data for the division taxonomy (Document 3, Section 5) |
| `taxonomy/divisions.seed.json` | Same taxonomy, as JSON, for services that seed programmatically |
| `PILOT-WAVE.md` | Phase 4 Subsidiary Pilot Wave — the 5 pilot sites, onboarding process, verification checklist |
| `FULL-ROLLOUT.md` | Phase 8 Full Rollout — honest scoping note on the remaining 30+ subsidiaries, the analytics dashboard, onboarding-at-scale tooling |
| `scripts/onboard-pilot-tenants.sh` | Onboards tenants via the real Admin API (not hand-written SQL) — supports `--dry-run` and `--file <manifest>` (generalized in Phase 8; defaults to `pilot-tenants.json`) |
| `scripts/pilot-tenants.json` | The 5 pilot tenants' onboarding payloads |
| `scripts/full-rollout-tenants.template.json` | Copy-and-fill-in template for onboarding real additional subsidiaries |
| `scripts/scaffold-subsidiary-site.sh` | Generates a new subsidiary site repo from the template, substituting real company details |

## Related planning documents

This repo implements the architecture defined in the five-document planning suite:

1. Master Architecture Document
2. Syndication API & Tenant Onboarding Specification
3. CMS Data Model & Feature Specification
4. Infrastructure & DevOps Plan
5. Phase 0 Execution Roadmap

Every ADR and schema change in this repo should reference the section of those
documents it implements or supersedes.

## How to propose a change

1. Open a PR here first if the change affects the API contract, DB schema, or taxonomy.
2. Get it reviewed and merged (human approval required — see Document 5, Section 2).
3. Only then should dependent service repos (`besbpo-blog-cms-api`,
   `besbpo-blog-syndication-svc`, etc.) implement against the new contract.
