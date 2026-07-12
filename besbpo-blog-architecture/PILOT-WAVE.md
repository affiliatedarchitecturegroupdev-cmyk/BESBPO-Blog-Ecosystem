# Phase 4: Subsidiary Pilot Wave

Implements `BESBPO-BLOG-ARCH-05` (Phase 0 Execution Roadmap) Phase 4:
"5-8 pilot subsidiary sites onboarded from the shared template, one per
major division category, to validate the syndication contract before
wider rollout."

## The 5 pilots

| Pilot | Repo | Division(s) | Placement | Brand |
|---|---|---|---|---|
| Bellwether Architecture & Engineering | `besbpo-subsidiary-site-bellwether-architecture` | `built-environment` | `timeline` | Black/Olive/White/Red/Navy |
| Bellwether Electrical & Instrumentation Engineering (BEIE) | `besbpo-subsidiary-site-beie` | `construction`, `built-environment` | `sidebar_widget` | Green/Black/White/Navy |
| Garlaws (Pty) Ltd | `besbpo-subsidiary-site-garlaws` | `logistics` | `body_embed` | Navy/Amber |
| Lastmile Gig (Pty) Ltd | `besbpo-subsidiary-site-lastmile-gig` | `last-mile-services`, `logistics` | `timeline` | Dark/Electric-blue |
| Bouncer VIP Express (Pty) Ltd | `besbpo-subsidiary-site-bouncer-vip-express` | `security-services` (new) | `timeline` | Black/Gold |

These are real Besbpo Group ventures, not placeholder names — chosen
deliberately over generic pilot data so this wave exercises the actual
taxonomy the group will use, including a real gap it surfaced (see below).

## Why these 5, and why this deliberately isn't "one division, one look"

- **Every pilot uses a different combination of division tags and display
  placement.** Garlaws and Lastmile Gig both carry the `logistics` tag but
  use different placements (`body_embed` vs. `timeline`) and completely
  different visual brands — this is the point: the syndication contract
  (Doc-02) has to work identically underneath regardless of how wildly
  different two subscribers to the same division look and where they put
  the widget.
- **Bouncer VIP Express surfaced a real taxonomy gap.** None of the
  original 10 division categories fit a nightlife/event security venture.
  Rather than mis-filing it under `consultancy` to avoid a schema change,
  the taxonomy was extended — see
  `adr/0003-add-security-services-division.md`. Finding this kind of gap
  is exactly what a pilot wave is for; better to hit it now with one
  tenant than after 30+ are already subscribed to an incomplete taxonomy.

## Onboarding process (Doc-02 Section 3, exercised for real)

1. **Request** — represented here by each pilot's entry in
   `scripts/pilot-tenants.json`.
2. **Provisioning** — run `scripts/onboard-pilot-tenants.sh` against a live
   `besbpo-blog-syndication-svc` instance with a valid admin JWT. This
   calls the real `POST /api/v1/tenants` endpoint (Doc-02 Section 5) for
   each pilot — it does not hand-write SQL against the `tenants` table.
   Use `--dry-run` first to review the exact payloads with no network call.
3. **Integration** — copy the `tenant_id` and `api_key` the script prints
   into that pilot's `config.json` and `index.html` (replacing the
   `PENDING_ONBOARDING` placeholders), then enable GitHub Pages for the
   pilot's repo.
4. **Verification** — see the checklist below.
5. **Go-live** — once verified, the tenant's `status` moves from `pending`
   to `active` via `PATCH /api/v1/tenants/{id}` (also part of the Doc-02
   Section 5 admin surface).

## Verification checklist (Doc-05 Phase 4 acceptance criteria)

For each pilot, confirm:

- [ ] The embed widget renders the pilot's subscribed-division articles,
      themed in the pilot's own brand (not the widget's unstyled default
      — check the `.besbpo-feed__*` class hooks are actually styled in
      that pilot's `assets/style.css`).
- [ ] Every rendered article links back to its canonical URL on
      blog.besbpo.co.za (Doc-02 Section 9) — click through and confirm,
      don't just check the `href` attribute is present.
- [ ] An article tagged with a division the pilot is NOT subscribed to
      does not appear in that pilot's feed.
- [ ] The widget fails silently (renders nothing, doesn't break the page)
      if the syndication service is temporarily unreachable — this is
      more easily tested by pointing `data-tenant-id` at a nonexistent
      tenant temporarily than by actually taking the service down.
- [ ] For the Bouncer VIP Express pilot specifically: confirm an article
      tagged `security-services` actually reaches it — this is the first
      real exercise of that division end to end.

## Status as of this pass

Not yet live — this wave produced the 5 pilot site repos, the taxonomy
extension, and the onboarding tooling, but running
`onboard-pilot-tenants.sh` for real requires a deployed
besbpo-blog-syndication-svc instance with a valid admin JWT, which doesn't
exist yet outside of local/Docker Compose development (see Doc-04). Treat
this as "ready to onboard," not "onboarded."
