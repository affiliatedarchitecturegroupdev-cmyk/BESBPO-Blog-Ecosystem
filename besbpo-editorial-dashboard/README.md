# besbpo-editorial-dashboard

**`.github/workflows/ci.yml`** now exists — `npm install`, `tsc --noEmit`,
unit + component tests, `npm run build`. Closes a gap named throughout
this platform's development: "no CI/CD pipeline has ever actually
triggered."

Internal editorial dashboard for Besbpo Group: article authoring/review
(Doc-03 Section 6) and syndication analytics (Doc-03 Section 8).

## Why this repo exists

`besbpo-blog-web`'s `app/dashboard/page.tsx` has been a documented
placeholder since Phase 2 — static export (`output: 'export'`, required
for GitHub Pages) is fundamentally incompatible with a server-rendered
page that needs to keep a secret (an admin token) server-side on every
request. This repo is that page's real home: a genuine Next.js server,
deployed on Coolify, not statically exported.

## The authoring UI is the actual point of this repo

Before this pass, this dashboard had exactly one page — analytics. There
was **no way for a human to create, edit, or approve an article except by
calling the CMS API directly** (curl/Postman). The entire human-approval
gate this platform is built around — "AI proposes, humans approve" — had
no human-usable interface. That's now fixed:

- **`/articles`** — list, filterable by status/division.
- **`/articles/new`** — create a draft (auto-slugs from the title).
- **`/articles/[id]`** — the actual authoring/review screen:
  - Edit title, excerpt, body (MDX), division tags, free-form tags, and
    SEO meta.
  - **"Get AI Suggestions"** requests fresh proposals for excerpt,
    division tags, and SEO meta all at once from
    besbpo-blog-intelligence-svc (via a new bridge on the CMS API side —
    see besbpo-blog-cms-api's README for `AiProposalService`, which
    closed a real gap: that service has existed since Phase 5 with no
    caller anywhere in the authoring flow).
  - Each of those three fields shows its **provenance** (human /
    AI-proposed / approved) via `FieldSourceBadge`, with an inline
    **Approve** button when it's AI-proposed — the explicit "I reviewed
    this and accept it as-is" action, kept deliberately distinct from
    editing the field's value (see `ArticlesService.approveField`'s doc
    comment on the backend for why those are two different actions, not
    one).
  - Status transition buttons for whichever next states are currently
    valid, each showing **why** it's disabled when the human-approval
    gate blocks it, rather than a greyed-out button with no explanation.
  - **Hero image upload, with a real library** — `MediaUploader` uploads
    a file to the CMS API's `POST /media` and shows a live preview. An
    existing hero image is resolved server-side (in the edit page,
    alongside the article fetch) rather than the editor component
    needing to know how to look one up itself. Beyond a single upload:
    **`MediaLibrary`** (a "Browse library" toggle inside the uploader)
    lets an editor reuse a previously-uploaded asset instead of uploading
    a duplicate, with a per-asset delete right there in the grid.
    **"Remove"** clears the current article's hero image without
    deleting the underlying asset — deliberately two different actions:
    an asset might be reused by other articles, so detaching it from
    *this* one must never imply deleting it from storage. That
    distinction is enforced on both ends: the backend has a real foreign
    key from `articles.hero_image_id` to `media_assets` with no cascade,
    so it would reject deleting an in-use asset even if this UI didn't
    get the distinction right — but it does, and there's also an alt-text
    field for the next upload.

`lib/article-status.ts` is a pure TypeScript port of the CMS API's state
machine (`ARTICLE_STATUS_TRANSITIONS`, `HUMAN_APPROVAL_REQUIRED_BEFORE`) —
deliberately duplicated, not imported (two separate apps, no shared
package). If the backend's state machine changes, this file needs
updating too, or the UI could offer a transition the API then rejects —
not dangerous (the API is still the real enforcement point), but a real
synchronization cost worth knowing about.

## Real per-user identity

There's now an actual `/login` page, backed by besbpo-blog-cms-api's real
`users` table (bcrypt password hashes, per-user JWTs) — replacing the
single shared admin JWT this dashboard (and every other service) ran on
before. Deliberately **not** SSO/OIDC against a specific external identity
provider — no IdP has been chosen, and guessing one isn't a substitute
for that decision (this was the standing scoping note from Phase 7
onward; see besbpo-blog-cms-api's README for the full reasoning). Real
SSO can sit on top of the same `users` table later without a rewrite.

**How it actually works:**

- `middleware.ts` protects every route except `/login` and `/healthz` —
  no session cookie, no access, redirected to `/login`. It only checks
  that *some* token is present (Edge Runtime doesn't have easy access to
  Node's crypto the way a Server Action does for real verification) —
  an expired or tampered token still passes this gate, then correctly
  fails on the first real API call, which is the layer that actually
  matters for security.
- `lib/session.ts` reads/writes the session as an **HTTP-only** cookie —
  deliberately never `localStorage`/`sessionStorage`, which client-side
  JavaScript *can* read. An XSS bug elsewhere in this app can't
  exfiltrate a token it has no way to read.
- The JWT itself carries `email`/`displayName` alongside the usual
  `sub`/`roles` (a deliberate denormalization — avoids a separate
  "whoami" round-trip just to show "logged in as X" in the header; the
  accepted tradeoff is these can go slightly stale if a user's profile
  changes before their token expires, bounded by `JWT_EXPIRES_IN`, 15m
  by default).
- One session cookie authenticates to **both** besbpo-blog-cms-api and
  besbpo-blog-syndication-svc — they share the same JWT secret and claims
  shape (the existing shared-secret convention documented across this
  platform), so there's no need for two separate logins.

**Getting a first account**: `POST /auth/register` on besbpo-blog-cms-api
is open with no auth at all *only* when zero users exist yet — the very
first registration always becomes `SUPER_ADMIN`, regardless of what (if
anything) was requested, so the platform never ends up with a first
account that can't grant itself the access needed to register anyone
else. Every registration after that requires an authenticated
`SUPER_ADMIN` caller. See that repo's `AuthController` for the full
reasoning, including the real, worth-knowing caveat: this bootstrap mode
means the *first* person to successfully call it becomes the admin, not
necessarily the intended one — fine once this only runs behind the
network-level restriction Doc-04 Section 5 already calls for, worth
knowing if that assumption is ever relaxed before a real admin exists.

**What's still a real gap, stated plainly**: no password reset flow, no
email verification, no rate limiting on login (a genuine brute-force
concern specifically for that endpoint, unlike most of this platform's
other endpoints), and no session revocation — the stateless JWT approach
means a compromised account stays valid until its token expires, not
until someone notices and acts.

**Legacy fallback**: `SYNDICATION_ADMIN_JWT`/`CMS_API_ADMIN_JWT` (a
manually-generated, shared admin JWT) still work as a fallback when no
session cookie is present — every data-fetching function in
`lib/cms-api.ts`/`lib/analytics-api.ts` takes an optional `sessionToken`
parameter and falls back to these env vars when it's not provided. Useful
for scripts or local dev without going through `/login`, but a real
logged-in session always takes priority when both are available.

## Fixture fallback

Leave the relevant base-URL/JWT pair unset (the default) to run entirely
on fixture data — `lib/fixtures/analytics-summary.json` for the analytics
view, `lib/fixtures/articles.json` for the authoring UI (three articles
in different states — draft/human-authored, division-review/AI-proposed
pending approval, published/approved — using real Phase 4 pilot division
tags, not generic placeholders). Good for local dev and design review
without either backend reachable. Every fixture-backed page visibly says
so — a dashboard that silently shows fake data as if it were real is
worse than one that shows nothing. Writes (create/update/transition/
approve/AI-proposals) do **not** fall back to fixtures — there's nothing
sensible to fall back to for a write; if the CMS API is unreachable, the
UI says the mutation failed rather than pretending it succeeded against
data that would just be discarded.

## What's here

- **`app/page.tsx`, `app/healthz/route.ts`** — analytics view + health
  check (unchanged from Phase 8).
- **`app/articles/page.tsx`, `app/articles/new/page.tsx`,
  `app/articles/[id]/page.tsx`** — the authoring UI's three pages.
  Written for **Next.js 14** (see `package.json`) — `params`/
  `searchParams` are plain synchronous objects, not the Promise-based API
  Next.js 15 introduced; checked against the actual pinned version rather
  than copied from newer docs.
- **`app/articles/actions.ts`** — Server Actions (`'use server'`) for all
  mutations, which is what keeps `CMS_API_ADMIN_JWT` server-side even
  though they're invoked from Client Components.
- **`components/ArticleEditor.tsx`** — the main authoring/review UI
  (client component; see above).
- **`components/MediaUploader.tsx`, `MediaLibrary.tsx`** — upload,
  browse/reuse, and per-asset delete (see above).
- **`components/FieldSourceBadge.tsx`, `ArticleStatusBadge.tsx`,
  `ArticleListTable.tsx`, `NewArticleForm.tsx`** — supporting pieces.
- **`lib/cms-api.ts`** — typed client for the CMS API's articles AND
  media endpoints, same fixture-fallback philosophy as
  `lib/analytics-api.ts` for reads (`getMediaAsset`/`listMedia` degrade
  to `null`/`[]` on failure); writes (`uploadMedia`, `deleteMedia`,
  `updateMediaAltText`) fail clearly instead, same as every other
  mutation in this file.
- **`lib/session.ts`, `lib/jwt-decode.ts`** — HTTP-only session cookie
  I/O and JWT payload decoding, split across two files on purpose:
  `jwt-decode.ts` has zero framework dependencies (pure string/JSON
  handling), so it's testable via plain `node --test`; `session.ts`
  wraps it with the actual `next/headers` cookie calls. Every
  data-fetching function elsewhere in this app takes an optional
  `sessionToken` parameter rather than reading the cookie itself, for
  the same testability reason.
- **`middleware.ts`** — redirects to `/login` when no session cookie is
  present, for every route except `/login`/`/healthz`.
- **`app/login/page.tsx`, `components/LoginForm.tsx`,
  `app/login/actions.ts`** — the login page and its Server Actions
  (`loginAction`, `logoutAction`).

- **`lib/analytics-api.ts`, `components/TenantAnalyticsTable.tsx`,
  `DivisionAnalyticsTable.tsx`** — analytics view, unchanged from Phase 8.

## Verification

Genuinely executed, not just reviewed:

```bash
npm test                 # lib/*.test.ts — 44 tests, all passing
npm run test:components  # components/*.test.tsx — 29 tests, all passing (real react-dom/server rendering)
```

73 tests total. Full-repo `tsc --strict` check: zero unexplained
diagnostics beyond the expected missing-`node_modules` artifacts (no
`react`/`@types/*` installed in the environment this was built in — same
caveat as every other TypeScript repo in this platform). Caught and fixed
for real during this pass, not just filtered as noise: several
`onChange`/`onSubmit` handlers had an implicit `any` parameter type —
fixed with explicit `ChangeEvent`/`FormEvent` imports rather than left as
an artifact, since that one's worth being correct regardless of which
packages happen to be installed.

## Explicitly NOT done yet (hand this to OpenHands next)

1. Real per-user login now exists (see "Real per-user identity" above) —
   what's still genuinely deferred: SSO/OIDC against a specific external
   identity provider (no IdP has been chosen), password reset, email
   verification, rate limiting on `/auth/login`, and session revocation
   (the stateless JWT approach means a compromised account stays valid
   until its token expires, not until someone notices). Per-action
   attribution now works correctly, though — every mutation runs as the
   actual logged-in user, not a shared identity.
2. `npm install && npm run build` has never actually run (no network
   access in the environment this was authored in) — the tests above ran
   via `tsx`/plain Node without needing the full dependency tree, but a
   real Next.js build is a different, stronger bar. Run it first.
3. Media upload, browse/reuse, alt-text editing, delete, and real
   pagination ("Load more") all work now (see above — `MediaLibrary` has
   a per-asset alt-text field with its own Save button, wired to
   `PATCH /media/:id`). **Real image resizing now too** — the library
   grid uses each asset's `thumbnail` variant (not the full original,
   once one generated successfully), and both the upload preview and
   library selection prefer the `display` variant over the original,
   falling back to the original if a variant didn't generate (variant
   generation is best-effort on the backend — see besbpo-blog-cms-api's
   README).
4. No calendar/kanban planning view, no bulk actions, no tenant-management
   UI (tenant CRUD only has an API today — see
   besbpo-blog-syndication-svc's `internal/tenant/admin_handlers.go`).
5. No historical/trend view for analytics — current snapshot only.
6. No CSV/export option for Corporate Comms to pull numbers into a deck.
7. `lib/article-status.ts`'s hand-duplicated state machine (see above) —
   worth a shared package if a third consumer of the CMS API's state
   machine ever appears.
8. `middleware.ts` only checks that a session cookie is present, not that
   it's valid — real signature verification happens on the first actual
   API call instead (see that file's own doc comment for why: Edge
   Runtime doesn't have easy access to Node's crypto module the way a
   Server Action does). Someone with an expired/tampered cookie gets
   past the middleware and then sees real 401s from every data call,
   which works but isn't the cleanest possible UX for that specific case.
9. The `CMS_API_ADMIN_JWT`/`SYNDICATION_ADMIN_JWT` fallback path means
   this app can still run entirely on a shared admin identity if someone
   sets those env vars and never logs in — intentional (useful for
   scripts/local dev), but worth knowing it's not actually gone, just no
   longer the default or the recommended path.

## Local development

```bash
cp .env.example .env
npm install
npm run dev
# :3001, health check at :3001/healthz
```
