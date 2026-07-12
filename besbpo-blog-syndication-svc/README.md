# besbpo-blog-syndication-svc

Go service that serves the Syndication API to 30+ subsidiary sites. Implements
`BESBPO-BLOG-ARCH-02` (Syndication API & Tenant Onboarding Specification).
This is the **only** dynamic-tier service any subsidiary site talks to
directly — it insulates the CMS core from public traffic.

**`.github/workflows/ci.yml`** now exists — `go build ./...`,
`go vet ./...`, `go test -v ./...`. This is genuinely the first time
these commands will ever run against this code (see the verification
caveat immediately below for why) — closing a gap named throughout this
platform's development: "no CI/CD pipeline has ever actually triggered."

## ⚠️ Verification caveat — read this first

This repo (including the Phase 3 additions below) was written in an
environment with **no Go toolchain and no network access** — every other
piece of this platform that's TypeScript or Python was genuinely executed
and tested during development; this one could not be. Every file was
reviewed carefully (brace/import correctness, matching interface
signatures, cross-checking API usage against known-stable versions of
`pgx`/`go-redis`), but **`go build ./... && go vet ./... && go test ./...`
has never actually been run against this code.** Treat that as the
mandatory first task before anything else — do not assume this compiles
cleanly on faith. If it doesn't, the compiler errors will very likely be
shallow (an import, a signature mismatch) rather than deep logic bugs,
based on how carefully this was reviewed, but that's an expectation to
verify, not a guarantee.

## What's here now (Phase 0 → Phase 8)

- **`internal/analytics/`** (new, Phase 8) — implements Doc-03 Section 8's
  syndication analytics for the new besbpo-editorial-dashboard.
  `analytics.go`'s two queries (`fetchTenantSummaries`,
  `fetchDivisionSummaries`) deliberately pre-aggregate `syndication_events`
  and `analytics_events` in separate CTEs before joining — joining both
  event tables directly to `tenants`/`articles` in one query would fan out
  (every row in one table cross-joined against every row in the other for
  the same tenant/article), inflating every count. `handler.go` serves
  `GET /api/v1/analytics/summary` (admin-JWT-guarded). `beacon.go` serves
  `POST /api/v1/analytics/beacon` — deliberately UNAUTHENTICATED, called
  directly from besbpo-embed-widget, which can't safely hold a secret (see
  that repo). **Not yet rate limited** — a real, open gap, documented
  inline rather than silently left unhandled or falsely claimed to be
  covered by the existing tenant-scoped rate limiter (which needs auth
  context this endpoint deliberately doesn't have).

- **`internal/tenant/`** — the `Store` interface, an in-memory
  implementation (Phase 0, still used for local dev), and now
  **`postgres_store.go`**: a real `pgx/v5`-backed implementation against
  `besbpo-blog-architecture/db/schema.sql`. Bridges a schema mismatch worth
  knowing about: the `tenants` table has no `division_tags` column —
  divisions are normalised via `tenant_subscriptions` → `divisions`. Reads
  denormalise via `array_agg`; writes resolve division keys to IDs and
  replace the tenant's `tenant_subscriptions` rows in a transaction. See
  the file's header comment for the full explanation.
- **`internal/feed/`** — feed assembly and the `GET /api/v1/feed/{tenantId}`
  handler, plus now:
  - **`redis_cache.go`** — real Redis-backed `Cache`, replacing
    `InMemoryCache` for anything beyond local dev. JSON-encodes `Feed`
    values; degrades to a cache miss (not a request failure) on any Redis
    error, logging it instead.
  - **`cms_source.go`** — real HTTP-based `ArticleSource`, calling
    besbpo-blog-cms-api's `GET /articles` endpoint instead of the Phase 0
    in-memory stub. Known limitation documented inline: the CMS core's
    `?division=` filter only accepts one value today, so this calls it
    once per division tag and de-duplicates client-side — correct, but
    N calls instead of 1 until the CMS core supports OR-matching.
    **Phase 9:** authenticates via `middleware.SignAdminJWT` (a fresh,
    short-lived, self-signed admin-shaped JWT per request) instead of a
    static bearer token — the static token stopped working the moment
    besbpo-blog-cms-api's `GET /articles` gained a real `JwtAuthGuard`
    (found during the Docker Compose review), and this was the fix,
    not just a note about the problem.
- **`internal/webhook/`** — the publish-webhook handler, plus now
  **`github_dispatcher.go`**: real calls to GitHub's
  `POST /repos/{repo}/dispatches` REST API, replacing the Phase 0 logging
  stub, with retry/exponential backoff (via `internal/retry`) on transient
  failures — network errors and 5xx retry up to 3 times, 4xx does not
  (retrying a bad token or unknown repo won't fix it).
- **`internal/retry/`** — a small, dependency-free retry-with-backoff
  package, deliberately mirroring besbpo-blog-cms-api's
  `src/common/retry.ts` (same shape: max attempts, doubling base delay, an
  `IsRetryable` predicate, an injectable sleep for tests) so the retry
  story reads the same way on both sides of the platform. Full test suite
  (`retry_test.go`) covering success, exhaustion, non-retryable early-stop,
  increasing backoff, and context cancellation during a sleep.
- **`internal/middleware/`** — tenant API-key auth, plus now
  **`hmac.go`**: real HMAC-SHA256 request signature verification (Doc-02
  Section 4's `tenantApiKey` scheme fully implemented — was a Phase 0 TODO).
  The signing key is deliberately derived differently from the lookup hash
  (domain separation via a suffix) — see the file's header comment. Comes
  with a full unit test suite (`hmac_test.go`) covering valid signatures,
  tampering, expired timestamps, and missing headers. Also now
  **`jwt.go`**: real JWT verification (HS256, algorithm-confusion-guarded
  via `jwt.WithValidMethods`) for both `RequireAdminJWT` (which additionally
  requires a Syndication Admin or Super Admin role, matching Doc-03's RBAC
  matrix) and `RequireServiceJWT` — replacing the earlier presence-only
  stubs. `AdminClaims` mirrors besbpo-blog-cms-api's `JwtPayload` shape
  exactly (`sub`/`roles`/`divisionId`) so tokens interoperate without a
  translation layer — see the file's header comment for the shared-secret
  caveat that comes with that. And **`ratelimiter.go`**/
  **`ratelimiter_memory.go`**/**`ratelimiter_redis.go`**: per-tenant rate
  limiting (Doc-02 Section 10 — standard 60 rpm, high-traffic 300 rpm via
  `DisplayConfig.HighTraffic`) behind a `RateLimiter` interface with both
  an in-memory implementation (local dev) and a Redis-backed one
  (distributed-correct across replicas — see that file's header comment
  for the fixed-window-vs-token-bucket trade-off).
- **`internal/tenant/`** now also has the full tenant admin CRUD surface
  (**`admin_handlers.go`**): `POST /tenants`, `GET /tenants/{id}`,
  `PATCH /tenants/{id}`, `POST /tenants/{id}/rotate-key` — matching
  Doc-02 Section 5. `apikey.go` generates and hashes new API keys
  (`crypto/rand`, 256 bits, shown once per the OpenAPI
  `TenantCreateResponse` schema).
- **`internal/feed/`** now serves the `.rss` variant too
  (`GET /api/v1/feed/{tenantId}.rss`, via `rss.go`'s `BuildRSSFeed`) —
  worth knowing about: Go's `net/http.ServeMux` requires a wildcard to
  span an entire path segment, so `{tenantId}` and `{tenantId}.rss` can't
  be registered as two separate patterns. Both are served by one
  registered route (`Handler.ServeFeed`) that does its own suffix check —
  see that function's comment, and the matching suffix-stripping logic in
  `middleware.RequireTenantAuth`.

## Known limitations worth reading before relying on this in production

- **The "build-time (Actions runner)" rate tier from Doc-02 Section 10
  isn't distinguished from normal traffic** — there's no signal in the
  current request shape to tell a GitHub Actions rebuild's feed call apart
  from a subsidiary site's client-side widget poll. See the PHASE 4 TODO
  in `ratelimiter.go` for the proposed fix (a dedicated header).
- **`RedisRateLimiter` uses fixed-window counting, not a token bucket** —
  a deliberate trade-off (Redis's `INCR` gives atomicity for free; a
  correct distributed token bucket needs a Lua script). The accepted cost:
  a client can briefly approach ~2x the configured rate right around a
  60-second window boundary. See the header comment in
  `ratelimiter_redis.go` if that boundary burst matters for a specific
  deployment.
- **besbpo-blog-cms-api signs every JWT with one shared secret today** —
  `ADMIN_JWT_SECRET` and `SERVICE_JWT_SECRET` must both be set to that same
  value until the CMS core is updated to use distinct signing keys per
  token purpose. See the header comment in `internal/middleware/jwt.go`.
- **Phase 9 added `middleware.RequireIPRateLimit`** for the analytics
  beacon endpoint (which has no tenant auth context to rate-limit by) —
  keyed on `X-Forwarded-For`'s first hop (or `RemoteAddr` directly). That
  header is trivially spoofable by a client talking to this service
  directly rather than through a proxy — fine for a rate limiter (worst
  case a forged IP just gets its own bucket), but never treat it as a
  trustworthy signal for anything security-sensitive. See `clientIP`'s
  doc comment in `ratelimiter.go`.

## Local development — two modes, same as besbpo-blog-web's fixture fallback

**In-memory (default, no infra needed):** just run it — `DATABASE_URL`
unset means `config.Load()` defaults `UseInMemoryBackends` to `true`, and
`main.go` wires up the Phase 0 in-memory Store/Cache/ArticleSource plus a
logging-only Dispatcher, exactly like before Phase 3.

**Real backends:** set `DATABASE_URL` (and ideally `REDIS_URL`,
`CMS_CORE_API_URL`, `GITHUB_DISPATCH_TOKEN`) and `main.go` connects to real
Postgres/Redis, calls the real CMS core, and dispatches to real GitHub
repos. `USE_IN_MEMORY_BACKENDS=true` forces the in-memory path even with
`DATABASE_URL` set, if you want that for a specific test run.

```bash
cp .env.example .env
go mod tidy   # generates go.sum — see the verification caveat above
go run .
go test ./...
```

## Explicitly NOT done yet (hand this to OpenHands next)

1. **Run `go build`/`go vet`/`go test` for the first time** and fix
   whatever that surfaces — see the caveat at the top of this README.
2. `CMSArticleSource.ListPublished` does one HTTP call per division tag
   (see the PHASE 4 TODO in `cms_source.go`) — fix once the CMS core
   supports multi-division OR-matching in a single call.
3. Add the caller-type signal needed to give GitHub Actions rebuilds their
   own lower rate tier per Doc-02 Section 10 (see the PHASE 4 TODO in
   `ratelimiter.go`).
4. Add integration tests against a real (or dockerized) Postgres/Redis —
   everything new in Phase 3 has been reviewed but not executed; that's a
   different and stronger bar than what unit tests with mocked interfaces
   can give you.
5. `AdminHandler.HandleCreate`/`HandleUpdate` don't yet validate that
   supplied `division_tags` actually exist in the `divisions` table before
   attempting the write — `replaceTenantSubscriptions` in
   `postgres_store.go` will return an error for an unknown key, but a
   clearer 400-with-details response at the handler layer would be a
   better admin UX than surfacing the storage-layer error message.
6. Update besbpo-blog-cms-api's `AuthModule` to sign admin-purpose and
   service-purpose tokens with distinct secrets, so `ADMIN_JWT_SECRET` and
   `SERVICE_JWT_SECRET` here can actually differ in practice, not just in
   config-shape (see the shared-secret caveat in `internal/middleware/jwt.go`).
