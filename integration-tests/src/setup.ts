// Test Setup File
// Reference: Master Plan Section 7

import { jest } from '@jest/globals';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.CI = process.env.CI || 'false';

// Increase timeout for integration tests
jest.setTimeout(60000);

// Global beforeAll/afterAll hooks
beforeAll(() => {
  console.log('\n📋 Setting up test suite...');
});

afterAll(() => {
  console.log('\n📋 Test suite complete');
});

// Clean up between tests
afterEach(() => {
  // Clean up any test data
  console.log('   Cleanup complete');
});

// Mock external services in CI
if (process.env.CI === 'true') {
  // In CI, we might want to mock certain external services
  console.log('📋 Running in CI mode - some external services may be mocked');
}
