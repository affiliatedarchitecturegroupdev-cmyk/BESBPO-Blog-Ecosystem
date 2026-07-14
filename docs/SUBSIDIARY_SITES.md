# BESBPO Subsidiary Sites - Expansion Guide

## Overview

This document describes the subsidiary site expansion strategy for the BESBPO Blog Platform, including the automated scaffolding workflow and best practices.

## Current Status

| Metric | Count |
|--------|-------|
| Total Subsidiary Sites | 11 |
| Live Sites | 5 (Pilot) |
| Scaffolded Sites | 6 (New) |
| Planned Sites | 25+ |

## Existing Sites (Pilot)

| Site | Subdomain | Division | Status |
|------|-----------|----------|--------|
| BEIE | beie.besbpo.co.za | built-environment | 🟡 Pending onboarding |
| Bellwether Architecture | bellwether.besbpo.co.za | built-environment | 🟡 Pending onboarding |
| Bouncer VIP Express | bouncer.besbpo.co.za | transportation | 🟡 Pending onboarding |
| Garlaws | garlaws.besbpo.co.za | built-environment | 🟡 Pending onboarding |
| Lastmile Gig | lastmile.besbpo.co.za | transportation | 🟡 Pending onboarding |

## New Sites (Phase 8)

| Site | Subdomain | Division | Status |
|------|-----------|----------|--------|
| Smart Cities | smart-cities.besbpo.co.za | smart-cities | 🟢 Scaffolded |
| Infrastructure | infrastructure.besbpo.co.za | infrastructure | 🟢 Scaffolded |
| Sustainability | sustainability.besbpo.co.za | sustainability | 🟢 Scaffolded |

## Planned Sites

The following sites are planned based on BESBPO divisions:

| Site Name | Division | Priority |
|-----------|----------|----------|
| Transportation | transportation | High |
| Energy | energy | High |
| Investment Finance | investment-finance | Medium |
| Housing | housing | Medium |
| Water Waste | water-waste | Medium |
| Built Environment | built-environment | High |
| Smart Cities | smart-cities | High |
| Infrastructure | infrastructure | High |
| Sustainability | sustainability | Medium |

## Scaffolding Workflow

### Prerequisites

1. Access to the `besbpo-blog-ecosystem` repository
2. Write access to create new directories
3. DNS configuration access for subdomain setup

### Creating a New Subsidiary Site

#### Option 1: Automated Scaffolding (Recommended)

```bash
# Navigate to repository root
cd /workspace/project

# Run the scaffolding script
./scripts/subsidiary-sites/scaffold.sh "Site Name" \
  --subdomain "site-slug" \
  --division "division-name" \
  --description "Brief description"

# Example
./scripts/subsidiary-sites/scaffold.sh "Transportation" \
  --subdomain "transportation" \
  --division "transportation" \
  --description "Transportation and mobility solutions"
```

#### Option 2: Manual Creation

1. Copy the template directory:
   ```bash
   cp -r besbpo-subsidiary-site-template besbpo-subsidiary-site-YOUR-SLUG
   ```

2. Update `config.json` with tenant information

3. Update placeholders in HTML/CSS files

4. Create subdomain DNS record

## Directory Structure

```
besbpo-subsidiary-site-{slug}/
├── assets/
│   ├── logo.svg           # Subsidiary logo
│   ├── favicon.svg        # Site favicon
│   └── style.css          # Custom styles
├── config.json            # Site configuration
├── index.html             # Main page
├── README.md              # Site documentation
└── .github/
    └── workflows/
        └── deploy.yml     # CI/CD pipeline
```

## Configuration

### config.json Fields

```json
{
  "tenant_id": "TENANT-UUID",
  "division_tags": ["division-name"],
  "display_mode": "full_site",
  "max_items": 20,
  "brand_name": "Site Display Name",
  "subdomain": "site-slug",
  "domain": "site-slug.besbpo.co.za",
  "theme": {
    "primary_color": "#1e40af",
    "secondary_color": "#3b82f6",
    "accent_color": "#60a5fa"
  },
  "features": {
    "show_articles": true,
    "show_events": false,
    "show_team": false,
    "show_contact": true
  }
}
```

## Onboarding Checklist

- [ ] Create GitHub repository from template
- [ ] Update `config.json` with tenant_id
- [ ] Configure subdomain DNS
- [ ] Set up SSL certificate
- [ ] Update brand name and logo
- [ ] Customize theme colors
- [ ] Configure syndication settings
- [ ] Test blog embed widget
- [ ] Enable CI/CD pipeline
- [ ] Deploy to staging
- [ ] Test and verify
- [ ] Deploy to production

## Domain Configuration

### DNS Setup

Create a CNAME record:

```
Type    Name            Value                           TTL
CNAME   your-slug       besbpo-subsidiary-sites.cloudflare.net  300
```

### SSL/TLS

Certificates are automatically managed by Cert Manager on Kubernetes.

## CI/CD Pipeline

Each subsidiary site includes a GitHub Actions workflow:

```yaml
name: Deploy
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: besbpo-subsidiary-site-YOUR-SLUG
          directory: ./
```

## Monitoring

Subsidiary sites are monitored via:

1. **Uptime Monitoring**: Cloudflare Analytics
2. **Error Tracking**: Sentry (if configured)
3. **Analytics**: Cloudflare Web Analytics

## Support

For issues or questions:
- Email: support@besbpo.co.za
- GitHub Issues: Create in main repository

## Future Enhancements

1. **Multi-language Support**: Add i18n configuration
2. **Custom Domains**: Allow fully custom domains
3. **White-label Options**: Complete rebranding capability
4. **Analytics Dashboard**: Dedicated site metrics
5. **A/B Testing**: Integration with experimentation platform
