# besbpo-blog-search-media-svc

Rust service for full-text/semantic search and media transcoding. Implements
`BESBPO-BLOG-ARCH-03` Sections 7 (Search & Discovery) and 9 (Media Pipeline).

**`.github/workflows/ci.yml`** now exists — `cargo build`, `cargo test`,
plus an informational (non-blocking) `cargo clippy` pass. Genuinely the
first time these commands will ever run against this code — closing a
gap named throughout this platform's development: "no CI/CD pipeline has
ever actually triggered."

## ⚠️ Verification caveat — read this first

Same standing caveat as this platform's other Go/Rust work: this repo was
written and reviewed in an environment with **no Rust toolchain and no
network access** — `cargo build`/`test` has never actually run against
this code. Every file was reviewed carefully (brace/bracket balance
checked programmatically, borrow-checker-sensitive patterns — closures
capturing `'static` references, lock-guard lifetimes, deref coercion at
call sites — reasoned through by hand rather than assumed), but that's a
different and weaker bar than compiling. **Run `cargo build && cargo test`
as the first task before relying on this.** If it doesn't compile clean,
the errors are very likely shallow (a type mismatch, a missing `as_slice()`)
given how carefully this was reviewed — but that's an expectation to
verify, not a guarantee.

## Phase 6: real Postgres sync + hybrid search

Previously (Phase 0): a single hardcoded seed document, naive keyword-only
scoring, zero dependencies. Now:

- **`src/db.rs`** — syncs published articles directly from Postgres (per
  Doc-03 Section 7: "Phase 0 can run this directly against Postgres"),
  including each article's `embedding` column where one has been
  generated. Uses the synchronous `postgres` crate — deliberately not
  `tokio-postgres`, so this stays a plain blocking program with no async
  runtime to set up. The one piece of this file that's genuinely testable
  without a real database connection — `parse_pgvector_text`, which parses
  Postgres's `"[0.1,0.2,0.3]"` text representation of a `vector` column
  into a `Vec<f32>` — has its own test module.
- **`src/search.rs`** — `SearchIndex` now does **hybrid** scoring: the
  original Phase 0 keyword-match score, plus a semantic score (cosine
  similarity against a caller-supplied query embedding) for any document
  that has its own embedding. The two are min-max normalised and averaged
  into a `combined_score` — see the module doc comment for why that
  specific blend, and that it's a reasonable starting point rather than an
  empirically tuned formula (there's no real corpus or query-judgment data
  yet to tune against). `cosine_similarity` is a pure, separately-tested
  function.
- **`src/main.rs`** — a background thread now syncs from Postgres every
  60 seconds (`DATABASE_URL` set) via `db.rs`, replacing the whole index
  atomically via `SearchIndex::replace_all` (so articles that are no
  longer published actually get removed, which the old `index()`-only
  path never did). Falls back to the original single seed document when
  `DATABASE_URL` isn't set — same fixture-fallback philosophy as
  besbpo-blog-web's `lib/api.ts`. `GET /api/v1/search` gained an optional
  `embedding` query parameter (comma-separated floats) for hybrid queries.

**One new dependency** (`postgres`) — deliberately minimal. See the
Cargo.toml comment for why image processing / S3 upload (the other half
of Phase 6's nominal scope, media transcoding) were **not** attempted in
this same pass: each would pull in a much larger, unverifiable dependency
(the `image` crate, an AWS SDK or manual request signing) on top of an
already-compiler-free review — stacking that much risk into one pass
wasn't a good trade. `src/media.rs` is unchanged from Phase 0 (interface
only, `NotImplemented`), with its doc comment updated to explain why.

## Rate limiting: a real decision, not just a guard bolted on

`GET /api/v1/search` had zero protection of any kind since it was
written — no auth, no rate limiting. The fix here is deliberately
**rate limiting, not authentication** — see `src/rate_limit.rs`'s module
doc comment for the full reasoning, summarized: the sync job only ever
indexes `status='published'` articles (`db.rs`), which is exactly the
same content already publicly readable on the actual blog. There's no
additional information-disclosure risk from anonymous search access, so
a public search bar needing no login is the normal shape for this
feature, not an oversight that needs closing with a guard. What a public
endpoint genuinely needs is abuse/DoS protection, which is what this
actually is.

- **`src/rate_limit.rs`** (new) — a minimal, in-process, fixed-window
  `RateLimiter` keyed by client IP, zero external dependencies (no Redis
  — this service is a single process today, so it doesn't have
  besbpo-blog-syndication-svc's Go rate limiter's cross-replica
  coordination problem yet). 6 tests, genuinely reasoned through by hand
  given no `cargo test` — including one specifically proving a client
  doesn't get a "free" request at every window boundary (the request
  that opens a new window must itself count against it, not start the
  new window at zero).
- **`src/http.rs`** — `serve`/`handle_connection` now take a
  `&RateLimiter` and check it before dispatching to a handler, using
  `TcpStream::peer_addr()` for the client IP. `/healthz` is exempted
  (matching the same hardcoded convention besbpo-blog-enterprise-svc's
  `ServiceJwtAuthFilter` uses) — a health check shouldn't compete with
  real traffic for the same budget. `write_response` gained a real `429`
  status-text mapping rather than falling through to "Internal Server
  Error" for it.
- **`src/main.rs`** — 60/minute per IP, matching
  besbpo-blog-syndication-svc's beacon endpoint's own per-IP budget
  (`RequireIPRateLimit`) for the same class of public, unauthenticated
  endpoint — picked to stay consistent with that precedent, not chosen
  arbitrarily.

**Known limitation, not glossed over**: the rate limiter's internal map
grows by one entry per unique IP ever seen, with nothing ever removing an
old entry. Fine for a while; a real production deployment would want a
periodic sweep or an LRU-bounded cache instead of an unbounded `HashMap`.
See `rate_limit.rs`'s own doc comment.

## What's here

- **`src/http.rs`** — minimal, single-threaded HTTP/1.1 server (unchanged
  from Phase 0). Replace with axum/actix-web before this carries real
  production traffic — still true, still not attempted, for the same
  new-dependency-risk reasons as above.
- **`src/search.rs`** — `SearchIndex`, now with hybrid keyword+semantic
  scoring (see above). Naive substring-scan keyword matching is
  unchanged — see the module doc comment for why a TF-IDF/real
  inverted-index rewrite wasn't bundled into the same pass as the hybrid
  scoring and Postgres sync changes (compounding unverifiable-risk logic
  again).
- **`src/db.rs`** — Postgres sync, detailed above.
- **`src/media.rs`** — interface only (`generate_variants`); still
  returns `MediaError::NotImplemented`.
- **`src/main.rs`** — wires up `GET /healthz` (now reports
  `indexed_documents` count), `GET /api/v1/search?q=...&embedding=...`,
  and the background sync thread.

## Explicitly NOT done yet (hand this to OpenHands next)

1. **Run `cargo build`/`cargo test` for the first time** — see the
   verification caveat above.
2. Implement `media::generate_variants` (the `image` crate) and S3 upload
   — deliberately deferred; see the Cargo.toml and media.rs comments.
3. Auto-embed the search query server-side instead of requiring the
   caller to pass a precomputed `embedding` param — needs an outbound
   HTTP client to besbpo-blog-intelligence-svc's
   `/v1/embeddings/generate`, which doesn't exist yet in this service
   (see the PHASE 7 TODO in `main.rs`'s `parse_embedding_param`).
4. `articles.embedding` is now actually populated — besbpo-blog-cms-api's
   `EmbeddingService` calls besbpo-blog-intelligence-svc on publish (a
   later pass than when this note was originally written). Hybrid search
   should genuinely blend keyword + semantic scoring now rather than
   silently degrading to keyword-only for every article — worth
   confirming once this actually runs, not just assumed from the other
   side's fix.
5. Swap the hand-rolled HTTP server for axum/actix-web, and
   `SearchIndex`'s keyword half for `tantivy` (or promote to OpenSearch
   per Doc-01 Section 6) — both still open, per the "why not bundle
   everything into one pass" reasoning above.
6. `rate_limit.rs`'s unbounded `HashMap` growth (see that section above)
   — a periodic sweep or LRU-bounded cache, not attempted here.

## Local development

```bash
cargo build
DATABASE_URL=postgres://besbpo:besbpo@localhost:5432/besbpo_blog cargo run
# or omit DATABASE_URL to run on the single seed document instead
# service on :8081, health check on :8081/healthz
```

```bash
cargo test
```

```bash
curl "http://localhost:8081/api/v1/search?q=infrastructure"
curl "http://localhost:8081/api/v1/search?q=infrastructure&embedding=0.1,0.2,0.3,..."
```
