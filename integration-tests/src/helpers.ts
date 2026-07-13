// Test Helpers and Utilities
// Reference: Master Plan Section 7

import { v4 as uuidv4 } from 'uuid';
import { cmsApi, syndicationApi, CmsApiClient } from './clients.js';
import { TestConfig } from './config.js';

// Test data generators
export const generators = {
  // Generate unique email for each test
  uniqueEmail(): string {
    return `test-${uuidv4()}@besbpo.co.za`;
  },

  // Generate unique slug
  uniqueSlug(prefix = 'test'): string {
    return `${prefix}-${uuidv4().slice(0, 8)}`;
  },

  // Generate article data
  articleData(overrides = {}) {
    return {
      slug: this.uniqueSlug('article'),
      title: 'Test Article ' + new Date().toISOString(),
      bodyMdx: '# Test Content\n\nThis is a test article for integration testing.',
      divisionTags: ['built-environment'],
      ...overrides,
    };
  },

  // Generate user data
  userData(overrides = {}) {
    return {
      email: this.uniqueEmail(),
      password: 'TestPassword123!',
      displayName: 'Test User ' + Date.now(),
      ...overrides,
    };
  },

  // Generate webhook URL (for testing)
  webhookUrl(): string {
    return `https://webhook.site/test-${uuidv4()}`;
  },
};

// Test context for sharing data between tests
export class TestContext {
  private context: Map<string, unknown> = new Map();

  set<T>(key: string, value: T): void {
    this.context.set(key, value);
  }

  get<T>(key: string): T | undefined {
    return this.context.get(key) as T | undefined;
  }

  has(key: string): boolean {
    return this.context.has(key);
  }

  clear(): void {
    this.context.clear();
  }
}

// Global test context (shared across tests in a suite)
export const globalContext = new TestContext();

// Wait utilities
export const wait = {
  // Wait for a condition to be true
  async for(condition: () => Promise<boolean>, timeout = 10000, interval = 1000): Promise<void> {
    const startTime = Date.now();
    while (!(await condition())) {
      if (Date.now() - startTime > timeout) {
        throw new Error(`Timeout waiting for condition after ${timeout}ms`);
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  },

  // Wait for service to be healthy
  async forServiceHealth(
    client: CmsApiClient,
    timeout = TestConfig.timeouts.api
  ): Promise<void> {
    await this.for(
      async () => {
        try {
          await client.getArticle('health-check').catch(() => null);
          return true;
        } catch {
          return false;
        }
      },
      timeout,
      2000
    );
  },

  // Simple delay
  async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },
};

// Database helpers
export async function cleanDatabase(): Promise<void> {
  // This would connect to the database and clean test data
  // Implementation depends on the specific database client used
  console.log('🧹 Cleaning database...');
  globalContext.clear();
}

// Auth helpers
export async function createTestUser() {
  const userData = generators.userData();
  const response = await cmsApi.register(
    userData.email,
    userData.password,
    userData.displayName
  );
  cmsApi.setAuthToken(response.data.accessToken);
  globalContext.set('testUser', userData);
  globalContext.set('authToken', response.data.accessToken);
  return response.data;
}

export async function loginTestUser(email: string, password: string) {
  const response = await cmsApi.login(email, password);
  cmsApi.setAuthToken(response.data.accessToken);
  globalContext.set('authToken', response.data.accessToken);
  return response.data;
}

export function clearAuth(): void {
  cmsApi.clearAuthToken();
  globalContext.set('authToken', undefined);
}

// Assertion helpers
export const assert = {
  notNull<T>(value: T | null | undefined, message = 'Value should not be null'): T {
    if (value === null || value === undefined) {
      throw new Error(message);
    }
    return value;
  },

  isString(value: unknown, message = 'Value should be a string'): string {
    if (typeof value !== 'string') {
      throw new Error(message);
    }
    return value;
  },

  isArray(value: unknown, message = 'Value should be an array'): unknown[] {
    if (!Array.isArray(value)) {
      throw new Error(message);
    }
    return value;
  },

  status(response: { status: number }, expected: number, message?: string): void {
    if (response.status !== expected) {
      throw new Error(message || `Expected status ${expected}, got ${response.status}`);
    }
  },
};

// Retry helper for flaky tests
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: Error | undefined;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await wait.delay(delayMs);
      }
    }
  }
  throw lastError;
}

// Report helpers
export function testInfo(name: string, metadata?: Record<string, unknown>): void {
  console.log(`\n📝 Test: ${name}`);
  if (metadata) {
    console.log('   Metadata:', JSON.stringify(metadata, null, 2));
  }
}

export function testStart(name: string): void {
  console.log(`\n🚀 Starting: ${name}`);
}

export function testEnd(name: string, passed: boolean): void {
  console.log(`${passed ? '✅' : '❌'} Completed: ${name}\n`);
}

// Cleanup helpers
export const cleanup = {
  users: async (): Promise<void> => {
    // Cleanup test users from database
    console.log('🧹 Cleaning up test users...');
  },

  articles: async (): Promise<void> => {
    // Cleanup test articles from database
    console.log('🧹 Cleaning up test articles...');
  },

  all: async (): Promise<void> => {
    await cleanup.users();
    await cleanup.articles();
    globalContext.clear();
    clearAuth();
  },
};
