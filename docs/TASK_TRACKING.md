# BESBPO Blog Platform - Task Tracking

## Sprint 1: Foundation Verification (This Sprint)

### Goal: Trigger CI/CD and verify all code compiles

#### Infrastructure Setup
- [ ] **TASK-001** Create `.devcontainer.json` for besbpo-blog-cms-api
  - Node.js 20, PostgreSQL client tools
  - Reference: Master Plan §6.4
  
- [ ] **TASK-002** Create `.devcontainer.json` for besbpo-blog-syndication-svc
  - Go 1.22
  - Reference: Master Plan §6.4
  
- [ ] **TASK-003** Create `.devcontainer.json` for besbpo-blog-intelligence-svc
  - Python, Poetry
  - Reference: Master Plan §6.4
  
- [ ] **TASK-004** Create `.devcontainer.json` for besbpo-blog-search-media-svc
  - Rust stable
  - Reference: Master Plan §6.4
  
- [ ] **TASK-005** Create `.devcontainer.json` for besbpo-blog-enterprise-svc
  - JDK 21, Maven
  - Reference: Master Plan §6.4

#### CI/CD Verification
- [ ] **TASK-010** Verify CI triggers in besbpo-blog-architecture
  - Schema.sql applies to real PostgreSQL
  - First test: Author/User FK constraint
  
- [ ] **TASK-011** Verify CI triggers in besbpo-blog-cms-api
  - npm install, tsc, npm test
  - 123 tests should execute
  
- [ ] **TASK-012** Verify CI triggers in besbpo-blog-web
  - npm install, build, component tests
  - 20 tests should execute
  
- [ ] **TASK-013** Verify CI triggers in besbpo-editorial-dashboard
  - 73 tests should execute
  
- [ ] **TASK-014** Verify CI triggers in besbpo-blog-intelligence-svc
  - pytest runs, 54 tests pass
  
- [ ] **TASK-015** Verify CI triggers in besbpo-blog-syndication-svc
  - go build, go test
  - 54 tests should execute (first time!)
  
- [ ] **TASK-016** Verify CI triggers in besbpo-blog-search-media-svc
  - cargo build, cargo test
  - 30 tests should execute (first time!)
  
- [ ] **TASK-017** Verify CI triggers in besbpo-blog-enterprise-svc
  - mvn compile, mvn test
  - 11 tests should execute (first time!)

#### Dependency Management
- [ ] **TASK-020** Configure Dependabot for npm dependencies
  - All TypeScript/JavaScript repositories
  - Weekly schedule
  
- [ ] **TASK-021** Configure Dependabot for Go dependencies
  - besbpo-blog-syndication-svc
  
- [ ] **TASK-022** Configure Dependabot for Cargo dependencies
  - besbpo-blog-search-media-svc
  
- [ ] **TASK-023** Configure Dependabot for Maven dependencies
  - besbpo-blog-enterprise-svc

---

## Sprint 2: Managed Services Migration

### Goal: Migrate to Supabase and Upstash

#### Supabase Migration
- [ ] **TASK-030** Create Supabase project
  - Enable pgvector extension
  - Note connection string
  
- [ ] **TASK-031** Update DATABASE_URL in all services
  - besbpo-blog-cms-api
  - besbpo-blog-syndication-svc
  - besbpo-blog-search-media-svc
  
- [ ] **TASK-032** Apply schema.sql to Supabase
  - Run all migrations
  - Verify 13 tables created
  
- [ ] **TASK-033** Configure Supabase backups
  - Point-in-time recovery enabled
  - Verify backup schedule

#### Upstash Migration
- [ ] **TASK-040** Create Upstash Redis project
  - TCP endpoint
  - Note connection URL
  
- [ ] **TASK-041** Update REDIS_URL in syndication service
  - besbpo-blog-syndication-svc

#### GitHub Environments
- [ ] **TASK-050** Create staging environment
  - Supabase staging project
  - Upstash staging project
  - Staging secrets
  
- [ ] **TASK-051** Create production environment
  - Production Supabase
  - Production Upstash
  - Required reviewer gate

---

## Sprint 3: Integration Testing

### Goal: Verify end-to-end workflows

#### Test Infrastructure
- [ ] **TASK-060** Create integration test Docker Compose
  - All services
  - Real PostgreSQL
  - Test data seeding
  
- [ ] **TASK-061** Set up test database
  - Clean schema on each test run
  - Fixture data
  
- [ ] **TASK-062** Create test utilities
  - API client helpers
  - Auth helpers
  - Database helpers

#### E2E Workflow Tests
- [ ] **TASK-070** Test: User registration flow
  - Register → Receive JWT → Access protected route
  
- [ ] **TASK-071** Test: Article creation flow
  - Create draft → Add content → Upload image
  
- [ ] **TASK-072** Test: AI proposal flow
  - Request AI → Receive proposals → Approve fields
  
- [ ] **TASK-073** Test: Publish flow
  - Submit for review → Approve → Publish
  
- [ ] **TASK-074** Test: Syndication flow
  - Publish → Webhook fired → Feed updated
  
- [ ] **TASK-075** Test: Subsidiary feed consumption
  - Read syndication feed → Verify article appears

#### Load Testing
- [ ] **TASK-080** Configure k6 for load testing
  - Create scripts for key endpoints
  - Define SLIs/SLOs

---

## Sprint 4: Editorial Dashboard

### Goal: Complete the authoring UI

#### Calendar View
- [ ] **TASK-090** Design calendar data model
  - Editorial calendar events
  - Scheduling vs. publish dates
  
- [ ] **TASK-091** Implement calendar API endpoints
  - CRUD for calendar events
  - Query by date range
  
- [ ] **TASK-092** Build calendar UI component
  - Month/week/day views
  - Drag-and-drop scheduling
  - Division filtering

#### Tenant Management
- [ ] **TASK-100** Design tenant management UI
  - List all tenants
  - Add/edit tenant form
  - Tenant settings
  
- [ ] **TASK-101** Implement tenant CRUD in dashboard
  - Calls existing syndication API

#### Bulk Actions
- [ ] **TASK-110** Implement multi-select in article list
  - Checkbox selection
  - Select all
  
- [ ] **TASK-111** Implement bulk operations
  - Bulk approve
  - Bulk status change
  - Bulk delete (with confirmation)

#### Media Library
- [ ] **TASK-120** Create standalone media library page
  - Grid/list view toggle
  - Search and filter
  - Usage count per asset

---

## Sprint 5: Auth & Enterprise

### Goal: SSO integration and auth hardening

#### SSO Setup (Blocked - awaiting IdP decision)
- [ ] **TASK-130** Choose identity provider
  - Okta, Auth0, Azure AD, etc.
  
- [ ] **TASK-131** Implement SSO login flow
  - OIDC/OAuth2 integration
  - Session management
  
- [ ] **TASK-132** Migrate existing users to SSO
  - User mapping
  - Password migration

#### Auth Hardening
- [ ] **TASK-140** Implement password reset flow
  - Email verification
  - Reset link expiry
  
- [ ] **TASK-141** Add login rate limiting
  - Brute force protection
  - Account lockout
  
- [ ] **TASK-142** Implement session revocation
  - Force logout
  - Device management

---

## Sprint 6: Media & Search

### Goal: Complete image processing and search

#### Image Processing
- [ ] **TASK-150** Implement image crate integration
  - besbpo-blog-search-media-svc/src/media.rs
  - WebP/AVIF generation
  
- [ ] **TASK-151** Implement image optimization pipeline
  - Responsive images
  - Quality optimization

#### Search Features
- [ ] **TASK-160** Build public search UI
  - Semantic search
  - Keyword + vector hybrid
  
- [ ] **TASK-161** Add search analytics
  - Popular queries
  - Zero results tracking

---

## Backlog: Subsidiary Sites

### Goal: Expand syndication network

- [ ] **TASK-200** Gather subsidiary site requirements
  - 25+ sites pending names/domains
  
- [ ] **TASK-201** Create site scaffolding workflow
  - Automated repo creation
  - Domain configuration

---

## Backlog: Observability

### Goal: Full observability stack

- [ ] **TASK-210** Implement structured logging
  - JSON format
  - Correlation IDs
  
- [ ] **TASK-211** Add Prometheus metrics
  - Request latency
  - Error rates
  - Business metrics
  
- [ ] **TASK-212** Set up OpenTelemetry tracing
  - Trace propagation
  - Distributed tracing UI
  
- [ ] **TASK-213** Create dashboards
  - Grafana dashboards
  - Alerting rules

---

## Task Priority Legend

| Priority | Description |
|----------|-------------|
| P0 | Critical - blocks all other work |
| P1 | High - significant impact |
| P2 | Medium - important but not blocking |
| P3 | Low - nice to have |

---

## Story Points Guide

| Points | Complexity | Description |
|--------|------------|-------------|
| 1 | Very Low | Simple fix, single file |
| 2 | Low | Small change, well understood |
| 3 | Medium | Moderate complexity, some unknowns |
| 5 | High | Complex, multiple components |
| 8 | Very High | Major feature, many unknowns |
| 13 | Epic | Large feature, needs breakdown |

---

## Definition of Done

- [ ] Code written and compiles
- [ ] Unit tests written and passing
- [ ] Integration tests pass
- [ ] Documentation updated
- [ ] No breaking changes to existing functionality
- [ ] Reviewed by at least one other developer
