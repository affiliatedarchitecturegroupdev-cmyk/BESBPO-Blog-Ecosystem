// Test Configuration
// Reference: Master Plan Section 7

export const TestConfig = {
  // Service URLs (from Docker Compose)
  services: {
    cmsApi: process.env.CMS_API_URL || 'http://localhost:3000',
    syndicationApi: process.env.SYNDICATION_API_URL || 'http://localhost:8080',
    intelligenceApi: process.env.INTELLIGENCE_API_URL || 'http://localhost:8000',
    editorialDashboard: process.env.EDITORIAL_DASHBOARD_URL || 'http://localhost:3001',
    blogWeb: process.env.BLOG_WEB_URL || 'http://localhost:3002',
  },

  // Test timeouts (milliseconds)
  timeouts: {
    default: 10000,
    api: 30000,
    browser: 60000,
    database: 5000,
  },

  // Test data
  testUser: {
    email: 'test@besbpo.co.za',
    password: 'TestPassword123!',
    displayName: 'Test User',
  },

  testTenant: {
    name: 'Test Tenant',
    domain: 'test.besbpo.co.za',
  },

  // Database configuration
  database: {
    host: process.env.TEST_DB_HOST || 'localhost',
    port: parseInt(process.env.TEST_DB_PORT || '5432'),
    database: 'besbpo_test',
    username: 'postgres',
    password: 'postgres',
  },

  // Redis configuration
  redis: {
    host: process.env.TEST_REDIS_HOST || 'localhost',
    port: parseInt(process.env.TEST_REDIS_PORT || '6379'),
  },

  // Browser testing
  browser: {
    headless: process.env.CI === 'true',
    slowMo: parseInt(process.env.SLOW_MO || '0'),
  },

  // Report configuration
  reporting: {
    junit: process.env.CI === 'true',
    html: true,
    json: true,
  },
};

// Environment validation
export function validateEnvironment(): void {
  const missing: string[] = [];

  // In CI, we expect services to be running
  if (process.env.CI === 'true') {
    if (!process.env.CMS_API_URL) missing.push('CMS_API_URL');
    if (!process.env.SYNDICATION_API_URL) missing.push('SYNDICATION_API_URL');
  }

  if (missing.length > 0) {
    console.warn(`⚠️  Missing environment variables: ${missing.join(', ')}`);
    console.warn('Using default values from Docker Compose');
  }
}
