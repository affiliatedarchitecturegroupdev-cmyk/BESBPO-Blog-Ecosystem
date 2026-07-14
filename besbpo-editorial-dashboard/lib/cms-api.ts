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
