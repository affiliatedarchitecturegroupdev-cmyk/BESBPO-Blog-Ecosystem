# besbpo-blog-enterprise-svc

Spring Boot service for SSO integration and immutable audit logging.
Implements the Enterprise Integration Service described in
`BESBPO-BLOG-ARCH-01` Section 5 and the audit requirements referenced in
Section 8 (Security) and `BESBPO-BLOG-ARCH-03` Section 6 (human-approval
gate).

**`.github/workflows/ci.yml`** now exists — `mvn compile`, `mvn test`.
Genuinely the first time these commands will ever run against this code
(this repo's authoring environment had only a JRE, no JDK, no Maven —
not even `javac` was available) — closing a gap named throughout this
platform's development: "no CI/CD pipeline has ever actually triggered."

## ⚠️ Verification caveat — read this first

Same standing caveat as this platform's Go/Rust work: this repo was
written and reviewed in an environment with **no JDK, no Maven, and no
network access** (confirmed: only a JRE is installed — `javac` doesn't
exist anywhere on the system this was authored on). `mvn compile`/`test`
has never actually run against this code. Every file was reviewed
carefully — brace/paren balance checked programmatically, Spring Security
6.x's current lambda-DSL API used deliberately (not the removed
`WebSecurityConfigurerAdapter` style), JPA 3.1's `GenerationType.UUID`
used rather than assumed, the JWT verification logic hand-traced against
the actual byte layout it processes — but that's a different and weaker
bar than compiling. **Run `mvn compile && mvn test` as the first task**
before relying on this.

## Phase 7: real audit persistence + service-JWT authentication

Previously (Phase 0): an in-memory `CopyOnWriteArrayList`, and
`/api/v1/audit` had no authentication at all — reachable by anyone who
could route to it. Now:

- **`audit/AuditEventEntity.java`, `AuditEventRepository.java`** — real
  JPA persistence to the new `audit_events` table (added to
  besbpo-blog-architecture's `db/schema.sql` alongside this). `AuditService`
  still logs every event too (unchanged from Phase 0) in addition to
  persisting it.
- **`security/ServiceJwtVerifier.java`** — real HS256 JWT verification,
  matching the shared-secret convention already used between
  besbpo-blog-cms-api and besbpo-blog-syndication-svc. **Deliberately not
  a JWT library** (e.g. JJWT) — see that class's doc comment for a real
  cross-language compatibility issue this surfaced: JJWT enforces a
  256-bit minimum key length for HS256 and throws on shorter keys, which
  would reject the exact short dev-secret values
  (`"dev-secret-change-me"`, 184 bits) the Go and NestJS services sign
  with directly using raw secret bytes. Standard HMAC (RFC 2104) has no
  such minimum. Hand-rolled instead with `javax.crypto.Mac` (JDK stdlib)
  and Jackson (already a transitive dependency via
  `spring-boot-starter-web` — no new dependency for JSON parsing),
  preserving actual interoperability rather than diverging from it.
  Explicitly guards against algorithm confusion (rejects any token not
  claiming exactly `"alg":"HS256"`, regardless of whether it's otherwise
  "valid") and uses `MessageDigest.isEqual` for constant-time signature
  comparison. Has its own test suite that hand-signs tokens to test the
  full round trip, including the specific short-dev-secret case.
- **`security/ServiceJwtAuthFilter.java`, `SecurityConfig.java`** — wires
  the verifier into the request pipeline via Spring Security's current
  (6.x) lambda-based `SecurityFilterChain` DSL. Everything except
  `/healthz` now requires a valid service JWT.

**Two new dependency groups**: `spring-boot-starter-data-jpa` +
`org.postgresql:postgresql` (audit persistence), and
`spring-boot-starter-security` (the filter-chain plumbing the hand-rolled
verifier plugs into — the verifier itself needs no new dependency).

**Deliberately NOT attempted in this pass**: real SSO/OIDC for human
Editorial Dashboard users. `spring-boot-starter-oauth2-resource-server`
is the natural fit once an actual identity provider is chosen, but no IdP
decision has been made yet — implementing against a specific vendor here
would mean guessing. See the PHASE 8 TODO in `pom.xml`.

**Later update**: this endpoint sat with real persistence and real auth
but zero callers for a long stretch after Phase 7 — besbpo-blog-cms-api's
`ArticlesService` didn't call it at all, meaning "the system records"
(this platform's own governing principle, Doc-01 Section 9 — "AI
proposes. Humans approve. The system records.") had no code behind it.
That's now closed on the caller side: besbpo-blog-cms-api's new
`AuditService` calls `POST /api/v1/audit` whenever a human approves an
AI-proposed field or transitions an article's status, using
`issueServiceToken` (the same service-JWT mechanism `WebhooksService`
already used) and the exact `AuditEvent` shape this controller expects —
see that repo's README for the caller-side details. Nothing changed on
this side; the endpoint was always correct, it just had nothing calling it.

## What's here

- **`EnterpriseApplication.java`** — Spring Boot entrypoint (unchanged).
- **`HealthController.java`** — `GET /healthz`, exempted from auth.
- **`audit/`** — `AuditEvent` (record), `AuditService` (now
  JPA-persisted), `AuditEventEntity`/`AuditEventRepository` (new),
  `AuditController` (`POST`/`GET /api/v1/audit`, now behind
  `ServiceJwtAuthFilter`).
- **`security/`** (new) — `ServiceJwtVerifier`, `ServiceJwtAuthFilter`,
  `SecurityConfig`, detailed above.

## Explicitly NOT done yet (hand this to OpenHands next)

1. **Run `mvn compile`/`mvn test` for the first time** — see the
   verification caveat above.
2. Real SSO/OIDC for the Editorial Dashboard once an IdP is chosen (see
   the PHASE 8 TODO in `pom.xml`) — deliberately deferred this pass.
3. Enforce `audit_events`' append-only property at the database level
   (e.g. `REVOKE UPDATE, DELETE` for a dedicated least-privilege app
   role) — currently only a convention (the application only ever
   INSERTs), not a DB-enforced guarantee. Needs a real role/grant setup
   this platform doesn't have yet (everything connects as one shared
   `besbpo` user) — see the note in `db/schema.sql`.
4. Network-level restriction so `/api/v1/audit` is unreachable from the
   public internet even with a valid token (Doc-04 Section 5) — an
   infrastructure/deployment concern (security groups, VPC placement),
   not something enforceable from inside the JVM.
5. `ServiceJwtVerifier` doesn't check a `service` allow-list — any caller
   with a validly-signed token is accepted, regardless of which service
   claims to have sent it. Add that check once there's a concrete list of
   which services are actually expected to call this one.

## Local development

Requires Java 21 and Maven (neither of which could be verified against
in the environment this was authored in — see the caveat above).

```bash
cp .env.example .env
mvn spring-boot:run
# service on :8082, health check on :8082/healthz (no auth required)
```

```bash
mvn test
```

```bash
# /api/v1/audit requires a valid service JWT — see ServiceJwtVerifier's
# test suite for how to hand-sign one for local testing.
curl -H "Authorization: Bearer <token>" http://localhost:8082/api/v1/audit
```
