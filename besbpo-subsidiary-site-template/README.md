# besbpo-subsidiary-site-template

Baseline template forked/copied by each of the 30+ Besbpo Group subsidiary
sites. Implements the Tier 1 subsidiary site pattern from
`BESBPO-BLOG-ARCH-01` Section 4.2 and the client-side embed integration from
`BESBPO-BLOG-ARCH-02` Section 8.

## Using this template for a new subsidiary site

1. Copy this repo to a new one for the subsidiary (or use GitHub's "template
   repository" fork feature).
2. Request tenant onboarding from the Syndication Admin (Doc-02 Section 3) —
   you'll receive a `tenant_id` and a one-time-visible API key.
3. Fill in `config.json`: `tenant_id`, `division_tags` (must match what the
   Syndication Admin configured for this tenant), `brand_name`.
4. Replace `REPLACE_WITH_ISSUED_TENANT_ID` in `index.html`'s
   `data-tenant-id` attribute with the same tenant ID.
5. Replace the placeholder branding/copy and restyle `assets/style.css` to
   match this subsidiary's own brand — keep the `.besbpo-feed__*` class
   hooks so the embed widget picks up your styles (Doc-02 Section 8).
6. Enable GitHub Pages for the repo (Settings → Pages → GitHub Actions as
   the source) — `.github/workflows/rebuild.yml` handles the rest.

## What this template does NOT do yet

- It does not implement a build-time syndication step. If this tenant is
  configured for `build_time` or `both` delivery mode, see the TODO in
  `.github/workflows/rebuild.yml` — someone (ideally OpenHands, scoped to
  that specific subsidiary site's repo) needs to add a build step that
  calls the feed API and regenerates a featured-content section before
  deploy.
- It does not include any real brand design — this is deliberately minimal,
  unstyled HTML so it's obvious what needs replacing.
