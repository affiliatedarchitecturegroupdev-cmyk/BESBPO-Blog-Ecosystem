# besbpo-blog-intelligence-svc

FastAPI service that proposes — never commits — AI-assisted content fields:
division/free-form tags, SEO metadata, syndication excerpts, and embeddings.
Implements `BESBPO-BLOG-ARCH-03` Section 6 and the AI layer described in
`BESBPO-BLOG-ARCH-01` Section 9.

**`.github/workflows/ci.yml`** now exists — `pip install -r requirements.txt`,
`pytest -v`. Unlike this platform's Go/Rust/Java services, this repo's
pure logic HAS genuinely run before (54 tests via `python3 -m unittest`);
this closes the remaining gap — the actual pytest suite and full FastAPI
app have never run even once.

**Every endpoint returns `source: "ai_proposed"`.** The human-approval gate
lives in `besbpo-blog-cms-api` (`ArticlesService.transition`), not here —
this service must never be given write access to the CMS database.

## Phase 5: real LLM/embedding calls, with a graceful fallback

Each of the four services now calls a real provider when configured, and
falls back to Phase 0's deterministic heuristic otherwise **or on any
failure** — mirroring besbpo-blog-web's fixture-fallback philosophy: this
service should always return something reasonable, whether or not secrets
are configured, rather than error out.

| Service | Real provider | Fallback when unconfigured / on failure |
|---|---|---|
| Tagging | Claude (Anthropic Messages API) | Keyword-overlap heuristic |
| SEO metadata | Claude | Deterministic truncation/templating |
| Summarisation | Claude | Sentence-boundary truncation |
| Embeddings | **Voyage AI** | Hash-based pseudo-embedding (⚠️ not semantically meaningful) |

**Why Voyage AI for embeddings, not Claude:** Anthropic does not offer a
first-party embeddings API — Claude is generation-only, and officially
recommends Voyage AI (now part of MongoDB) as an embeddings partner. See
`besbpo-blog-architecture/adr/0004-voyage-embeddings-1024-dimensions.md`,
which also corrects a real Phase 0 mistake this surfaced: the pgvector
column was `vector(1536)` (an unexamined OpenAI-convention holdover) —
Voyage's models default to **1024** dimensions, not 1536. That's fixed in
the schema now; if you already ran the old schema anywhere, see the ADR
for the migration note.

Set `LLM_API_KEY`/`VOYAGE_API_KEY` empty (the default) to run entirely
heuristic, zero external calls, zero cost — good for local dev and CI.

## What's here

- **`app/common/retry.py`** — pure retry-with-backoff, deliberately
  mirroring besbpo-blog-cms-api's `src/common/retry.ts` and
  besbpo-blog-syndication-svc's `internal/retry` (same shape in all three
  languages this platform uses for outbound calls). Zero third-party
  dependencies — **genuinely executed and tested** (11 tests,
  `python3 -m unittest tests.test_retry`), unlike almost everything else
  in this service.
- **`app/common/llm_client.py`** / **`embedding_client.py`** — thin async
  httpx wrappers for the Anthropic Messages API and Voyage embeddings API
  respectively. Deliberately thin: response parsing is factored out into
  **`anthropic_response.py`** / **`voyage_response.py`**, two more
  dependency-free pure modules, specifically so that parsing logic is
  independently testable without httpx installed (it isn't, in the
  environment this was authored in) — 11 more genuinely executed tests
  between them.
- **`app/services/*_prompts.py`** (`tagging_prompts.py`, `seo_prompts.py`,
  `summarisation_prompts.py`) — pure prompt-building and response-parsing
  for each LLM call, same rationale, 32 more genuinely executed tests.
- **`app/services/*_service.py`** — the orchestration layer: try the real
  provider if configured, catch any exception, log a warning, fall back
  to the heuristic. This layer itself needs pydantic/httpx to import, so
  — unlike the pure modules above — it's reviewed, not executed, in this
  environment.

**54 tests were genuinely executed** (`python3 -m unittest tests.test_retry
tests.test_anthropic_response tests.test_voyage_response
tests.test_tagging_prompts tests.test_seo_prompts
tests.test_summarisation_prompts`) — every pure, dependency-free piece of
Phase 5's new logic. The orchestration/heuristic-fallback tests
(`test_tagging_service.py` etc.) need pydantic to even import and could
only be reviewed, consistent with the rest of this service's Phase 0
baseline and the platform root README's verification methodology note.

## Explicitly NOT done yet (hand this to OpenHands next)

1. Add authentication — these endpoints currently have none; they should
   only be reachable from besbpo-blog-cms-api on the internal network
   (Doc-04 Section 5), not the public internet.
2. Add a batch endpoint so the CMS core can request tagging + SEO +
   summarisation in one call instead of three round trips per article.
3. Install httpx/pydantic/pytest in a real environment and actually run
   the full suite (`pytest`) — confirm the orchestration/fallback layer
   behaves as reviewed, not just as intended.
4. Consider whether `voyage-3.5` is the right model for this platform's
   actual query patterns (see the model comparison in the ADR) — cheaper
   (`voyage-3.5-lite`) or higher-quality (`voyage-3-large`) options exist
   at the same 1024-dimension default.

## Local development

```bash
cp .env.example .env
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
# service on :8000, interactive docs at :8000/docs, health check at :8000/healthz
```

```bash
pytest                                          # full suite (needs pip install first)
python3 -m unittest discover -s tests -v        # same tests, stdlib runner —
                                                 # the 4 pydantic-dependent files will
                                                 # fail to import without pip install first;
                                                 # run the 6 pure-module files individually
                                                 # (see "What's here" above) to verify
                                                 # Phase 5's new logic with zero setup.
```
