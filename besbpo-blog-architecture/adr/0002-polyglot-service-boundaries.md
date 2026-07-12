# ADR 0002: Polyglot Service Boundaries

**Status:** Accepted
**Implements:** Master Architecture Document, Section 11; Phase 0 Roadmap, Section 3

## Context

The platform spans authoring, high-concurrency feed distribution, AI/NLP
processing, performance-critical search/media handling, and enterprise SSO.
No single language is best at all five. Besbpo Group's existing platforms
(BEIE Nexus, Lastmile Gig) already establish a polyglot-by-strength precedent.

## Decision

Assign one language/framework per service, matched to its job, each as an
independently deployable, independently reviewable repository:

| Service | Language | Why |
|---|---|---|
| CMS Core API | NestJS (TypeScript) | Structured, RBAC-heavy system of record |
| Editorial Dashboard + public blog | Next.js (TypeScript) | Rich UI, static export capability |
| Syndication Distribution Service | Go | Concurrency for 30+ concurrent tenant reads |
| Content Intelligence Service | Python (FastAPI) | AI/LLM/embeddings ecosystem |
| Search & Media Service | Rust | Performance/safety-critical indexing & transcoding |
| Enterprise Integration Service | Java (Spring Boot) | Mature SSO/SAML and audit-logging patterns |

## Consequences

- Each service repo has a narrow, single-language surface — easier for
  OpenHands to scope a task and for a human to review a diff.
- Cross-service contracts (this repo's `openapi/` and `db/schema.sql`) become
  the load-bearing artifacts; they must be treated as more stable than any
  individual service's internals.
- Onboarding a new contributor means learning one service's language, not the
  whole stack — deliberately traded against the operational cost of running
  six different toolchains.
