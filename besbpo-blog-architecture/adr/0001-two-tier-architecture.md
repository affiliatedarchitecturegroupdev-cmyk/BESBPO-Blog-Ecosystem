# ADR 0001: Two-Tier Architecture (Static GitHub Pages + Dynamic Coolify/AWS)

**Status:** Accepted
**Implements:** Master Architecture Document, Sections 2–5

## Context

Besbpo Group needs one corporate blog (blog.besbpo.co.za) whose content is
syndicated to 30+ subsidiary/divisional websites. GitHub Pages is free, fast,
and simple, but serves static files only — no server-side code, no database
queries, no per-request auth. The syndication requirement, editorial workflow,
and AI-assisted authoring are all inherently dynamic.

## Decision

Split the system into two tiers:

- **Tier 1 (static):** blog.besbpo.co.za's public pages and every subsidiary
  site, hosted on GitHub Pages. Rebuilt on publish events or on a normal push.
- **Tier 2 (dynamic):** the CMS core, syndication distribution service,
  content intelligence, search/media, and enterprise integration — all
  self-hosted via Coolify on AWS.

Tier 1 talks to Tier 2 only through the Syndication API (cached feed reads)
and `repository_dispatch` rebuild triggers. Tier 1 never talks to the CMS
core, Postgres, or any internal service directly.

## Consequences

- 30+ public sites stay cheap, resilient, and simple to reason about.
- All genuinely hard engineering (auth, workflow, AI, search) lives in one
  place, under our control, instead of being smeared across 30+ static repos.
- We accept an extra network hop (feed API) for syndicated content instead of
  direct DB access — an acceptable and deliberate trade for the isolation it buys.
