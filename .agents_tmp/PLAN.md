# BESBPO Blog Platform Implementation Plan

## Overview
This plan outlines the implementation of the BESBPO Blog Platform based on the master planning document (BESBPO-BLOG-ARCH-06).

**Source of Truth:** See `docs/DEVELOPMENT.md` for full phase breakdown  
**Task Tracking:** See `docs/TASK_TRACKING.md` for detailed tasks  
**Progress:** See `docs/PROGRESS.md` for status tracking  

---

## Phase 1: Foundation Verification ⚡ HIGH PRIORITY ✅
*Reference: Master Plan Section 6.1, 6.4*

- [x] Development environment setup
- [x] All microservices building successfully
- [x] TypeScript compilation errors fixed
- [x] Docker Compose configured for local dev
- [x] GitHub Pages deployment configured
- [x] Landing page (index.html) created
- [ ] **IN PROGRESS:** Trigger CI workflows in all repositories
- [ ] **TODO:** Add devcontainer.json for Go/Rust/Java services
- [ ] **TODO:** Configure Dependabot for all ecosystems

## Phase 2: Managed Service Migration
*Reference: Master Plan Section 4*

- [ ] Migrate PostgreSQL to Supabase (pgvector ready)
- [ ] Migrate Redis to Upstash
- [ ] Configure GitHub Environments (staging/production)
- [ ] Set up OIDC for AWS IAM (secretless deploys)

## Phase 3: Integration & E2E Testing
*Reference: Master Plan Section 7 - Largest work item (15,000-25,000 LOC)*

- [ ] Set up integration test infrastructure
- [ ] Test: User registration flow
- [ ] Test: Article creation → AI Propose → Human Approve → Publish
- [ ] Test: Syndication webhook → Feed updated
- [ ] Load testing setup

## Phase 4: Editorial Dashboard Completions
*Reference: Master Plan Table 3.1*

- [ ] Calendar/kanban editorial planning view
- [ ] Tenant management UI (API exists)
- [ ] Bulk actions (multi-select approve/transition/delete)
- [ ] Standalone media library page

## Phase 5: Auth & Enterprise
*Reference: Master Plan Section 7*

- [ ] SSO/OIDC integration (BLOCKED - pending IdP decision)
- [ ] Password reset flow
- [ ] Login rate limiting
- [ ] Session revocation
- [ ] Audit trail outbox pattern

## Phase 6: Media & Search
*Reference: Master Plan Section 7*

- [ ] Image crate integration (besbpo-blog-search-media-svc)
- [ ] Public search UI for blog.besbpo.co.za
- [ ] tantivy/OpenSearch promotion path

## Phase 7: IaC & Observability
*Reference: Master Plan Section 7*

- [ ] Terraform provisioning (Supabase/Upstash/AWS)
- [ ] Structured logging across all services
- [ ] Prometheus metrics + Grafana dashboards
- [ ] OpenTelemetry distributed tracing

## Phase 8: Subsidiary Site Expansion
*Reference: Master Plan Section 5.1*

- [ ] 25+ remaining sites (BLOCKED - pending names/domains from Besbpo Group)
- [ ] Automated scaffolding workflow

## Phase 9: GitHub Platform Hardening
*Reference: Master Plan Section 6*

- [ ] GitHub Packages (@besbpo/shared-types)
- [ ] CodeQL security scanning
- [ ] Branch protection + required reviewers
- [ ] GitHub Projects (unified backlog)

---

## Current Status

### Build Status
| Repository | Tests | Status |
|-----------|-------|--------|
| besbpo-blog-cms-api | 119/123 | ✅ |
| besbpo-blog-intelligence-svc | 54 | ✅ |
| besbpo-blog-web | 20 | ✅ |
| bespbo-editorial-dashboard | 73 | ✅ |
| besbpo-embed-widget | 6 | ✅ |
| besbpo-blog-syndication-svc | 54 | ⚠️ Not verified (no Go) |
| besbpo-blog-search-media-svc | 30 | ⚠️ Not verified (no Rust) |
| besbpo-blog-enterprise-svc | 11 | ⚠️ Not verified (no JDK) |

### What's Been Completed
- ✅ Development environment set up
- ✅ All services build successfully  
- ✅ Docker Compose for local development
- ✅ GitHub Pages deployment configured
- ✅ Landing page at repository root
- ✅ CNAME for blog.besbpo.co.za
- ✅ Comprehensive documentation

### Immediate Next Steps
1. Push repositories to GitHub to trigger CI
2. Add devcontainer.json for toolchain verification
3. Configure Dependabot for security updates
4. Migrate to Supabase and Upstash

### Blockers
- **Phase 1:** CI never triggered (needs repo push)
- **Phase 5:** SSO blocked on IdP decision
- **Phase 8:** Subsidiary sites blocked on business input

---

## Documentation Links
- [Development Guide](./DEVELOPMENT.md)
- [Task Tracking](./TASK_TRACKING.md)
- [Progress](./PROGRESS.md)
- [Deployment](./DEPLOYMENT.md)
- [Architecture Repo](../besbpo-blog-architecture/)
