# Phase 8: Full Rollout

Implements `BESBPO-BLOG-ARCH-05` (Phase 0 Execution Roadmap) Phase 8:
"Remaining subsidiary sites onboarded (targeting the full 30+); syndication
analytics dashboard (Doc-03 Section 8) live for Corporate Comms."

## A deliberate scoping decision, stated plainly

This phase does **not** fabricate 25+ additional subsidiary sites to hit
"30+." The 5 Phase 4 pilots (`PILOT-WAVE.md`) are real Besbpo Group
ventures — Bellwether Architecture & Engineering, BEIE, Garlaws, Lastmile
Gig, Bouncer VIP Express — grounded in real names, real domains where
known, real fleet/pricing/brand details. Inventing 25 more fictional
companies to pad out a number would mean shipping fake business entities
into a real codebase, which is actively counterproductive: it would need
to be found and removed later, and it would clutter a genuine deliverable
with noise that looks real at a glance.

**What this phase actually delivers instead:**

1. The syndication analytics dashboard (`besbpo-editorial-dashboard`) —
   real, live, see below.
2. Tooling that makes onboarding the *real* remaining subsidiaries fast
   once their actual names/domains/branding exist — a scaffolding script
   and a generalized onboarding script — rather than a list of fake ones.
3. This document, so the gap between "30+ subsidiaries" and "5 onboarded"
   is visible and explained, not silently glossed over.

## Onboarding a real remaining subsidiary (once you have one)

```bash
cd besbpo-blog-architecture/scripts

# 1. Scaffold the site repo from the template
./scaffold-subsidiary-site.sh <slug> "<Company Name>" <division1,division2> [placement]
# e.g.:
./scaffold-subsidiary-site.sh acme-logistics "Acme Logistics (Pty) Ltd" logistics timeline

# 2. Add a real entry to a manifest (copy the template, fill in real values)
cp full-rollout-tenants.template.json full-rollout-tenants.json
# edit full-rollout-tenants.json — delete the REPLACE ME placeholder entry,
# add one real object per subsidiary, matching pilot-tenants.json's shape

# 3. Review before sending anything
./onboard-pilot-tenants.sh --file full-rollout-tenants.json --dry-run

# 4. Onboard for real, against a live syndication service
ADMIN_JWT=<token> ./onboard-pilot-tenants.sh --file full-rollout-tenants.json

# 5. Copy the returned tenant_id/api_key into each site's config.json and
#    index.html (the scaffolding script leaves these as placeholders on
#    purpose — see PILOT-WAVE.md's onboarding process for why: the admin
#    API is the one source of truth for tenant_id/api_key, not something
#    the scaffolding step should guess or generate itself).
```

`onboard-pilot-tenants.sh` was generalized in this phase (was pilot-wave-
specific) to accept `--file <manifest>` for exactly this — see that
script's own header comment. Running it with no `--file` still onboards
`pilot-tenants.json` exactly as before (verified: both modes produce
identical, correct output via `--dry-run`).

## What's actually needed to hit "30+" for real

A list, from Fortune, of the remaining subsidiaries with:
- Legal/trading name
- Own domain (subsidiaries keep their own branding — see Doc-01 Section 4)
- Which division(s) they belong to (existing 11, or a new one via an ADR —
  see `adr/0003-add-security-services-division.md` for the precedent
  Bouncer VIP Express set)
- Delivery mode preference (`client_side` is simplest to start with;
  `build_time`/`both` need `GITHUB_DISPATCH_TOKEN` configured first)

Nothing about the tooling above is blocked on anything except that list.

## Syndication analytics dashboard — live, for real

Implements Doc-03 Section 8. Two new pieces:

- **`besbpo-blog-syndication-svc`**: `internal/analytics/` — a new
  package with `GET /api/v1/analytics/summary` (admin-only; per-tenant
  and per-division aggregates from `syndication_events` +
  `analytics_events`) and `POST /api/v1/analytics/beacon` (public,
  unauthenticated — see that package's doc comments for why, and for a
  real fan-out bug the query design deliberately avoids: joining two
  independent event tables directly to `tenants` in one query would
  cross-multiply their row counts against each other. Pre-aggregating
  each in its own CTE first, then joining the aggregates, avoids it).
- **`besbpo-embed-widget`**: now sends `impression` and `click_through`
  beacons to that endpoint — closing the loop from "a reader saw/clicked
  an article on a subsidiary site" to "Corporate Comms can see that."
- **`besbpo-editorial-dashboard`** (new repo): the actual dashboard.
  Closes a gap flagged since Phase 2 — `besbpo-blog-web`'s
  `app/dashboard/page.tsx` placeholder documented that a page needing a
  server-side secret can't live in a statically-exported site. This is
  that page's real home: a genuine Next.js server, deployed on Coolify.

See that repo's own README for its specific scope, auth stand-in (a
single server-side admin JWT, not real per-user SSO — deliberately
deferred, matching `besbpo-blog-enterprise-svc`'s Phase 7 decision), and
what was genuinely tested (12 tests: 7 for the pure sort/format helpers,
5 real `react-dom/server` component renders).

## Known gap, carried forward honestly

The beacon endpoint has no rate limiting yet (documented in
`besbpo-blog-syndication-svc`'s `main.go` and `internal/analytics/beacon.go`)
— the existing rate limiter middleware depends on tenant-auth context this
deliberately-unauthenticated endpoint doesn't have. Fine for a handful of
pilot tenants; worth a real per-IP or per-tenant-id limiter before this
carries production traffic at 30+-site scale.
