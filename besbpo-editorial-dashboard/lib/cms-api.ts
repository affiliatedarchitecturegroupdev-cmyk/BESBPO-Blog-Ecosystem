const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  headers?: Record<string, string>;
  requiresAuth?: boolean;
  token?: string | null;
}

// Re-export article status and types
export type { ArticleStatus, ArticleSourceFields, ContentFieldSource } from './article-status';
export {
  ARTICLE_STATUS_TRANSITIONS,
  HUMAN_APPROVAL_REQUIRED_BEFORE,
  allowedTransitions,
  statusLabel,
  unapprovedFields,
  blockedByApprovalGate,
} from './article-status';

export type MutationResult = {
  ok: boolean;
  data?: unknown;
  article?: Article;
  error?: string;
};

export type ApprovableField = 'title' | 'excerpt' | 'divisionTags' | 'seoMeta';

export type CreateArticleInput = {
  title: string;
  slug?: string;
  bodyMdx?: string;
  excerpt?: string;
  divisionTags?: string[];
  tagNames?: string[];
  heroImageId?: string | null;
  seoMeta?: {
    meta_title?: string;
    meta_description?: string;
    [key: string]: unknown;
  };
};

export type UpdateArticleInput = Partial<CreateArticleInput> & {
  status?: 'draft' | 'division_review' | 'corporate_review' | 'scheduled' | 'published' | 'syndicated' | 'archived' | 'rejected';
};

export type UploadResult = {
  ok: boolean;
  url?: string;
  id?: string;
  asset?: MediaAsset;
  error?: string;
};

export type PaginatedMediaAssets = {
  items: MediaAsset[];
  total: number;
  hasMore: boolean;
  limit?: number;
  offset?: number;
};

export type DeleteMediaResult = 
  | { ok: true }
  | { ok: false; error: string };

export interface Article {
  id: string;
  title: string;
  slug: string;
  bodyMdx?: string;
  content?: string;
  excerpt: string;
  status: 'draft' | 'division_review' | 'corporate_review' | 'scheduled' | 'published' | 'syndicated' | 'archived' | 'rejected';
  authorId: string;
  tenantId: string;
  divisionTags: string[];
  heroImageId: string | null | undefined;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  tags: Array<{ id: string; name: string }>;
  seoMeta?: {
    meta_title?: string;
    meta_description?: string;
    [key: string]: unknown;
  };
  excerptSource: 'human' | 'ai_proposed' | 'human_approved';
  divisionTagsSource: 'human' | 'ai_proposed' | 'human_approved';
  seoMetaSource: 'human' | 'ai_proposed' | 'human_approved';
}

export interface MediaAsset {
  id: string;
  url: string;
  altText?: string;
  createdAt: string;
  variantUrls?: {
    thumbnail?: string;
    display?: string;
  };
}

export interface CreateArticleDto {
  title: string;
  bodyMdx?: string;
  content?: string;
  excerpt?: string;
  divisionTags?: string[];
}

export interface UpdateArticleDto extends Partial<CreateArticleDto> {
  status?: 'draft' | 'division_review' | 'corporate_review' | 'scheduled' | 'published' | 'syndicated' | 'archived' | 'rejected';
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

async function apiCall<T = unknown>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, requiresAuth = true, token } = options;

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (requiresAuth && token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
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

// Session helper
async function getSession() {
  return null;
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
  
  transition: (id: string, status: 'draft' | 'division_review' | 'corporate_review' | 'scheduled' | 'published' | 'syndicated' | 'archived' | 'rejected') =>
    apiCall<Article>(`/articles/${id}/transition`, { method: 'PATCH', body: { status } }),
  
  approveField: (id: string, field: ApprovableField) =>
    apiCall<Article>(`/articles/${id}/approve/${field}`, { method: 'POST' }),
  
  aiProposals: (id: string) =>
    apiCall<{ proposals: Record<string, unknown> }>(`/articles/${id}/ai-proposals`, { method: 'POST' }),
};

// Named exports for direct imports with fixture fallback support
export async function listArticles(params?: { status?: string; division?: string }, _token?: string | null) {
  try {
    const result = await articlesApi.list({ status: params?.status });
    return { articles: result.data, total: result.total, source: 'api' as const };
  } catch (error) {
    console.warn('Failed to fetch articles from API, using fixture data:', error);
    return {
      articles: getFixtureArticles(),
      total: 3,
      source: 'fixture' as const,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function getArticle(id: string, _sessionToken?: string | null) {
  try {
    const article = await articlesApi.get(id);
    return { article, source: 'api' as const };
  } catch (error) {
    console.warn('Failed to fetch article from API, using fixture data:', error);
    const fixture = getFixtureArticles().find(a => a.id === id);
    if (fixture) {
      return { article: fixture, source: 'fixture' as const };
    }
    return {
      article: null,
      source: 'fixture' as const,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function createArticle(data: CreateArticleInput, token?: string | null): Promise<MutationResult> {
  try {
    await articlesApi.create(data);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function updateArticle(id: string, data: UpdateArticleInput, token?: string | null): Promise<MutationResult> {
  try {
    await articlesApi.update(id, data);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function transitionArticle(id: string, status: 'draft' | 'division_review' | 'corporate_review' | 'scheduled' | 'published' | 'syndicated' | 'archived' | 'rejected', token?: string | null): Promise<MutationResult> {
  try {
    await articlesApi.transition(id, status);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function approveField(id: string, field: ApprovableField, token?: string | null): Promise<MutationResult> {
  try {
    await articlesApi.approveField(id, field);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function requestAiProposals(id: string, token?: string | null): Promise<MutationResult> {
  try {
    await articlesApi.aiProposals(id);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function deleteArticle(id: string) {
  return articlesApi.delete(id);
}

export async function publishArticle(id: string) {
  return articlesApi.publish(id);
}

// Media API
export async function getMediaAsset(id: string, _sessionToken?: string | null) {
  try {
    return await apiCall<{ id: string; url: string; type: string }>(`/media/${id}`);
  } catch {
    return null;
  }
}

export async function uploadMedia(formData: FormData, token?: string | null): Promise<UploadResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/media`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Upload failed' }));
      return { ok: false, error: error.message };
    }
    const data = await response.json();
    return { ok: true, url: data.url, id: data.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function listMedia(limit?: number, offset?: number, token?: string | null): Promise<PaginatedMediaAssets> {
  const params = new URLSearchParams();
  if (limit) params.set('limit', String(limit));
  if (offset) params.set('offset', String(offset));
  const data = await apiCall<PaginatedMediaAssets>(`/media?${params}`, { token });
  return data;
}

export async function deleteMedia(id: string, token?: string | null): Promise<DeleteMediaResult> {
  try {
    await apiCall<void>(`/media/${id}`, { method: 'DELETE', token });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function updateMediaAltText(id: string, altText: string, token?: string | null): Promise<UploadResult> {
  try {
    await apiCall(`/media/${id}`, { method: 'PATCH', body: { altText }, token });
    return { ok: true, url: '', id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Fixture data for demo mode
function getFixtureArticles(): Article[] {
  return [
    {
      id: '1',
      title: 'Welcome to BESBPO',
      slug: 'welcome-to-besbpo',
      bodyMdx: '<p>This is a sample article for demonstration purposes.</p>',
      content: '<p>This is a sample article for demonstration purposes.</p>',
      excerpt: 'Welcome to the BESBPO Blog Platform',
      status: 'published',
      authorId: '1',
      tenantId: '1',
      divisionTags: ['announcements'],
      tags: [{ id: '1', name: 'welcome' }, { id: '2', name: 'intro' }],
      heroImageId: undefined,
      seoMeta: { meta_title: 'Welcome to BESBPO', meta_description: 'Introduction to our platform' },
      excerptSource: 'human',
      divisionTagsSource: 'human',
      seoMetaSource: 'human',
      publishedAt: '2026-01-01T00:00:00Z',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: '2',
      title: 'Getting Started Guide',
      slug: 'getting-started-guide',
      bodyMdx: '<p>Learn how to use the platform effectively.</p>',
      content: '<p>Learn how to use the platform effectively.</p>',
      excerpt: 'A comprehensive guide to get you started',
      status: 'draft',
      authorId: '1',
      tenantId: '1',
      divisionTags: ['tutorials'],
      tags: [{ id: '3', name: 'guide' }, { id: '4', name: 'tutorial' }],
      heroImageId: undefined,
      seoMeta: { meta_title: 'Getting Started Guide' },
      excerptSource: 'human',
      divisionTagsSource: 'human',
      seoMetaSource: 'human',
      createdAt: '2026-01-02T00:00:00Z',
      updatedAt: '2026-01-02T00:00:00Z',
    },
    {
      id: '3',
      title: 'Platform Updates',
      slug: 'platform-updates',
      bodyMdx: '<p>Latest updates and improvements.</p>',
      content: '<p>Latest updates and improvements.</p>',
      excerpt: 'Stay updated with the latest features',
      status: 'corporate_review',
      authorId: '1',
      tenantId: '1',
      divisionTags: ['updates'],
      tags: [{ id: '5', name: 'updates' }, { id: '6', name: 'news' }],
      heroImageId: undefined,
      seoMeta: { meta_title: 'Platform Updates' },
      excerptSource: 'ai_proposed',
      divisionTagsSource: 'ai_proposed',
      seoMetaSource: 'ai_proposed',
      createdAt: '2026-01-03T00:00:00Z',
      updatedAt: '2026-01-03T00:00:00Z',
    },
  ];
}

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
