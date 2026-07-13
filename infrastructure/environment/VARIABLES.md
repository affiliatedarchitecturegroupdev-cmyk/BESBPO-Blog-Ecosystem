# Environment Variables Reference
# Reference: Master Plan Section 4

## Local Development (docker-compose.yml)

| Variable | Service | Description | Default |
|----------|---------|-------------|---------|
| `DATABASE_URL` | cms-api, syndication-svc | PostgreSQL connection | `postgresql://postgres:postgres@db:5432/besbpo` |
| `REDIS_URL` | syndication-svc, search-media-svc | Redis connection | `redis://redis:6379` |
| `JWT_SECRET` | cms-api, syndication-svc | JWT signing secret | `dev-secret-change-in-production` |
| `JWT_EXPIRES_IN` | cms-api | JWT expiration | `15m` |
| `NODE_ENV` | All Node services | Environment | `development` |
| `ANTHROPIC_API_KEY` | intelligence-svc | Anthropic API key | - |
| `VOYAGE_API_KEY` | intelligence-svc | Voyage AI API key | - |
| `CMS_API_BASE_URL` | editorial-dashboard, blog-web | CMS API URL | `http://localhost:3000` |
| `NEXT_PUBLIC_CMS_API_URL` | editorial-dashboard | Public CMS API URL | `http://localhost:3000` |
| `AWS_S3_BUCKET` | cms-api | S3 bucket name | - |
| `AWS_REGION` | cms-api | AWS region | `us-east-1` |
| `AWS_ACCESS_KEY_ID` | cms-api | AWS access key | - |
| `AWS_SECRET_ACCESS_KEY` | cms-api | AWS secret key | - |

## Managed Services (docker-compose.managed.yml)

| Variable | Service | Description | Source |
|----------|---------|-------------|--------|
| `SUPABASE_DATABASE_URL` | All services | Supabase PostgreSQL URL | Supabase Dashboard |
| `SUPABASE_ANON_KEY` | All services | Supabase anonymous key | Supabase Dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | All services | Supabase service role key | Supabase Dashboard |
| `UPSTASH_REDIS_REST_URL` | All services | Upstash Redis REST URL | Upstash Console |
| `UPSTASH_REDIS_REST_TOKEN` | All services | Upstash Redis token | Upstash Console |
| `JWT_SECRET` | All services | JWT signing secret | Generate secure random |
| `CMS_API_URL` | editorial-dashboard | Production CMS API URL | - |
| `NEXT_PUBLIC_CMS_API_URL` | editorial-dashboard | Public CMS API URL | - |

## GitHub Actions (Secrets)

| Variable | Description | Set In |
|----------|-------------|--------|
| `SUPABASE_DATABASE_URL` | Production database URL | GitHub Repository Secrets |
| `SUPABASE_ANON_KEY` | Production anon key | GitHub Repository Secrets |
| `SUPABASE_SERVICE_ROLE_KEY` | Production service key | GitHub Repository Secrets |
| `UPSTASH_REDIS_REST_URL` | Production Redis URL | GitHub Repository Secrets |
| `UPSTASH_REDIS_REST_TOKEN` | Production Redis token | GitHub Repository Secrets |
| `JWT_SECRET` | Production JWT secret | GitHub Repository Secrets |
| `ANTHROPIC_API_KEY` | Anthropic API key | GitHub Repository Secrets |
| `VOYAGE_API_KEY` | Voyage AI API key | GitHub Repository Secrets |
| `AWS_REGION` | AWS region | GitHub Repository Variables |
| `PROD_GITHUB_ACTIONS_ROLE_ARN` | Production IAM role ARN | GitHub Repository Variables |
| `STAGING_GITHUB_ACTIONS_ROLE_ARN` | Staging IAM role ARN | GitHub Repository Variables |

## Required Setup Steps

### 1. Supabase Setup
```bash
# 1. Create project at https://supabase.com
# 2. Get project reference from Settings > API
# 3. Get database password from Settings > Database
# 4. Run setup script
cd infrastructure/supabase
./setup.sh
```

### 2. Upstash Setup
```bash
# 1. Create Redis database at https://console.upstash.com/
# 2. Copy REST URL and Token
# 3. Run setup script
cd infrastructure/upstash
./setup.sh
```

### 3. AWS OIDC Setup
```bash
# 1. Apply Terraform configuration
cd infrastructure/aws
terraform init
terraform apply
# 2. Copy role ARNs to GitHub Repository Variables
```

### 4. GitHub Secrets Setup
```bash
# Add secrets to GitHub: Repository > Settings > Secrets and variables > Actions
# Required secrets:
# - SUPABASE_DATABASE_URL
# - SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_ROLE_KEY
# - UPSTASH_REDIS_REST_URL
# - UPSTASH_REDIS_REST_TOKEN
# - JWT_SECRET
# - ANTHROPIC_API_KEY
# - VOYAGE_API_KEY
```
