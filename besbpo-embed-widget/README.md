# besbpo-embed-widget

**`.github/workflows/ci.yml`** now exists — `npm install`, type check,
build, test. Closes a gap named throughout this platform's development:
"no CI/CD pipeline has ever actually triggered."

Standalone source for the client-side syndication embed widget
(`embed.js`) referenced by `BESBPO-BLOG-ARCH-02` Section 8 and embedded by
every subsidiary site built from `besbpo-subsidiary-site-template`.
Versioned and published independently of any one site so an update doesn't
require touching 30+ repos.

## ⚠️ Architectural note flagged during implementation

`src/embed.ts` currently calls the feed endpoint with only the tenant ID —
no secret credential — because embedding a secret in a script served to
browsers would leak it immediately. This is a real gap relative to
`besbpo-blog-architecture/openapi/syndication-api.yaml`, which documents a
single `tenantApiKey` (HMAC-signed secret) scheme for all callers of
`GET /api/v1/feed/{tenantId}`.

**Before this goes to production**, resolve this by amending the OpenAPI
spec (in `besbpo-blog-architecture`) to formally split feed-read auth into:

1. The existing secret `tenantApiKey`, for server-side/build-time callers
   (Doc-02 Section 7), unchanged.
2. Either an unauthenticated, rate-limited, tenant-ID-scoped public read
   path, or a separate low-privilege "publishable" token safe to embed in
   HTML (mirroring the publishable/secret key pattern used by most
   payment-provider SDKs) — for this widget.

See the full comment block at the top of `src/embed.ts`.

## What's here

- **`src/embed.ts`** — the widget: finds `#besbpo-feed` (or any
  `[data-besbpo-feed]` element), fetches that tenant's feed, renders it
  using the `.besbpo-feed__*` class hooks (styled independently by each
  subsidiary site), caches the last-known-good response in `localStorage`,
  and fails silently on error per Doc-02 Section 8. **Phase 8:** also
  reports impressions (after every render, live or cache-fallback) and
  click-throughs (on clicking a rendered article link) to
  besbpo-blog-syndication-svc's `/api/v1/analytics/beacon` — powers the
  new besbpo-editorial-dashboard's analytics view (Doc-03 Section 8).
  Uses `navigator.sendBeacon` where available (designed exactly for
  fire-and-forget telemetry that survives the page navigating away right
  after), falling back to a `keepalive` fetch. Same unauthenticated
  posture as the feed fetch itself — see the architectural note above,
  which applies here too (nothing secret can live in this script).
- **`test/`** — real behavioural tests, not type-checks: a minimal DOM shim
  (`fake-dom.ts`, deliberately just enough surface area for this one script
  — not a general jsdom replacement) lets `src/embed.ts` run its actual
  logic — `querySelectorAll`, `createElement`, `dataset`, `localStorage`,
  `addEventListener`/click simulation — without a browser. 6 tests, one
  behaviour per file (see the comment in any test file for why: this
  script mutates `globalThis` on import, so reliable isolation between
  test cases needs a process boundary, which `node --test test/*.test.ts`
  gives for free by running each matched file in its own process).
  **Two real bugs were caught by actually running these tests** while
  adding the Phase 8 beacon code, not by review alone: (1) the fake DOM
  shim had no `addEventListener` at all — every test that reaches
  `renderFeed` would have thrown the moment `embed.ts` tried to attach a
  click handler; (2) an attempt to stub `navigator.sendBeacon` as absent
  by reassigning `globalThis.navigator = {}` in the test harness threw at
  runtime — `navigator` is a getter-only property on `globalThis` in this
  Node version, not a writable one. Fixed by adding `addEventListener`
  support to the shim and, for the second issue, simply not touching
  `navigator` at all (Node's own ambient `navigator` global already lacks
  `sendBeacon`, which achieves the same deterministic fetch-fallback
  behaviour in tests without any override).

## Explicitly NOT done yet (hand this to OpenHands next)

1. Resolve the auth gap above.
2. Add the real CDN publish step to `.github/workflows/publish.yml`.
3. Add a minified/bundled build output (currently plain `tsc` output, no
   bundler/minifier).
4. The beacon endpoint it posts to has no rate limiting yet (see
   besbpo-blog-syndication-svc's README) — not something this repo can
   fix on its own, but worth knowing the full loop isn't abuse-hardened
   yet.

## Local development

```bash
npm install
npm run build   # outputs dist/embed.js
npm test        # 5 behavioural tests against a minimal DOM shim
```
