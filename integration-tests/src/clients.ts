// API Clients for Integration Tests
// Reference: Master Plan Section 7

import axios, { AxiosInstance, AxiosError } from 'axios';
import { TestConfig } from './config.js';

export interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

export interface ApiError {
  message: string;
  status: number;
  errors?: Record<string, string[]>;
}

// Base API Client
abstract class BaseApiClient {
  protected client: AxiosInstance;
  protected baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.client = axios.create({
      baseURL,
      timeout: TestConfig.timeouts.api,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        console.log(`✅ ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
        return response;
      },
      (error: AxiosError) => {
        console.error(`❌ ${error.config?.method?.toUpperCase()} ${error.config?.url} - ${error.response?.status}`);
        throw error;
      }
    );
  }

  protected async request<T>(config: {
    method: string;
    url: string;
    data?: unknown;
    params?: Record<string, string>;
    headers?: Record<string, string>;
  }): Promise<ApiResponse<T>> {
    const response = await this.client.request<T>(config);
    return {
      data: response.data,
      status: response.status,
      headers: response.headers as Record<string, string>,
    };
  }

  setAuthToken(token: string): void {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  clearAuthToken(): void {
    delete this.client.defaults.headers.common['Authorization'];
  }
}

// CMS API Client
export class CmsApiClient extends BaseApiClient {
  constructor() {
    super(TestConfig.services.cmsApi);
  }

  // Auth endpoints
  async register(email: string, password: string, displayName: string) {
    return this.request<{ accessToken: string; user: { id: string; email: string } }>({
      method: 'POST',
      url: '/auth/register',
      data: { email, password, displayName },
    });
  }

  async login(email: string, password: string) {
    return this.request<{ accessToken: string; user: { id: string; email: string } }>({
      method: 'POST',
      url: '/auth/login',
      data: { email, password },
    });
  }

  // Author endpoints
  async createAuthor(data: { userId: string; displayName: string; divisionId?: string }) {
    return this.request<{ id: string; displayName: string }>({
      method: 'POST',
      url: '/authors',
      data,
    });
  }

  async getAuthor(id: string) {
    return this.request<{ id: string; displayName: string; divisionId?: string }>({
      method: 'GET',
      url: `/authors/${id}`,
    });
  }

  // Article endpoints
  async createArticle(data: {
    slug: string;
    title: string;
    bodyMdx: string;
    authorId: string;
    divisionTags: string[];
  }) {
    return this.request<{ id: string; slug: string; status: string }>({
      method: 'POST',
      url: '/articles',
      data,
    });
  }

  async getArticle(id: string) {
    return this.request<{
      id: string;
      slug: string;
      title: string;
      status: string;
      authorId: string;
    }>({
      method: 'GET',
      url: `/articles/${id}`,
    });
  }

  async updateArticle(id: string, data: Partial<{
    title: string;
    bodyMdx: string;
    excerpt: string;
  }>) {
    return this.request<{ id: string; updated: boolean }>({
      method: 'PATCH',
      url: `/articles/${id}`,
      data,
    });
  }

  async submitForReview(id: string) {
    return this.request<{ id: string; status: string }>({
      method: 'POST',
      url: `/articles/${id}/submit`,
    });
  }

  async approveArticle(id: string, reviewerNotes?: string) {
    return this.request<{ id: string; status: string }>({
      method: 'POST',
      url: `/articles/${id}/approve`,
      data: { reviewerNotes },
    });
  }

  async publishArticle(id: string) {
    return this.request<{ id: string; status: string }>({
      method: 'POST',
      url: `/articles/${id}/publish`,
    });
  }

  // Division endpoints
  async getDivisions() {
    return this.request<Array<{ id: string; key: string; label: string }>>({
      method: 'GET',
      url: '/divisions',
    });
  }
}

// Syndication API Client
export class SyndicationApiClient extends BaseApiClient {
  constructor() {
    super(TestConfig.services.syndicationApi);
  }

  async getHealth() {
    return this.request<{ status: string; timestamp: string }>({
      method: 'GET',
      url: '/health',
    });
  }

  async getFeeds() {
    return this.request<Array<{ tenantId: string; feedUrl: string; divisions: string[] }>>({
      method: 'GET',
      url: '/feeds',
    });
  }

  async triggerSync(tenantId: string) {
    return this.request<{ tenantId: string; synced: boolean; articlesCount: number }>({
      method: 'POST',
      url: `/feeds/${tenantId}/sync`,
    });
  }

  async getTenantFeeds(tenantId: string) {
    return this.request<Array<{ id: string; url: string; lastSynced?: string }>>({
      method: 'GET',
      url: `/tenants/${tenantId}/feeds`,
    });
  }

  async registerWebhook(tenantId: string, url: string, events: string[]) {
    return this.request<{ id: string; url: string; events: string[] }>({
      method: 'POST',
      url: `/tenants/${tenantId}/webhooks`,
      data: { url, events },
    });
  }

  async getWebhookEvents(tenantId: string, webhookId: string) {
    return this.request<Array<{ id: string; eventType: string; timestamp: string }>>({
      method: 'GET',
      url: `/tenants/${tenantId}/webhooks/${webhookId}/events`,
    });
  }
}

// Intelligence API Client
export class IntelligenceApiClient extends BaseApiClient {
  constructor() {
    super(TestConfig.services.intelligenceApi);
  }

  async getHealth() {
    return this.request<{ status: string; models: string[] }>({
      method: 'GET',
      url: '/health',
    });
  }

  async proposeEnhancements(article: { title: string; body: string; excerpt?: string }) {
    return this.request<{
      title: string;
      excerpt: string;
      divisionTags: string[];
      seoMeta: { title: string; description: string; keywords: string[] };
      confidence: number;
    }>({
      method: 'POST',
      url: '/propose',
      data: { article },
    });
  }

  async generateEmbedding(text: string) {
    return this.request<{ embedding: number[]; model: string }>({
      method: 'POST',
      url: '/embed',
      data: { text },
    });
  }
}

// Export singleton instances
export const cmsApi = new CmsApiClient();
export const syndicationApi = new SyndicationApiClient();
export const intelligenceApi = new IntelligenceApiClient();
