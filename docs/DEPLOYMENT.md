# BESBPO Blog Platform - Deployment Guide

## Architecture Overview

The BESBPO Blog Platform follows a two-tier architecture:

| Tier | Description | Deployment |
|------|-------------|------------|
| **Tier 1 (Static)** | Public blog + subsidiary sites | GitHub Pages |
| **Tier 2 (Dynamic)** | CMS API, Syndication, Intelligence | Coolify on AWS |

## Quick Start - Local Development

### Option 1: Docker Compose (Full Stack)

```bash
# Start all services
docker-compose up

# Services will be available at:
# - CMS API: http://localhost:3000
# - Editorial Dashboard: http://localhost:3001
# - Blog Web (dev): http://localhost:3002
# - Intelligence Service: http://localhost:8000
# - Syndication Service: http://localhost:8080
# - PostgreSQL: localhost:5432
# - Redis: localhost:6379
```

### Option 2: Individual Services

**Public Blog (no backend needed for testing):**
```bash
cd besbpo-blog-web
npm install
npm run dev  # http://localhost:3000 with fixture data
```

**CMS API:**
```bash
cd besbpo-blog-cms-api
npm install
# Requires PostgreSQL with uuid-ossp and vector extensions
npm run start:dev  # http://localhost:3000
```

**Editorial Dashboard:**
```bash
cd bespbo-editorial-dashboard
npm install
CMS_API_BASE_URL=http://localhost:3000 npm run dev
```

---

## GitHub Pages Deployment (blog.besbpo.co.za)

### Prerequisites

1. **DNS Configuration:** Create a CNAME record in your DNS provider:
   ```
   blog.besbpo.co.za → CNAME → affiliatedarchitecturegroupdev-cmyk.github.io
   ```

2. **GitHub Repository Settings:**
   - Go to Settings → Pages
   - Source: Deploy from a branch
   - Branch: `gh-pages` / (root)

### Steps

1. **Enable GitHub Pages:**
   - Navigate to `https://github.com/affiliatedarchitecturegroupdev-cmyk/BESBPO-Blog-Ecosystem/settings/pages`
   - Select "Deploy from a branch"
   - Select "main" branch and "/ (root)" folder

2. **Configure Custom Domain:**
   - In the same GitHub Pages settings, enter `blog.besbpo.co.za`
   - Check "Enforce HTTPS"

3. **Set Secrets (for production CMS API):**
   - Go to Settings → Secrets and variables → Actions
   - Add `CMS_API_BASE_URL`: `https://your-cms-api.example.com`

4. **Trigger First Deploy:**
   ```bash
   git push origin main
   ```
   The GitHub Actions workflow will:
   - Build the Next.js static site
   - Deploy to GitHub Pages
   - Site will be available at `https://blog.besbpo.co.za`

### Manual Build

```bash
cd besbpo-blog-web
npm install
npm run build
# Output is in ./out/
```

---

## AWS/Coolify Deployment (Tier 2 Services)

### Services to Deploy

| Service | Port | Purpose |
|---------|------|---------|
| CMS API | 3000 | Content management, authentication |
| Syndication | 8080 | RSS/Atom distribution, webhook handler |
| Intelligence | 8000 | AI content analysis, SEO suggestions |
| Editorial Dashboard | 3001 | Authoring UI |

### Coolify Setup

1. **Add Environment Variables:**
   ```
   DATABASE_URL=postgresql://user:pass@host:5432/besbpo
   JWT_SECRET=<generate-secure-secret>
   REDIS_URL=redis://host:6379
   ```

2. **Environment-Specific URLs:**
   ```
   # For CMS API
   CMS_API_BASE_URL=https://cms-api.besbpo.co.za
   
   # For Syndication Service
   CMS_API_BASE_URL=http://cms-api:3000
   ADMIN_JWT_SECRET=<same-as-above>
   ```

### Database Setup

PostgreSQL with extensions:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
```

Or use Docker:
```bash
docker run -d -p 5432:5432 \
  -e POSTGRES_PASSWORD=secret \
  --name besbpo-db \
  pgvector/pgvector:pg16
```

---

## Subsidiary Sites (GitHub Pages)

Each subsidiary site (`besbpo-subsidiary-site-*`) can be deployed to GitHub Pages:

1. Enable GitHub Pages in repository settings
2. Configure custom domain (e.g., `security.besbpo.co.za`)
3. The embed widget will automatically load from CDN

---

## Testing Checklist

### Local Testing
- [ ] `npm run dev` in besbpo-blog-web (fixture data)
- [ ] `npm run build` produces valid static output
- [ ] All tests pass: `npm run test:all`

### Integration Testing
- [ ] CMS API starts with PostgreSQL
- [ ] Blog Web connects to CMS API
- [ ] Editorial Dashboard authenticates

### Production Testing
- [ ] GitHub Pages deploys successfully
- [ ] Custom domain HTTPS works
- [ ] CMS API webhook triggers rebuild

---

## Troubleshooting

### "Fixture data" warning in production
Set `CMS_API_BASE_URL` environment variable to your production CMS API URL.

### Docker Compose fails to start
- Ensure Docker is running
- Check port availability: `docker ps`
- View logs: `docker-compose logs <service>`

### GitHub Pages 404
- Verify CNAME record propagates: `dig blog.besbpo.co.za`
- Check GitHub Pages settings match domain
- Ensure HTTPS is enforced

### Build fails in GitHub Actions
- Check workflow logs for errors
- Verify secrets are configured
- Ensure all dependencies resolve
