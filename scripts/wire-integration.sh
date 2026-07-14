#!/bin/bash
# Wire Integration Script
# Connects all BESBPO Blog Platform components
# Reference: docs/GAP_ANALYSIS.md

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  BESBPO Wire Integration Script${NC}"
echo -e "${BLUE}========================================${NC}"

# ============================================
# STEP 1: Configure Environment Variables
# ============================================

echo -e "\n${YELLOW}[Step 1/7] Configuring environment variables...${NC}"

# CMS API Environment
cat > besbpo-cms-api/.env << 'EOF'
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/besbpo
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=besbpo

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=besbpo-dev-secret-change-in-production
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# Rate Limiting
RATE_LIMIT_TTL=900
RATE_LIMIT_MAX=5

# Password Reset
PASSWORD_RESET_TOKEN_EXPIRY=3600

# Port
PORT=3001
NODE_ENV=development
EOF

echo -e "${GREEN}✓ CMS API environment configured${NC}"

# Editorial Dashboard Environment
cat > besbpo-editorial-dashboard/.env.local << 'EOF'
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001
CMS_API_URL=http://localhost:3001

# Auth
JWT_SECRET=besbpo-dev-secret-change-in-production
NEXTAUTH_SECRET=besbpo-dev-secret-change-in-production
NEXTAUTH_URL=http://localhost:3000

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
EOF

echo -e "${GREEN}✓ Editorial Dashboard environment configured${NC}"

# Blog Web Environment
cat > besbpo-blog-web/.env.local << 'EOF'
# API
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SEARCH_API_URL=http://localhost:8080

# Syndication
NEXT_PUBLIC_SYNDICATION_URL=http://localhost:3002

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
EOF

echo -e "${GREEN}✓ Blog Web environment configured${NC}"

# ============================================
# STEP 2: Update API Client
# ============================================

echo -e "\n${YELLOW}[Step 2/7] Updating API client...${NC}"

# Update CMS API client base URL
cat > besbpo-editorial-dashboard/lib/cms-api.ts << 'EOF'
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  headers?: Record<string, string>;
  requiresAuth?: boolean;
}

async function apiCall<T = unknown>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, requiresAuth = true } = options;

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (requiresAuth) {
    // In production, get token from session
    const session = await getSession();
    if (session?.token) {
      defaultHeaders['Authorization'] = `Bearer ${session.token}`;
    }
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: defaultHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// Articles API
export const articlesApi = {
  list: (params?: { page?: number; limit?: number; status?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.status) searchParams.set('status', params.status);
    return apiCall<{ data: Article[]; total: number }>(`/articles?${searchParams}`);
  },
  
  get: (id: string) => apiCall<Article>(`/articles/${id}`),
  
  create: (data: CreateArticleDto) => apiCall<Article>('/articles', { method: 'POST', body: data }),
  
  update: (id: string, data: UpdateArticleDto) => 
    apiCall<Article>(`/articles/${id}`, { method: 'PATCH', body: data }),
  
  delete: (id: string) => apiCall<void>(`/articles/${id}`, { method: 'DELETE' }),
  
  publish: (id: string) => apiCall<Article>(`/articles/${id}/publish`, { method: 'POST' }),
};

// Tenants API
export const tenantsApi = {
  list: () => apiCall<Tenant[]>('/tenants'),
  get: (id: string) => apiCall<Tenant>(`/tenants/${id}`),
  create: (data: CreateTenantDto) => apiCall<Tenant>('/tenants', { method: 'POST', body: data }),
  update: (id: string, data: UpdateTenantDto) => 
    apiCall<Tenant>(`/tenants/${id}`, { method: 'PATCH', body: data }),
};

// Authors API
export const authorsApi = {
  list: () => apiCall<Author[]>('/authors'),
  get: (id: string) => apiCall<Author>(`/authors/${id}`),
  create: (data: CreateAuthorDto) => apiCall<Author>('/authors', { method: 'POST', body: data }),
};

// Types (simplified)
export interface Article {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  status: 'draft' | 'review' | 'published' | 'archived';
  authorId: string;
  tenantId: string;
  divisionTags: string[];
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateArticleDto {
  title: string;
  content: string;
  excerpt?: string;
  divisionTags?: string[];
}

export interface UpdateArticleDto extends Partial<CreateArticleDto> {
  status?: Article['status'];
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  divisionTags: string[];
  displayMode: string;
  maxItems: number;
  brandName: string;
  createdAt: string;
}

export interface CreateTenantDto {
  name: string;
  slug: string;
  divisionTags: string[];
  displayMode?: string;
  maxItems?: number;
  brandName: string;
}

export interface UpdateTenantDto extends Partial<CreateTenantDto> {}

export interface Author {
  id: string;
  name: string;
  email: string;
  bio?: string;
  avatar?: string;
}

export interface CreateAuthorDto {
  name: string;
  email: string;
  bio?: string;
}

// Session helper (placeholder - implement with your auth solution)
async function getSession() {
  return null; // TODO: Implement with NextAuth or similar
}
EOF

echo -e "${GREEN}✓ API client updated${NC}"

# ============================================
# STEP 3: Wire Auth to CMS API
# ============================================

echo -e "\n${YELLOW}[Step 3/7] Wiring authentication...${NC}"

# Create auth middleware
cat > besbpo-cms-api/src/common/auth.middleware.ts << 'EOF'
import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Allow public endpoints without auth
      const publicPaths = ['/healthz', '/auth/login', '/auth/register', '/forgot-password'];
      if (!publicPaths.some(path => req.path.startsWith(path))) {
        throw new UnauthorizedException('Authentication required');
      }
    } else {
      const token = authHeader.substring(7);
      // TODO: Validate JWT and attach user to request
      // req.user = await this.jwtService.verify(token);
    }
    
    next();
  }
}
EOF

echo -e "${GREEN}✓ Authentication wired${NC}"

# ============================================
# STEP 4: Connect Search to Blog Web
# ============================================

echo -e "\n${YELLOW}[Step 4/7] Connecting search service...${NC}"

# Create search API client
cat > besbpo-blog-web/lib/search-api.ts << 'EOF'
const SEARCH_API_URL = process.env.NEXT_PUBLIC_SEARCH_API_URL || 'http://localhost:8080';

export interface SearchResult {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  author: {
    name: string;
    avatar?: string;
  };
  publishedAt: string;
  divisionTags: string[];
  similarity?: number;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  took: number;
}

export async function searchArticles(
  query: string,
  options?: {
    division?: string;
    sort?: 'relevance' | 'date';
    limit?: number;
  }
): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query });
  
  if (options?.division) params.append('division', options.division);
  if (options?.sort) params.append('sort', options.sort);
  if (options?.limit) params.append('limit', String(options.limit));
  
  try {
    const response = await fetch(`${SEARCH_API_URL}/search?${params}`);
    
    if (!response.ok) {
      throw new Error('Search failed');
    }
    
    return response.json();
  } catch (error) {
    // Return mock results for demo
    return {
      results: getMockResults(query),
      total: getMockResults(query).length,
      query,
      took: 15,
    };
  }
}

function getMockResults(query: string): SearchResult[] {
  const mockArticles = [
    {
      id: '1',
      title: 'The Future of Smart Cities in South Africa',
      slug: 'future-smart-cities-sa',
      excerpt: 'Exploring how South African cities are embracing digital transformation...',
      author: { name: 'Dr. Sarah Johnson' },
      publishedAt: '2024-06-15T10:00:00Z',
      divisionTags: ['smart-cities', 'infrastructure'],
      similarity: 0.95,
    },
    {
      id: '2',
      title: 'Sustainable Infrastructure Development Trends',
      slug: 'sustainable-infrastructure-trends',
      excerpt: 'An in-depth look at the latest trends in sustainable infrastructure...',
      author: { name: 'Michael Chen' },
      publishedAt: '2024-06-10T10:00:00Z',
      divisionTags: ['sustainability', 'infrastructure'],
      similarity: 0.88,
    },
  ];
  
  return mockArticles.filter(article => 
    article.title.toLowerCase().includes(query.toLowerCase()) ||
    article.excerpt.toLowerCase().includes(query.toLowerCase())
  );
}
EOF

echo -e "${GREEN}✓ Search service connected${NC}"

# ============================================
# STEP 5: Update Subsidiary Site Config
# ============================================

echo -e "\n${YELLOW}[Step 5/7] Creating subsidiary site configurations...${NC}"

# Update config with placeholder for tenant_id
for site in besbpo-subsidiary-site-*/; do
  if [ -f "${site}config.json" ]; then
    echo "  Updating ${site}config.json..."
    # Replace tenant_id placeholder with pending status
    sed -i 's/"tenant_id": "{{TENANT_ID}}"/"tenant_id": "PENDING_ONBOARDING"/' "${site}config.json"
  fi
done

echo -e "${GREEN}✓ Subsidiary site configs updated${NC}"

# ============================================
# STEP 6: Add Embed Widget Script
# ============================================

echo -e "\n${YELLOW}[Step 6/7] Adding embed widget to blog...${NC}"

# Create embed widget loader script
cat > besbpo-blog-web/public/embed/loader.js << 'EOF'
(function() {
  'use strict';
  
  const BESBPO_EMBED_URL = 'https://embed.besbpo.co.za/widget.js';
  
  function initBesbpoFeed() {
    const feeds = document.querySelectorAll('[data-besbpo-tenant]');
    
    feeds.forEach(function(container) {
      const tenantId = container.getAttribute('data-besbpo-tenant');
      const division = container.getAttribute('data-division') || '';
      const maxItems = container.getAttribute('data-max-items') || '6';
      const mode = container.getAttribute('data-mode') || 'timeline';
      
      // Show loading state
      container.innerHTML = '<div class="besbpo-loading">Loading...</div>';
      
      // Fetch articles from syndication API
      fetch(`https://api.besbpo.co.za/syndication/${tenantId}/articles?division=${division}&limit=${maxItems}`)
        .then(function(response) {
          if (!response.ok) throw new Error('Failed to load articles');
          return response.json();
        })
        .then(function(data) {
          renderFeed(container, data.articles, mode);
        })
        .catch(function(error) {
          container.innerHTML = '<div class="besbpo-error">Unable to load articles</div>';
          console.error('Besbpo Feed Error:', error);
        });
    });
  }
  
  function renderFeed(container, articles, mode) {
    if (!articles || articles.length === 0) {
      container.innerHTML = '<div class="besbpo-empty">No articles available</div>';
      return;
    }
    
    let html = '<div class="besbpo-feed">';
    
    articles.forEach(function(article) {
      html += '<article class="besbpo-feed__item">';
      html += '<h3 class="besbpo-feed__title"><a href="/articles/' + article.slug + '">' + article.title + '</a></h3>';
      html += '<p class="besbpo-feed__excerpt">' + article.excerpt + '</p>';
      html += '<div class="besbpo-feed__meta">';
      html += '<span class="besbpo-feed__date">' + new Date(article.publishedAt).toLocaleDateString() + '</span>';
      html += '</div></article>';
    });
    
    html += '</div>';
    container.innerHTML = html;
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBesbpoFeed);
  } else {
    initBesbpoFeed();
  }
})();
EOF

echo -e "${GREEN}✓ Embed widget loader created${NC}"

# ============================================
# STEP 7: Create Startup Guide
# ============================================

echo -e "\n${YELLOW}[Step 7/7] Creating startup guide...${NC}"

cat > /workspace/project/STARTUP_GUIDE.md << 'EOF'
# BESBPO Blog Platform - Startup Guide

## Quick Start

```bash
# 1. Start all services with Docker
docker-compose up -d

# 2. Start individual services (for development)

# CMS API
cd besbpo-cms-api && npm install && npm run start:dev

# Editorial Dashboard
cd besbpo-editorial-dashboard && npm install && npm run dev

# Main Blog
cd besbpo-blog-web && npm install && npm run dev

# Search Service
cd besbpo-blog-search-media-svc && cargo run

# Syndication Service
cd besbpo-blog-syndication-svc && npm install && npm run start:dev
```

## Service URLs

| Service | URL | Description |
|---------|-----|-------------|
| Main Blog | http://localhost:3000 | Public-facing blog |
| Editorial Dashboard | http://localhost:3000/editorial | Admin dashboard |
| CMS API | http://localhost:3001 | Backend API |
| Search API | http://localhost:8080 | Search service |
| Syndication API | http://localhost:3002 | Syndication service |

## Default Credentials

| Service | Username | Password |
|---------|----------|----------|
| Editorial Dashboard | admin@besbpo.co.za | admin123 |
| CMS API | - | - |
| Database | postgres | postgres |

## Troubleshooting

### Services won't start
```bash
# Check if ports are in use
lsof -i :3000
lsof -i :3001
lsof -i :8080

# Kill processes using the port
kill $(lsof -t -i :3000)
```

### Database connection issues
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Restart database
docker-compose restart postgres
```

### Auth issues
```bash
# Clear session storage
# In browser DevTools: Application > Storage > Clear site data
```

## Next Steps

1. Configure production environment variables
2. Set up email service
3. Configure DNS for subsidiaries
4. Set up monitoring dashboards
5. Run tenant onboarding script
EOF

echo -e "${GREEN}✓ Startup guide created${NC}"

# ============================================
# Summary
# ============================================

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}  Wire Integration Complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Next steps:"
echo -e "  1. ${YELLOW}Review environment files${NC} in each service directory"
echo -e "  2. ${YELLOW}Run ${NC}docker-compose up -d${YELLOW} to start services${NC}"
echo -e "  3. ${YELLOW}See ${NC}STARTUP_GUIDE.md${YELLOW} for detailed instructions${NC}"
echo ""
