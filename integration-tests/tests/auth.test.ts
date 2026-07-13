// User Registration Flow Tests
// Reference: Master Plan Section 7 - Integration Testing
// Tests the complete user registration flow

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { cmsApi, CmsApiClient } from '../src/clients.js';
import { generators, testStart, testEnd, cleanup } from '../src/helpers.js';
import { TestConfig } from '../src/config.js';

describe('User Registration Flow', () => {
  let cmsClient: CmsApiClient;

  beforeAll(() => {
    cmsClient = new CmsApiClient();
  });

  afterAll(async () => {
    await cleanup.all();
  });

  describe('Registration', () => {
    test('TST-AUTH-001: Register new user with valid credentials', async () => {
      testStart('Register new user with valid credentials');
      
      const userData = generators.userData();
      
      const response = await cmsClient.register(
        userData.email,
        userData.password,
        userData.displayName
      );

      expect(response.status).toBe(201);
      expect(response.data.accessToken).toBeDefined();
      expect(response.data.user.email).toBe(userData.email);
      
      testEnd('Register new user with valid credentials', true);
    });

    test('TST-AUTH-002: Register user with duplicate email fails', async () => {
      testStart('Register user with duplicate email fails');
      
      const userData = generators.userData();
      
      // First registration
      await cmsClient.register(
        userData.email,
        userData.password,
        userData.displayName
      );

      // Second registration with same email
      await expect(
        cmsClient.register(
          userData.email,
          'DifferentPassword123!',
          'Different Name'
        )
      ).rejects.toThrow();

      testEnd('Register user with duplicate email fails', true);
    });

    test('TST-AUTH-003: Register user with invalid email format fails', async () => {
      testStart('Register user with invalid email format fails');
      
      await expect(
        cmsClient.register(
          'invalid-email',
          'Password123!',
          'Test User'
        )
      ).rejects.toThrow();

      testEnd('Register user with invalid email format fails', true);
    });

    test('TST-AUTH-004: Register user with weak password fails', async () => {
      testStart('Register user with weak password fails');
      
      await expect(
        cmsClient.register(
          generators.uniqueEmail(),
          'weak',
          'Test User'
        )
      ).rejects.toThrow();

      testEnd('Register user with weak password fails', true);
    });
  });

  describe('Login', () => {
    test('TST-AUTH-010: Login with valid credentials succeeds', async () => {
      testStart('Login with valid credentials succeeds');
      
      const userData = generators.userData();
      
      // Register first
      await cmsClient.register(
        userData.email,
        userData.password,
        userData.displayName
      );

      // Clear auth and try login
      cmsClient.clearAuthToken();
      
      const response = await cmsClient.login(userData.email, userData.password);

      expect(response.status).toBe(200);
      expect(response.data.accessToken).toBeDefined();
      expect(response.data.user.email).toBe(userData.email);

      testEnd('Login with valid credentials succeeds', true);
    });

    test('TST-AUTH-011: Login with wrong password fails', async () => {
      testStart('Login with wrong password fails');
      
      const userData = generators.userData();
      
      // Register first
      await cmsClient.register(
        userData.email,
        userData.password,
        userData.displayName
      );

      // Clear auth and try login with wrong password
      cmsClient.clearAuthToken();
      
      await expect(
        cmsClient.login(userData.email, 'WrongPassword123!')
      ).rejects.toThrow();

      testEnd('Login with wrong password fails', true);
    });

    test('TST-AUTH-012: Login with non-existent user fails', async () => {
      testStart('Login with non-existent user fails');
      
      await expect(
        cmsClient.login('nonexistent@besbpo.co.za', 'Password123!')
      ).rejects.toThrow();

      testEnd('Login with non-existent user fails', true);
    });
  });

  describe('JWT Token', () => {
    test('TST-AUTH-020: Access protected endpoint without token fails', async () => {
      testStart('Access protected endpoint without token fails');
      
      await expect(
        cmsApi.getArticle('some-id')
      ).rejects.toThrow();

      testEnd('Access protected endpoint without token fails', true);
    });

    test('TST-AUTH-021: Access protected endpoint with valid token succeeds', async () => {
      testStart('Access protected endpoint with valid token succeeds');
      
      const userData = generators.userData();
      const registerResponse = await cmsApi.register(
        userData.email,
        userData.password,
        userData.displayName
      );

      cmsApi.setAuthToken(registerResponse.data.accessToken);

      // Create author (protected endpoint)
      const authorResponse = await cmsApi.createAuthor({
        userId: registerResponse.data.user.id,
        displayName: userData.displayName,
      });

      expect(authorResponse.status).toBe(201);
      expect(authorResponse.data.displayName).toBe(userData.displayName);

      testEnd('Access protected endpoint with valid token succeeds', true);
    });
  });
});
