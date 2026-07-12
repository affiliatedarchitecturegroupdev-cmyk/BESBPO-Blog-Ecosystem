# besbpo-blog-cms-api

NestJS system-of-record API for the Besbpo Group blog & syndication platform.
Implements the CMS core described in `BESBPO-BLOG-ARCH-03` (CMS Data Model &
Feature Specification) and the internal-facing parts of
`BESBPO-BLOG-ARCH-02` (Syndication API).

**`.github/workflows/ci.yml`** now exists — `npm install`, `tsc --noEmit`
against the REAL tsconfig.json (not the bare/ignoreConfig workaround this
whole codebase was verified with), `npm run build`, `npm test`. This is
the actual first real signal on whether this repo's dependencies resolve
and the code compiles for real, closing a gap that's been named
throughout this platform's development: "no CI/CD pipeline has ever
actually triggered."

## What's here (Phase 0/1/2 scaffold)

- **`common/`** — the RBAC `Role` enum, `ArticleStatus` state machine +
  transition graph, `@Roles()` decorator, and `RolesGuard`.
- **`divisions/`** — read API for the division taxonomy.
- **`articles/`** — the core content entity, DTOs, and `ArticlesService`,
  including `transition()`, which is the single enforcement point for both
  the lifecycle state machine (Doc-03 §3) and the AI human-approval gate
  (Doc-03 §6). `transition()` now also fires the Doc-02 §7 publish webhook
  on any status change tenants might care about (published/updated/archived),
  and — **Phase 9** — calls `EmbeddingService` on publish/update.
  **Authoring UI pass:** `CreateArticleDto` now exposes `excerpt` and
  `seoMeta` — neither could be set via the API at all before this (a real
  gap: two of the three fields the human-approval gate is entirely about
  couldn't even be written). `ArticlesService.update()` now sets the
  matching `*Source` to `'human'` automatically whenever that field is
  present in the payload — the client never gets to set a source value
  directly (see `CreateArticleDto`'s header comment for why: that would
  let anyone claim `'human_approved'` without an actual human approving
  anything). New: `findById` (`GET /articles/id/:id`, for the dashboard's
  edit page — `findBySlug`/`GET /articles/:slug` stays the public,
  unauthenticated canonical lookup, kept deliberately separate rather than
  one "smart" endpoint that guesses which kind of identifier it got),
  `approveField` (`POST /articles/:id/approve/:field` — the explicit "I
  reviewed this AI proposal and accept it as-is" action, distinct from
  editing the field's value), and `requestAiProposals`
  (`POST /articles/:id/ai-proposals`, via the new `AiProposalService`
  below).
- **`media/`** (new) — real file upload, closing the other half of the
  authoring UI gap (besbpo-editorial-dashboard could show fields to edit,
  but had nothing to attach an actual image to). `POST /media`
  (multipart, `FileInterceptor`) validates the file (image mime types
  only, 10MB cap — both checked directly, not assumed), then stores it
  via a `StorageBackend`: `S3StorageBackend` (`@aws-sdk/client-s3`, real
  deployments) or `LocalFilesystemStorageBackend` (the fallback when
  `AWS_S3_BUCKET` isn't set — same graceful-degradation philosophy as
  everywhere else in this platform, but explicitly documented as NOT
  suitable beyond local dev: no persistence across a redeploy, and
  nothing serves the files back over HTTP). `media-key.ts` (pure —
  filename sanitisation, key generation, mime allow-listing) was
  genuinely executed via `tsx` during development and caught a real bug
  in its own first draft: `sanitizeFilename('///')` produced `'___'`
  (non-empty) rather than triggering the "no safe characters" fallback,
  because a naive `.length > 0` check doesn't distinguish "sanitized to
  something" from "sanitized to something *useless*." Fixed to check for
  actual alphanumeric content instead, with a regression test.
  `Article.heroImageId` (already existed) can now actually be set to a
  real uploaded asset's ID — see `CreateArticleDto`. Typed as
  `string | null`, not just `string` — a real fix, not a style choice:
  clearing a hero image needs to send an explicit `null` (a genuine SQL
  `NULL` for the nullable UUID foreign key), and an empty string `''`
  would have failed at the database level as an invalid UUID rather than
  actually clearing the field. Caught while designing the dashboard's
  "Remove" button, before it shipped as a broken clear-that-looks-like-
  it-works action.
  **Not attempted here** (see besbpo-blog-search-media-svc's README for
  the matching, deliberate scoping decision): resizing, WebP/AVIF variant
  generation, or anything else that would need the `image` crate (or a
  Node equivalent like `sharp`, which needs native binary bindings this
  pass avoided for the same "don't add a large, hard-to-verify dependency"
  reasoning that kept the Rust `image` crate out).
  **Now generates real resized variants** via `sharp` — a thumbnail
  (300×300, cropped, WebP) and a display size (1200px wide, WebP,
  never upscaled past the original) — stored alongside the original and
  recorded in `media_assets.variants` (a real column since Phase 0 that
  had never been populated until now). Deliberately best-effort per
  variant, same fail-soft posture as this platform's AI integrations: a
  resize failure degrades to "no variants, use the original," never
  blocks the upload itself — genuinely tested by mocking `sharp` to throw
  and confirming the upload still succeeds. `variants` stores STORAGE
  KEYS, not URLs (a deliberate departure from the schema comment's
  illustrative example) — resolved to URLs at read time exactly like
  `s3Key` already was, so there's one mechanism for that resolution
  instead of two, and so `MediaService.delete` can actually find each
  variant's key to remove it from storage (a URL can't be reliably
  reversed back into a key). Known limitation, stated plainly: an
  animated GIF's animation is not preserved in its variants — sharp
  processes a single frame unless told otherwise. The RESOLUTION side is ready regardless: `MediaAsset.variantUrls`
  (not a DB column) maps every entry in `variants` to an actual URL the
  same way `s3Key` → `url` already works, via the same `StorageBackend`.
  Correctly resolves to `{}` today since nothing populates `variants` yet
  — genuinely tested with both an empty map (the current reality) and a
  populated one (proving the resolution logic itself, not just the
  trivial pass-through case), so whenever real variant generation lands,
  this half of the work is already done and already verified.
  **Now also:** `GET /media` (the library — reuse an existing asset
  instead of uploading a duplicate; real pagination via `?limit=&offset=`,
  clamped server-side by `clampPagination` rather than trusted or
  rejected outright — genuinely tested against 12 edge cases including
  0, negative, NaN, and over-large values), `PATCH /media/:id` (update `altText` without
  re-uploading), and `DELETE /media/:id`. Deleting is genuinely careful,
  not just a raw DB delete: `articles.hero_image_id` has a real foreign
  key to `media_assets` with no `ON DELETE CASCADE`/`SET NULL`
  (`db/schema.sql`), so Postgres itself rejects deleting an asset that's
  still some article's hero image — `MediaService.delete` catches that
  specific failure (SQLSTATE `23503`, checked at both the shape TypeORM
  usually exposes it at and the one some driver versions nest it under,
  defensively, rather than assumed) and turns it into a clear
  `ConflictException` instead of leaking a raw Postgres error. Storage
  cleanup happens only after the DB delete succeeds, and only ever leaks
  a file (recoverable) rather than orphaning a DB row (a broken
  reference) if it fails — see that method's own doc comment for the full
  ordering rationale. 10 new tests cover upload validation, the list/altText
  paths, and — the part worth actually testing carefully — that DB-then-
  storage delete ordering and both shapes of the FK-violation error.
- **`ai-proposals/`** (new) — `AiProposalService.requestProposals` bridges
  the authoring workflow to besbpo-blog-intelligence-svc's three proposal
  endpoints (`/v1/tag/propose`, `/v1/seo/propose`, `/v1/summarise/propose`
  — note the exact paths, checked directly against that service's routers
  rather than assumed). Closes a real gap: that service has existed since
  Phase 5 with **no caller anywhere in this codebase** — the "AI proposes"
  half of "AI proposes, humans approve" had nothing wired to actually
  produce a proposal. Each of the three sub-requests is independent and
  best-effort (one failing doesn't block the other two), matching
  `EmbeddingService`/`WebhooksService`'s fail-soft posture.
- **`authors/`** (new) — `AuthorsService.getOrCreateForUser` is a real bug
  fix, found while writing a CI workflow (`besbpo-blog-architecture`'s)
  that applies `schema.sql` to a real Postgres instance for the first
  time in this platform's whole development. `articles.author_id` is a
  `NOT NULL` foreign key to `authors(id)` — **not** `users(id)` — and
  `media_assets.uploaded_by` references the same table. Both
  `ArticlesService.create` and `MediaService.upload` had been passing the
  logged-in **user's** id directly, which isn't a valid `authors.id` at
  all. Against real Postgres, every single article creation would have
  hard-failed a `NOT NULL` foreign key violation the moment it ran — a
  bug that had been sitting there undiscovered because nothing in this
  environment could actually enforce that constraint. `authors` and
  `users` are deliberately distinct concepts in the schema (an author's
  `user_id` is nullable — an author can exist with no corresponding login
  at all, e.g. a guest byline), so the fix is a real "resolve or lazily
  create the author record for this user" service, not just repointing
  the foreign key to collapse that distinction. Auto-creates on first use
  (every user who can reach these endpoints already has what's needed —
  a user id and a display name, both in the JWT) rather than requiring a
  separate manual author-registration step first.
- **`audit/`** (new) — `AuditService.record` calls
  besbpo-blog-enterprise-svc's `POST /api/v1/audit`, closing the third
  gap in the same family as the one above: that endpoint has had real
  persistence and real auth since that repo's Phase 7, with **no caller
  anywhere** until now. This platform's own governing principle (Doc-01
  Section 9) is "AI proposes. Humans approve. The system records." — the
  first two had real code; the third had never fired once. Every "a human
  approved this AI-proposed field" event the human-approval gate exists
  to produce was going nowhere. Wired into `ArticlesService.approveField`
  (action `approve_ai_proposed_field`, recording which field) and
  `ArticlesService.transition` (action `article_status_transition`,
  recording the from/to status — every transition, not just publish, on
  the view that the full editorial lifecycle is worth a trail, not only
  the moment something goes live). Same `issueServiceToken` + `withRetry`
  pattern as `WebhooksService.notifyPublishEvent` — a fresh short-lived
  service token per attempt, 3 retries, fail-soft (a failed audit call
  logs a warning and never blocks the action that already succeeded).
  That fail-soft design is a real, named tradeoff, not glossed over: the
  audit trail is best-effort, not a strict guarantee, until this has a
  durable retry queue (e.g. an outbox table) instead of an in-process
  retry loop that gives up after a few seconds — see the NOT-done-yet
  list below. `ArticlesController.transition`/`approveField` now also
  thread `req.user?.id` through as the actor — previously unused by
  either method.
- **`embeddings/`** (new, Phase 9) — `EmbeddingService.generateAndPersist`
  closes a real gap that had sat since Phase 6: `article.entity.ts`'s
  original header comment said embeddings would be written once the
  intelligence service "lands," but nothing ever actually called it after
  it did. Calls besbpo-blog-intelligence-svc's `/v1/embeddings/generate`
  (with the same `withRetry` resilience as `WebhooksService`), then writes
  the result via a raw parameterized `UPDATE ... SET embedding = $1::vector`
  query — deliberately NOT through the `Article` entity/repository, to
  preserve that same original decision to avoid a pgvector TypeORM driver
  dependency. Best-effort: a failed call never blocks a publish.
- **`tags/`** — free-form, cross-cutting tags (Doc-03 §4.2), separate from
  the formal division taxonomy. `TagsService.findOrCreateMany` resolves tag
  names supplied on article create/update, creating any that don't exist
  yet — with a unit test covering dedup/normalisation/create-vs-reuse.
  `ArticlesService.findAll` now supports `?tag=` filtering alongside
  `?division=`.
- **`tenants/`** — a read-side mirror of tenant data plus the syndication
  reach preview used by the Editorial Dashboard (Doc-03 §10).
- **`auth/`** — JWT strategy/guard scaffold (Doc-02 §4 `adminJwt` scheme),
  plus now `issueServiceToken` for signing the service-to-service token
  `WebhooksService` sends to besbpo-blog-syndication-svc. **Also now
  `jwt-auth.guard.ts`** — a real bug found and fixed during a Docker
  Compose integration review: `RolesGuard` was applied on
  `ArticlesController`/`TenantsController`, but nothing anywhere ever
  activated the JWT Passport strategy to populate `request.user` — every
  protected endpoint would have 403'd regardless of whether a valid token
  was sent. `JwtAuthGuard` closes that; see its doc comment for exactly
  where it's applied (method-level on `ArticlesController`, since that
  controller also has a genuinely public route — class-level on
  `TenantsController`, which has none). **Phase 9:** this guard is now
  actually exercised by real cross-service traffic, not just this repo's
  own admin/tenant callers — besbpo-blog-syndication-svc's
  `CMSArticleSource` used to send a static bearer token to
  `GET /articles` that this guard would reject outright; it now signs a
  real short-lived admin-shaped JWT instead (see that repo's
  `internal/middleware/SignAdminJWT`), closing the loop this guard's own
  introduction had opened.
  **Now also — real per-user identity:** `POST /auth/login` and
  `POST /auth/register`, backed by a genuine `users` table (bcrypt
  password hashes, real per-user JWTs), replacing the single shared
  admin JWT every service and the dashboard ran on before this. This is
  deliberately NOT SSO/OIDC against a specific external identity
  provider — no IdP has been chosen, and guessing one isn't a substitute
  for that decision (see `users/entities/user.entity.ts`'s header comment
  for the full reasoning); real SSO can sit on top of this table later
  without a rewrite. `register` handles its own chicken-and-egg problem —
  a SUPER_ADMIN-gated endpoint needs a SUPER_ADMIN to already exist — via
  a bootstrap mode: the very first registration (zero users exist yet) is
  open and always becomes SUPER_ADMIN; every registration after that
  requires an authenticated SUPER_ADMIN caller. `login` is written to
  resist a subtler issue than "does the password match": it runs
  `bcrypt.compare` even for a non-existent email (against a fixed dummy
  hash) rather than short-circuiting, specifically so a timing side
  channel can't be used to enumerate which email addresses have accounts
  — `bcrypt.compare` is deliberately slow, so skipping it for "no such
  user" would make that response measurably faster than a real user's
  wrong-password attempt. `UsersService.findByEmailForAuth` is the ONLY
  method that ever selects the password hash column (the entity marks it
  `select: false`) — deliberately named differently from the everyday
  `findByEmail`, so a future caller reaching for "the obvious" lookup by
  habit gets the safe one, not the one carrying a password hash. Also
  fixed a real, separate bug found while touching this: `MediaController`
  read `req.user?.sub` for `uploadedBy`, but `JwtStrategy.validate()`
  returns `{ id: payload.sub, ... }` — the validated request object uses
  `id`, not `sub` (the JWT payload's own field name). `uploadedBy` had
  silently been `undefined` on every upload since that endpoint was
  written.
- **`app.module.ts`** — TypeORM's `synchronize` is now unconditionally
  `false` (was gated on `NODE_ENV`). Found during the same review: with
  `docker-compose.yml` mounting `besbpo-blog-architecture/db/schema.sql`
  as the Postgres init script, `synchronize: true` would have TypeORM
  fighting that same schema for ownership of the tables. `schema.sql` is
  now unambiguously the single source of truth; entities must be kept in
  sync with it by hand until a real migration tool replaces this.
- **`webhooks/`** — now makes a real signed HTTP call to the Go
  syndication service's publish webhook (was a console-log stub) —
  attaches a service JWT via `AuthService.issueServiceToken`, matching
  what that repo's `RequireServiceJWT`/`ServiceClaims` now actually verify.
  Wrapped in `common/retry.ts`'s `withRetry`: transient failures (network
  blips, a 502 while the syndication service restarts) retry up to 3
  times with exponential backoff; a 4xx does not retry (a bad payload or
  auth failure won't fix itself).
- **`common/retry.ts`** — a small, dependency-free retry-with-backoff
  utility (no NestJS imports, so it's testable in complete isolation —
  `retry.spec.ts` covers success, exhaustion, non-retryable early-stop,
  and increasing backoff; every case was also genuinely executed via
  `tsx` outside Jest before this spec was written, since Jest itself
  isn't installed in the environment this was authored in). Deliberately
  mirrors besbpo-blog-syndication-svc's `internal/retry` package — same
  shape on both sides of the platform.

## Explicitly NOT done yet (hand this to OpenHands next)

1. Add a real migration tool — `synchronize` is now off (see the
   `app.module.ts` note above), which stops it from fighting
   `schema.sql`, but entities and schema are only kept in sync by hand
   until a migration tool replaces this.
2. Implement real SSO token issuance in `AuthService.issueToken` (currently
   a bare `jwtService.sign()` with no identity provider behind it) —
   `issueServiceToken` (the internal-service path) is done; this is the
   human-admin-via-SSO path, still open. Deliberately not attempted in
   Phase 9 either — see besbpo-editorial-dashboard's and
   besbpo-blog-enterprise-svc's READMEs for the same scoping decision
   (no real IdP has been chosen; guessing a specific vendor integration
   isn't a substitute for that decision).
3. `AuthService`/`WebhooksService` currently sign with one shared
   `JWT_SECRET` for both admin and service tokens — besbpo-blog-syndication-svc's
   `ADMIN_JWT_SECRET` and `SERVICE_JWT_SECRET` must both match this value
   until distinct signing keys per token purpose are introduced (see the
   caveat in `auth.service.ts` and the matching one in that repo's
   `internal/middleware/jwt.go`). This now matters for TWO callers instead
   of one as of Phase 9 — besbpo-blog-syndication-svc both verifies
   incoming admin JWTs AND signs its own outbound ones with the same
   secret (see that repo's `internal/middleware/SignAdminJWT`).
4. Add `ArticleVersion` and `MediaAsset` entities/modules — `Tag` is now
   done (see above); these two remain, per the SQL tables already defined
   in the architecture repo's `db/schema.sql`.
5. Add e2e tests under `test/` (unit tests exist for the transition guard
   and tag resolution; nothing exercises the HTTP layer end-to-end yet).
6. `AiProposalService`'s HTTP calls to besbpo-blog-intelligence-svc have
   never actually been exercised against a running instance of that
   service — the request/response shapes were checked directly against
   that service's Pydantic models and router paths (not assumed), but
   that's still review, not execution. Same standing caveat as the rest
   of this platform's cross-service integrations.
7. `besbpo-editorial-dashboard`'s `lib/article-status.ts` duplicates this
   repo's `ArticleStatus`/`ARTICLE_STATUS_TRANSITIONS`/
   `HUMAN_APPROVAL_REQUIRED_BEFORE` by hand (two separate apps, no shared
   package) — if the state machine changes here, that file needs updating
   too, or the dashboard will offer transition buttons this API then
   rejects. Worth a shared package if a third consumer of this state
   machine ever shows up.
8. `@aws-sdk/client-s3` is a brand new dependency — `npm install` has
   never run against it in this environment (no network access). The
   actual `S3StorageBackend.store`/`resolveUrl` calls have been reviewed
   carefully against the AWS SDK v3 docs (matched against the standard
   `PutObjectCommand` usage pattern) but never executed against a real
   bucket.
9. `sharp` is a brand new dependency with native bindings — like
   `@aws-sdk/client-s3`, `npm install` has never run against it here (no
   network access). Native bindings are a real, different category of
   deployment risk from a pure-JS dependency (the prebuilt binary has to
   match the deployment platform/architecture) — this is the standard,
   well-trodden path for Node image processing and works out of the box
   on most common platforms, but it's a real risk category worth naming,
   not just "another untested dependency."
10. No variant regeneration for already-uploaded assets — an image
    uploaded before this pass has `variants: {}` forever unless
    re-uploaded. A backfill job is real future work, not attempted here.
11. `bcrypt` is a brand new dependency with native bindings — same real
    risk category as `sharp`, npm install never run against it here.
12. No password reset flow, no email verification, no rate limiting on
    `/auth/login` (a real gap for a login endpoint specifically — brute
    force is a genuine concern there in a way it isn't for most of this
    platform's endpoints). No session revocation either — the stateless
    JWT approach (matching this codebase's existing pattern) means a
    compromised account stays valid until its token expires
    (`JWT_EXPIRES_IN`, 15m by default), not until someone notices and
    acts.
13. `POST /auth/register`'s bootstrap mode (open when zero users exist)
    is standard for this chicken-and-egg problem, but it does mean the
    FIRST person to successfully call it — not necessarily the intended
    admin — becomes SUPER_ADMIN. Fine once this only runs behind the
    network-level restriction Doc-04 Section 5 already calls for before
    anything in this platform sees real traffic; worth knowing if that
    assumption is ever relaxed before a real admin has registered.
14. `AuditService.record` is fail-soft (see `audit/` above) — a real,
    named tradeoff: if besbpo-blog-enterprise-svc is down for longer than
    the retry window, that audit event is simply lost, not queued for
    later delivery. An outbox table (write the event locally in the same
    transaction as the approval/transition itself, a background job
    drains it to enterprise-svc) would make the trail a durable guarantee
    instead of a best-effort one — real future work, not attempted here.
15. `update()` (direct field edits) and `create()` don't record audit
    events — only `approveField` and `transition` do. Deliberate initial
    scope (the human-approval gate is specifically what Doc-01's "the
    system records" principle is about), but a broader audit trail
    covering ordinary edits too is a reasonable next expansion.
16. `AuthorsService` has no way to explicitly set/update an author's
    `bio`/`divisionId` after auto-creation — a record created by
    `getOrCreateForUser` starts with both null forever, unless something
    else is added to edit them. No admin UI or endpoint for browsing/
    managing author records exists either.

## Local development

```bash
cp .env.example .env
npm install
npm run start:dev
# API on :3000, Swagger docs on :3000/docs, health check on :3000/healthz
```

Requires a local Postgres with the `uuid-ossp` and `vector` extensions —
see `besbpo-blog-architecture/db/schema.sql`.
