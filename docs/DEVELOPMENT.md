# BESBPO Blog Platform - Development Guide

## Overview

This guide tracks development progress for the BESBPO Blog Platform, based on the master planning document (BESBPO-BLOG-ARCH-06).

**Current State:** 21,487 lines across 15 repositories  
**Target:** 120,000+ lines at production maturity

---

## Platform Architecture

### Two-Tier Design

| Tier | Type | Technology | Domains |
|------|------|------------|---------|
| **Tier 1** | Static | GitHub Pages | blog.besbpo.co.za, subsidiary sites |
| **Tier 2** | Dynamic | Coolify on AWS | api.besbpo.co.za, dashboard.besbpo.co.za |

### Repository Map

```
besbpo-blog-ecosystem/
├── bespbo-blog-cms-api/          # NestJS - System of record
├── bespbo-editorial-dashboard/    # Next.js - Authoring UI
├── besbpo-blog-web/              # Next.js - Public blog (GitHub Pages)
├── besbpo-blog-syndication-svc/  # Go - RSS/Atom distribution
├── besbpo-blog-intelligence-svc/  # Python - AI content analysis
├── besbpo-blog-search-media-svc/ # Rust - Search & media
├── besbpo-blog-enterprise-svc/    # Java - Audit logging
├── besbpo-embed-widget/          # TypeScript - Syndication widget
├── besbpo-subsidiary-site-*/     # HTML/CSS - Subsidiary sites
└── besbpo-blog-architecture/     # Architecture documentation
```

---

## Development Phases

### Phase 1: Foundation Verification ⚡ HIGH PRIORITY
*Reference: Master Plan Section 6.1, 6.4*

**Priority:** Critical - All other work depends on this

- [ ] **6.1.1** Trigger CI workflows in all repositories
  - Besbpo-blog-architecture CI applies schema.sql to real Postgres
  - Convert 226 reviewed-but-unrun tests to executed status
- [ ] **6.1.2** Add devcontainer.json for all services
  - Go 1.22, Rust stable, JDK 21/Maven, Node 20
  - Enables Codespaces for verification
- [ ] **6.1.3** Configure Dependabot for all ecosystems
  - npm, Go, Cargo, Maven
  - Auto-update security-sensitive dependencies

### Phase 2: Managed Service Migration
*Reference: Master Plan Section 4*

**Priority:** High - Reduces operational risk

- [ ] **4.1** Migrate to Supabase (PostgreSQL + pgvector)
  - Connection string change only, no code changes
  - Gains: backups, PITR, Supabase Auth option, Supabase Realtime option
- [ ] **4.2** Migrate to Upstash (Redis)
  - Connection string change only
  - Gains: cross-replica coordination, managed rate limiting
- [ ] **4.3** Review S3 vs Supabase Storage for media
  - Keep S3 for now, document Supabase Storage option

### Phase 3: Integration & E2E Testing
*Reference: Master Plan Section 7*

**Priority:** High - Largest remaining work item (15,000-25,000 LOC)

- [ ] **3.1** Set up integration test infrastructure
  - Docker Compose with all services
  - Real PostgreSQL with schema.sql applied
- [ ] **3.2** End-to-end workflow tests
  - Draft → AI Propose → Human Approve → Publish → Syndicate
  - Auth flows: register, login, JWT validation
- [ ] **3.3** Load testing setup
  - k6 or artillery scripts
  - Benchmark against expected traffic

### Phase 4: Editorial Dashboard Completions
*Reference: Master Plan Table 3.1*

**Priority:** Medium-High - 8,000-15,000 LOC

- [ ] **4.1** Calendar/kanban editorial planning view
  - Visual editorial calendar across all divisions
  - Drag-and-drop scheduling
- [ ] **4.2** Tenant management UI
  - CRUD for tenant registrations
  - API already exists (besbpo-blog-syndication-svc)
- [ ] **4.3** Bulk actions
  - Multi-select approve/transition/delete
  - Articles and media assets
- [ ] **4.4** Standalone media library page
  - Extract from inline editor to full page
  - Browse, filter, reuse assets

### Phase 5: Enterprise Integration
*Reference: Master Plan Section 7*

**Priority:** Medium - 5,000-10,000 LOC (unscoped)

- [ ] **5.1** SSO/OIDC integration
  - Depends on identity provider decision
  - Replace/replace bcrypt+JWT with SSO flow
- [ ] **5.2** Auth hardening
  - Password reset flow
  - Login rate limiting
  - Session revocation
- [ ] **5.3** Intranet consumers integration
  - Internal communications hooks

### Phase 6: Media & Search Maturity
*Reference: Master Plan Section 7*

**Priority:** Medium - 7,000-13,000 LOC

- [ ] **6.1** Real image crate integration
  - besbpo-blog-search-media-svc/src/media.rs is pure interface
  - Implement actual transcoding
- [ ] **6.2** tantivy/OpenSearch promotion
  - If query complexity outgrows pgvector
- [ ] **6.3** axum HTTP framework swap
  - Rust service modernization
- [ ] **6.4** Public search UI
  - Expose hybrid search in blog.besbpo.co.za

### Phase 7: IaC & Observability
*Reference: Master Plan Section 7*

**Priority:** Medium - 6,000-10,000 LOC

- [ ] **7.1** Terraform provisioning
  - Supabase, Upstash, AWS resources
  - Document 4 Section 10 planning-level only
- [ ] **7.2** Structured logging across all services
  - Consistent log format
  - Correlation IDs
- [ ] **7.3** Metrics and tracing
  - Prometheus metrics
  - OpenTelemetry tracing
  - Dashboards

### Phase 8: Subsidiary Site Expansion
*Reference: Master Plan Section 5.1*

**Priority:** Low - 4,000-6,000 LOC (blocked on business)

- [ ] **8.1** Onboard 25+ remaining subsidiary sites
  - Use scaffold-subsidiary-site.sh
  - Blocked on: real names and domains from Besbpo Group

### Phase 9: Audit Trail & Background Jobs
*Reference: Master Plan Section 7*

**Priority:** Medium - 3,500-7,000 LOC

- [ ] **9.1** Outbox table pattern for audit
  - Make audit trail durable, not fail-soft
- [ ] **9.2** Extend audit coverage
  - Currently only approvals/transitions recorded
  - Add: direct edits, uploads, deletions
- [ ] **9.3** Embedding backfill job
  - Media uploaded before resize pipeline
- [ ] **9.4** Analytics rollups
  - Aggregated statistics

### Phase 10: GitHub Platform Hardening
*Reference: Master Plan Section 6*

**Priority:** Medium - 1,000-2,000 LOC

- [ ] **6.7** GitHub Packages for shared types
  - @besbpo/shared-types package
  - State machine, Role enum, DTOs
  - Publish on cms-api release
- [ ] **6.8** GitHub Environments
  - Staging and production secrets
  - Required reviewer for production
- [ ] **6.9** GitHub Projects
  - Unified backlog from all README NOT DONE lists
- [ ] **6.10** Branch protection
  - CI must pass before merge
  - Human approval required

---

## Current Build Status

| Repository | Tests | Status |
|------------|-------|--------|
| besbpo-blog-cms-api | 123 | ✅ Passing (119) / ⏳ Skipped (4) |
| besbpo-blog-intelligence-svc | 54 | ✅ Passing |
| besbpo-blog-web | 20 | ✅ Passing |
| besbpo-editorial-dashboard | 73 | ✅ Passing |
| besbpo-embed-widget | 6 | ✅ Passing |
| besbpo-blog-syndication-svc | 54 | ⚠️ Not verified (no Go toolchain) |
| besbpo-blog-search-media-svc | 30 | ⚠️ Not verified (no Rust toolchain) |
| besbpo-blog-enterprise-svc | 11 | ⚠️ Not verified (no JDK) |

---

## Quick Start Commands

### Local Development
```bash
# Full stack with Docker Compose
docker-compose up

# Individual services
cd besbpo-blog-web && npm install && npm run dev
cd besbpo-blog-cms-api && npm install && npm run start:dev
```

### Testing
```bash
# Run all tests
npm test                    # Node.js services
cargo test                 # Rust service
go test ./...              # Go service
mvn test                   # Java service

# With coverage
npm run test -- --coverage
```

### Build
```bash
# Static export for GitHub Pages
cd besbpo-blog-web && npm run build

# Docker images
docker build -t besbpo-blog-cms-api ./besbpo-blog-cms-api
```

---

## Key Architecture Decisions

| ADR | Decision | Rationale |
|-----|----------|----------|
| 0001 | Two-tier architecture | Static GitHub Pages + Dynamic Coolify |
| 0002 | Polyglot services | Right tool per domain |
| 0003 | Security services division | Separate audit concerns |
| 0004 | Voyage 1024 dimensions | Optimized for embedding quality |

---

## Documentation Links

- [Architecture](../besbpo-blog-architecture/README.md)
- [CMS API](../besbpo-blog-cms-api/README.md)
- [Editorial Dashboard](../bespbo-editorial-dashboard/README.md)
- [Blog Web](../besbpo-blog-web/README.md)
- [Intelligence Service](../besbpo-blog-intelligence-svc/README.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Gap Analysis](./gap-analysis.md)

---

## Last Updated

Based on: BESBPO-BLOG-ARCH-06 v1.0  
Updated: $(date +%Y-%m-%d)
