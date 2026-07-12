# besbpo-subsidiary-site-bellwether-architecture

Phase 4 pilot subsidiary site for Bellwether Architecture & Engineering,
forked from `besbpo-subsidiary-site-template`. Implements
`BESBPO-BLOG-ARCH-05` Phase 4 (Subsidiary Pilot Wave) — one of the 5-8
pilot sites validating the syndication contract end-to-end before the
full 30+ site rollout.

- **Division:** `built-environment`
- **Delivery mode:** `client_side` (embed widget only for this pilot —
  no build-time featured placements yet)
- **Brand:** Black, Olive, White, Red, Navy (the firm's established palette)

## Onboarding status

Not yet onboarded — `tenant_id` in `config.json` and `data-tenant-id` in
`index.html` are placeholders. See
`besbpo-blog-architecture/scripts/onboard-pilot-tenants.sh` and
`besbpo-blog-architecture/PILOT-WAVE.md` for the full process; once run
against a live `besbpo-blog-syndication-svc` instance, replace the
placeholders with the real issued `tenant_id` and enable GitHub Pages for
this repo.
