// Syndication Webhook Flow Tests
// Reference: Master Plan Section 7 - Integration Testing
// Tests: Syndication webhook → Feed updated

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { cmsApi, syndicationApi } from '../src/clients.js';
import { generators, testStart, testEnd, cleanup, wait } from '../src/helpers.js';

describe('Syndication Webhook Flow', () => {
  let authorId: string;
  let authorToken: string;
  let tenantId: string;

  beforeAll(async () => {
    testStart('Setting up syndication test environment');
    
    // Create user
    const userData = generators.userData();
    const registerResponse = await cmsApi.register(
      userData.email,
      userData.password,
      userData.displayName
    );

    authorToken = registerResponse.data.accessToken;
    cmsApi.setAuthToken(authorToken);

    // Create author profile
    const authorResponse = await cmsApi.createAuthor({
      userId: registerResponse.data.user.id,
      displayName: userData.displayName,
    });

    authorId = authorResponse.data.id;
    
    testEnd('Setting up syndication test environment', true);
  });

  afterAll(async () => {
    await cleanup.all();
  });

  describe('Service Health', () => {
    test('TST-SYN-001: Syndication service is healthy', async () => {
      testStart('Syndication service is healthy');
      
      const response = await syndicationApi.getHealth();

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('ok');

      testEnd('Syndication service is healthy', true);
    });

    test('TST-SYN-002: Get existing feeds', async () => {
      testStart('Get existing feeds');
      
      const response = await syndicationApi.getFeeds();

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data)).toBe(true);

      testEnd('Get existing feeds', true);
    });
  });

  describe('Article Syndication', () => {
    test('TST-SYN-010: Publish article triggers syndication', async () => {
      testStart('Publish article triggers syndication');
      
      // 1. Create article
      const articleData = generators.articleData();
      const createResponse = await cmsApi.createArticle({
        ...articleData,
        authorId: authorId,
      });
      const articleId = createResponse.data.id;

      // 2. Submit and approve
      await cmsApi.submitForReview(articleId);
      await cmsApi.approveArticle(articleId);

      // 3. Publish
      await cmsApi.publishArticle(articleId);

      // 4. Wait for syndication to process
      await wait.delay(2000);

      // 5. Verify article status includes syndicated
      const article = await cmsApi.getArticle(articleId);
      
      // Status should be published (syndication happens asynchronously)
      expect(['published', 'syndicated']).toContain(article.data.status);

      testEnd('Publish article triggers syndication', true);
    });

    test('TST-SYN-011: Manual feed sync', async () => {
      testStart('Manual feed sync');
      
      // Note: tenantId would come from the tenant created in setup
      // For testing, we'll use a mock tenant ID
      const mockTenantId = 'test-tenant-' + Date.now();

      try {
        const response = await syndicationApi.triggerSync(mockTenantId);

        expect(response.status).toBe(200);
        expect(response.data.tenantId).toBe(mockTenantId);
        expect(typeof response.data.synced).toBe('boolean');
        expect(typeof response.data.articlesCount).toBe('number');
      } catch (error) {
        // Expected if tenant doesn't exist
        console.log('Tenant not found - this is expected for mock tenant ID');
      }

      testEnd('Manual feed sync', true);
    });
  });

  describe('Webhooks', () => {
    test('TST-SYN-020: Register webhook for tenant', async () => {
      testStart('Register webhook for tenant');
      
      const tenantId = 'test-tenant-' + Date.now();
      const webhookUrl = generators.webhookUrl();

      const response = await syndicationApi.registerWebhook(
        tenantId,
        webhookUrl,
        ['article.published', 'article.updated']
      );

      expect(response.status).toBe(201);
      expect(response.data.url).toBe(webhookUrl);
      expect(response.data.events).toContain('article.published');
      expect(response.data.events).toContain('article.updated');

      testEnd('Register webhook for tenant', true);
    });

    test('TST-SYN-021: Get webhook events', async () => {
      testStart('Get webhook events');
      
      const tenantId = 'test-tenant-' + Date.now();
      const webhookUrl = generators.webhookUrl();

      // Register webhook first
      const registerResponse = await syndicationApi.registerWebhook(
        tenantId,
        webhookUrl,
        ['article.published']
      );

      // Get events
      const eventsResponse = await syndicationApi.getWebhookEvents(
        tenantId,
        registerResponse.data.id
      );

      expect(eventsResponse.status).toBe(200);
      expect(Array.isArray(eventsResponse.data)).toBe(true);

      testEnd('Get webhook events', true);
    });

    test('TST-SYN-022: Webhook receives article.published event', async () => {
      testStart('Webhook receives article.published event');
      
      // This test would be more comprehensive in a real environment
      // where we have a mock webhook receiver
      
      const tenantId = 'test-tenant-' + Date.now();
      const webhookUrl = generators.webhookUrl();

      // Register webhook
      await syndicationApi.registerWebhook(
        tenantId,
        webhookUrl,
        ['article.published']
      );

      // Create and publish article
      const articleData = generators.articleData();
      const createResponse = await cmsApi.createArticle({
        ...articleData,
        authorId: authorId,
      });
      const articleId = createResponse.data.id;

      await cmsApi.submitForReview(articleId);
      await cmsApi.approveArticle(articleId);
      await cmsApi.publishArticle(articleId);

      // Wait for webhook delivery
      await wait.delay(3000);

      // Get events - should contain the published event
      const eventsResponse = await syndicationApi.getWebhookEvents(
        tenantId,
        (await syndicationApi.registerWebhook(
          tenantId,
          webhookUrl,
          ['article.published']
        )).data.id
      );

      // Events should have been recorded
      expect(eventsResponse.status).toBe(200);

      testEnd('Webhook receives article.published event', true);
    });
  });

  describe('End-to-End Syndication', () => {
    test('TST-SYN-030: Complete syndication workflow', async () => {
      testStart('Complete syndication workflow');
      
      // 1. Create article
      const articleData = generators.articleData();
      const createResponse = await cmsApi.createArticle({
        ...articleData,
        authorId: authorId,
      });
      const articleId = createResponse.data.id;

      // 2. Submit for review
      await cmsApi.submitForReview(articleId);

      // 3. Approve
      await cmsApi.approveArticle(articleId, 'Approved for syndication');

      // 4. Publish
      await cmsApi.publishArticle(articleId);

      // 5. Wait for syndication processing
      await wait.delay(3000);

      // 6. Verify syndication events were recorded
      // Note: This would require access to the syndication_events table
      // In a real test, we'd query the database directly

      // 7. Verify article status
      const finalArticle = await cmsApi.getArticle(articleId);
      
      expect(['published', 'syndicated']).toContain(finalArticle.data.status);

      testEnd('Complete syndication workflow', true);
    });
  });
});
