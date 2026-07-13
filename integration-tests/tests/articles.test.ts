// Article Creation Flow Tests
// Reference: Master Plan Section 7 - Integration Testing
// Tests: Article creation → AI Propose → Human Approve → Publish

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { cmsApi, intelligenceApi, CmsApiClient } from '../src/clients.js';
import { generators, testStart, testEnd, cleanup, globalContext } from '../src/helpers.js';

describe('Article Creation Flow', () => {
  let authorId: string;
  let authorToken: string;

  beforeAll(async () => {
    testStart('Setting up test author');
    
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
    globalContext.set('authorId', authorId);
    
    testEnd('Setting up test author', true);
  });

  afterAll(async () => {
    await cleanup.all();
  });

  describe('Article Creation', () => {
    test('TST-ART-001: Create article with valid data', async () => {
      testStart('Create article with valid data');
      
      const articleData = generators.articleData();
      
      const response = await cmsApi.createArticle({
        slug: articleData.slug,
        title: articleData.title,
        bodyMdx: articleData.bodyMdx,
        authorId: authorId,
        divisionTags: articleData.divisionTags,
      });

      expect(response.status).toBe(201);
      expect(response.data.id).toBeDefined();
      expect(response.data.slug).toBe(articleData.slug);
      expect(response.data.status).toBe('draft');

      globalContext.set('articleId', response.data.id);
      
      testEnd('Create article with valid data', true);
    });

    test('TST-ART-002: Create article with duplicate slug fails', async () => {
      testStart('Create article with duplicate slug fails');
      
      const articleData = generators.articleData();
      
      // First article
      await cmsApi.createArticle({
        ...articleData,
        authorId: authorId,
      });

      // Second article with same slug
      await expect(
        cmsApi.createArticle({
          ...articleData,
          authorId: authorId,
        })
      ).rejects.toThrow();

      testEnd('Create article with duplicate slug fails', true);
    });

    test('TST-ART-003: Create article with missing required fields fails', async () => {
      testStart('Create article with missing required fields fails');
      
      await expect(
        cmsApi.createArticle({
          slug: generators.uniqueSlug(),
          // Missing title, bodyMdx, authorId
          title: '',
          bodyMdx: '',
          authorId: authorId,
          divisionTags: [],
        } as any)
      ).rejects.toThrow();

      testEnd('Create article with missing required fields fails', true);
    });
  });

  describe('Article Update', () => {
    test('TST-ART-010: Update article title', async () => {
      testStart('Update article title');
      
      const articleData = generators.articleData();
      const createResponse = await cmsApi.createArticle({
        ...articleData,
        authorId: authorId,
      });

      const newTitle = 'Updated Title ' + Date.now();
      const updateResponse = await cmsApi.updateArticle(createResponse.data.id, {
        title: newTitle,
      });

      expect(updateResponse.data.updated).toBe(true);

      testEnd('Update article title', true);
    });

    test('TST-ART-011: Update article body', async () => {
      testStart('Update article body');
      
      const articleData = generators.articleData();
      const createResponse = await cmsApi.createArticle({
        ...articleData,
        authorId: authorId,
      });

      const newBody = '# Updated Content\n\nThis is the updated article body.';
      const updateResponse = await cmsApi.updateArticle(createResponse.data.id, {
        bodyMdx: newBody,
      });

      expect(updateResponse.data.updated).toBe(true);

      testEnd('Update article body', true);
    });
  });

  describe('Article Workflow', () => {
    test('TST-ART-020: Submit article for review', async () => {
      testStart('Submit article for review');
      
      const articleData = generators.articleData();
      const createResponse = await cmsApi.createArticle({
        ...articleData,
        authorId: authorId,
      });

      const submitResponse = await cmsApi.submitForReview(createResponse.data.id);

      expect(submitResponse.data.status).toBe('division_review');

      testEnd('Submit article for review', true);
    });

    test('TST-ART-021: Approve article', async () => {
      testStart('Approve article');
      
      const articleData = generators.articleData();
      const createResponse = await cmsApi.createArticle({
        ...articleData,
        authorId: authorId,
      });

      // Submit for review
      await cmsApi.submitForReview(createResponse.data.id);

      // Approve
      const approveResponse = await cmsApi.approveArticle(
        createResponse.data.id,
        'Looks good!'
      );

      expect(approveResponse.data.status).toBe('corporate_review');

      testEnd('Approve article', true);
    });

    test('TST-ART-022: Publish article', async () => {
      testStart('Publish article');
      
      const articleData = generators.articleData();
      const createResponse = await cmsApi.createArticle({
        ...articleData,
        authorId: authorId,
      });

      // Submit and approve
      await cmsApi.submitForReview(createResponse.data.id);
      await cmsApi.approveArticle(createResponse.data.id);

      // Publish
      const publishResponse = await cmsApi.publishArticle(createResponse.data.id);

      expect(publishResponse.data.status).toBe('published');

      testEnd('Publish article', true);
    });
  });

  describe('AI Enhancement', () => {
    test('TST-ART-030: Request AI enhancements for article', async () => {
      testStart('Request AI enhancements for article');
      
      const response = await intelligenceApi.proposeEnhancements({
        title: 'The Future of Smart Cities',
        body: 'Smart cities use technology to improve urban services and quality of life...',
      });

      expect(response.status).toBe(200);
      expect(response.data.title).toBeDefined();
      expect(response.data.excerpt).toBeDefined();
      expect(response.data.divisionTags).toBeDefined();
      expect(response.data.seoMeta).toBeDefined();
      expect(response.data.confidence).toBeGreaterThan(0);

      testEnd('Request AI enhancements for article', true);
    });

    test('TST-ART-031: Generate text embedding', async () => {
      testStart('Generate text embedding');
      
      const response = await intelligenceApi.generateEmbedding(
        'The future of urban development in South Africa'
      );

      expect(response.status).toBe(200);
      expect(response.data.embedding).toBeDefined();
      expect(Array.isArray(response.data.embedding)).toBe(true);
      expect(response.data.embedding.length).toBeGreaterThan(0);
      expect(response.data.model).toBeDefined();

      testEnd('Generate text embedding', true);
    });
  });

  describe('Complete Workflow', () => {
    test('TST-ART-040: Complete article lifecycle (create → AI → approve → publish)', async () => {
      testStart('Complete article lifecycle');
      
      // 1. Create article
      const articleData = generators.articleData();
      const createResponse = await cmsApi.createArticle({
        ...articleData,
        authorId: authorId,
      });
      const articleId = createResponse.data.id;

      // 2. Get AI enhancements
      const aiResponse = await intelligenceApi.proposeEnhancements({
        title: articleData.title,
        body: articleData.bodyMdx,
      });

      // 3. Update with AI suggestions
      await cmsApi.updateArticle(articleId, {
        title: aiResponse.data.title,
        excerpt: aiResponse.data.excerpt,
      });

      // 4. Submit for review
      await cmsApi.submitForReview(articleId);

      // 5. Approve
      await cmsApi.approveArticle(articleId, 'AI enhancements approved by editor');

      // 6. Publish
      const publishResponse = await cmsApi.publishArticle(articleId);

      // 7. Verify final state
      const finalArticle = await cmsApi.getArticle(articleId);

      expect(publishResponse.data.status).toBe('published');
      expect(finalArticle.data.status).toBe('published');
      expect(finalArticle.data.title).toBe(aiResponse.data.title);

      testEnd('Complete article lifecycle', true);
    });
  });
});
