import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ArticlesService } from './articles.service';
import { Article } from './entities/article.entity';
import { ArticleStatus } from '../common/enums/article-status.enum';
import { TagsService } from '../tags/tags.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { EmbeddingService } from '../embeddings/embedding.service';
import { AiProposalService } from '../ai-proposals/ai-proposal.service';
import { AuditService } from '../audit/audit.service';
import { AuthorsService } from '../authors/authors.service';

describe('ArticlesService', () => {
  let service: ArticlesService;
  let mockArticle: Partial<Article>;

  const repoMock = {
    findOne: jest.fn(() => Promise.resolve(mockArticle)),
    save: jest.fn((a: Article) => Promise.resolve(a)),
    create: jest.fn((partial: Partial<Article>) => partial as Article),
  };

  const tagsServiceMock = { findOrCreateMany: jest.fn(() => Promise.resolve([])) };
  const webhooksServiceMock = { notifyPublishEvent: jest.fn(() => Promise.resolve()) };
  const embeddingServiceMock = { generateAndPersist: jest.fn(() => Promise.resolve()) };
  const aiProposalServiceMock = {
    requestProposals: jest.fn(() =>
      Promise.resolve({
        excerpt: 'AI-drafted excerpt.',
        divisionTags: ['logistics'],
        freeFormTags: ['case-study'],
        taggingConfidence: 0.8,
        metaTitle: 'AI Title',
        metaDescription: 'AI description.',
        ogTitle: 'AI Title',
        ogDescription: 'AI description.',
        failed: [] as string[],
      }),
    ),
  };

  const auditServiceMock = { record: jest.fn(() => Promise.resolve()) };

  const authorsServiceMock = {
    getOrCreateForUser: jest.fn((userId: string, displayName: string) =>
      Promise.resolve({ id: `author-for-${userId}`, userId, displayName, createdAt: new Date() }),
    ),
  };

  beforeEach(async () => {
    mockArticle = {
      id: 'a1',
      status: ArticleStatus.CORPORATE_REVIEW,
      excerptSource: 'human',
      divisionTagsSource: 'human',
      seoMetaSource: 'human',
      divisionTags: ['logistics'],
      title: 'A Title',
      bodyMdx: 'Some body content.',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticlesService,
        { provide: getRepositoryToken(Article), useValue: repoMock },
        { provide: TagsService, useValue: tagsServiceMock },
        { provide: WebhooksService, useValue: webhooksServiceMock },
        { provide: EmbeddingService, useValue: embeddingServiceMock },
        { provide: AiProposalService, useValue: aiProposalServiceMock },
        { provide: AuditService, useValue: auditServiceMock },
        { provide: AuthorsService, useValue: authorsServiceMock },
      ],
    }).compile();

    service = module.get(ArticlesService);
    jest.clearAllMocks();
  });

  describe('transition', () => {
    it('allows a valid transition when all content fields are human-approved', async () => {
      const result = await service.transition('a1', ArticleStatus.PUBLISHED);
      expect(result.status).toBe(ArticleStatus.PUBLISHED);
    });

    it('notifies the syndication webhook on publish, including the division tags', async () => {
      await service.transition('a1', ArticleStatus.PUBLISHED);
      expect(webhooksServiceMock.notifyPublishEvent).toHaveBeenCalledWith('a1', 'published', ['logistics']);
    });

    it('does not notify the webhook for a transition with no syndication relevance', async () => {
      mockArticle.status = ArticleStatus.DIVISION_REVIEW;
      await service.transition('a1', ArticleStatus.CORPORATE_REVIEW);
      expect(webhooksServiceMock.notifyPublishEvent).not.toHaveBeenCalled();
    });

    it('rejects an invalid transition graph edge', async () => {
      mockArticle.status = ArticleStatus.DRAFT;
      await expect(service.transition('a1', ArticleStatus.PUBLISHED)).rejects.toThrow(BadRequestException);
    });

    it('blocks publish while an AI-proposed field is unapproved', async () => {
      mockArticle.seoMetaSource = 'ai_proposed';
      await expect(service.transition('a1', ArticleStatus.PUBLISHED)).rejects.toThrow(
        /still require human approval/,
      );
    });

    it('generates an embedding on publish, from the title and body', async () => {
      await service.transition('a1', ArticleStatus.PUBLISHED);
      expect(embeddingServiceMock.generateAndPersist).toHaveBeenCalledWith('a1', 'A Title\n\nSome body content.');
    });

    it('does not generate an embedding for a transition with no syndication relevance', async () => {
      mockArticle.status = ArticleStatus.DIVISION_REVIEW;
      await service.transition('a1', ArticleStatus.CORPORATE_REVIEW);
      expect(embeddingServiceMock.generateAndPersist).not.toHaveBeenCalled();
    });

    it('records an audit event with the actor, and the from/to status', async () => {
      await service.transition('a1', ArticleStatus.PUBLISHED, 'user-42');
      expect(auditServiceMock.record).toHaveBeenCalledWith({
        actorId: 'user-42',
        action: 'article_status_transition',
        targetType: 'article',
        targetId: 'a1',
        metadataJson: JSON.stringify({ from: ArticleStatus.CORPORATE_REVIEW, to: ArticleStatus.PUBLISHED }),
      });
    });

    it('records an audit event even for a transition with no syndication relevance', async () => {
      mockArticle.status = ArticleStatus.DIVISION_REVIEW;
      await service.transition('a1', ArticleStatus.CORPORATE_REVIEW, 'user-42');
      // Every transition is a real editorial action worth a trail, not
      // just the ones that also happen to notify the syndication webhook
      // — these are two independent concerns that happen to both live in
      // this method, not the same condition.
      expect(auditServiceMock.record).toHaveBeenCalledTimes(1);
    });

    it('still succeeds and still transitions the article even when no actorId is provided', async () => {
      // AuditService.record itself handles a missing actorId gracefully
      // (logs and skips rather than throwing) — this just confirms
      // ArticlesService doesn't add its OWN requirement on top of that,
      // which would make a real caller path fail if req.user were ever
      // legitimately absent for some reason.
      const result = await service.transition('a1', ArticleStatus.PUBLISHED);
      expect(result.status).toBe(ArticleStatus.PUBLISHED);
      expect(auditServiceMock.record).toHaveBeenCalledWith(expect.objectContaining({ actorId: '' }));
    });
  });

  describe('create', () => {
    it('resolves the author via AuthorsService and uses ITS id, not the raw user id', async () => {
      // articles.author_id is a NOT NULL foreign key to authors(id), not
      // users(id) — this is the actual regression test for the bug that
      // would have hard-failed every article creation against real
      // Postgres. See AuthorsService.getOrCreateForUser's doc comment
      // for the full story.
      await service.create(
        { title: 'A Title', slug: 'a-title' } as any,
        { id: 'user-1', roles: [], displayName: 'A User' },
      );

      expect(authorsServiceMock.getOrCreateForUser).toHaveBeenCalledWith('user-1', 'A User');
      expect(repoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ authorId: 'author-for-user-1' }),
      );
    });

    it('falls back to email, then to the raw id, when displayName is not provided', async () => {
      await service.create(
        { title: 'A Title', slug: 'a-title' } as any,
        { id: 'user-2', roles: [], email: 'user2@example.com' },
      );
      expect(authorsServiceMock.getOrCreateForUser).toHaveBeenCalledWith('user-2', 'user2@example.com');
    });

    it('creates the article as a draft with an empty divisionTags array by default', async () => {
      const result = await service.create(
        { title: 'A Title', slug: 'a-title' } as any,
        { id: 'user-1', roles: [], displayName: 'A User' },
      );
      expect(result.status).toBe(ArticleStatus.DRAFT);
      expect(result.divisionTags).toEqual([]);
    });
  });

  describe('findById', () => {
    it('returns the article when found', async () => {
      const result = await service.findById('a1');
      expect(result.id).toBe('a1');
    });

    it('throws NotFoundException when no article matches', async () => {
      repoMock.findOne.mockResolvedValueOnce(null as unknown as Article);
      await expect(service.findById('no-such-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('sets excerptSource to human when excerpt is included in the update', async () => {
      const result = await service.update('a1', { excerpt: 'A human-written excerpt.' });
      expect(result.excerptSource).toBe('human');
    });

    it('sets divisionTagsSource to human when divisionTags is included in the update', async () => {
      const result = await service.update('a1', { divisionTags: ['bpo'] });
      expect(result.divisionTagsSource).toBe('human');
    });

    it('sets seoMetaSource to human when seoMeta is included in the update', async () => {
      const result = await service.update('a1', { seoMeta: { meta_title: 'New title' } });
      expect(result.seoMetaSource).toBe('human');
    });

    it('does not touch excerptSource when excerpt is not part of the update', async () => {
      const result = await service.update('a1', { title: 'Just a title change' });
      expect(result.excerptSource).toBe('human'); // unchanged from the mock's initial value
    });
  });

  describe('approveField', () => {
    it('sets the field source to human_approved when it is currently ai_proposed', async () => {
      mockArticle.excerptSource = 'ai_proposed';
      const result = await service.approveField('a1', 'excerpt');
      expect(result.excerptSource).toBe('human_approved');
    });

    it('rejects approving a field that is not currently ai_proposed', async () => {
      mockArticle.excerptSource = 'human';
      await expect(service.approveField('a1', 'excerpt')).rejects.toThrow(BadRequestException);
    });

    it('rejects approving a field that is already human_approved', async () => {
      mockArticle.divisionTagsSource = 'human_approved';
      await expect(service.approveField('a1', 'divisionTags')).rejects.toThrow(BadRequestException);
    });

    it('records an audit event with the actor and the approved field', async () => {
      mockArticle.excerptSource = 'ai_proposed';
      await service.approveField('a1', 'excerpt', 'user-42');
      expect(auditServiceMock.record).toHaveBeenCalledWith({
        actorId: 'user-42',
        action: 'approve_ai_proposed_field',
        targetType: 'article',
        targetId: 'a1',
        metadataJson: JSON.stringify({ field: 'excerpt' }),
      });
    });

    it('does not record an audit event when the approval itself is rejected', async () => {
      mockArticle.excerptSource = 'human';
      await expect(service.approveField('a1', 'excerpt', 'user-42')).rejects.toThrow(BadRequestException);
      expect(auditServiceMock.record).not.toHaveBeenCalled();
    });
  });

  describe('requestAiProposals', () => {
    it('calls AiProposalService with the article title and body', async () => {
      await service.requestAiProposals('a1');
      expect(aiProposalServiceMock.requestProposals).toHaveBeenCalledWith(
        'a1',
        'A Title',
        'Some body content.',
        undefined,
      );
    });

    it('writes the returned excerpt and marks it ai_proposed', async () => {
      const result = await service.requestAiProposals('a1');
      expect(result.excerpt).toBe('AI-drafted excerpt.');
      expect(result.excerptSource).toBe('ai_proposed');
    });

    it('writes the returned division tags and marks them ai_proposed', async () => {
      const result = await service.requestAiProposals('a1');
      expect(result.divisionTags).toEqual(['logistics']);
      expect(result.divisionTagsSource).toBe('ai_proposed');
    });

    it('writes the returned SEO meta and marks it ai_proposed', async () => {
      const result = await service.requestAiProposals('a1');
      expect(result.seoMeta).toMatchObject({ meta_title: 'AI Title', meta_description: 'AI description.' });
      expect(result.seoMetaSource).toBe('ai_proposed');
    });

    it('leaves a field untouched if its proposal failed (partial outage)', async () => {
      aiProposalServiceMock.requestProposals.mockResolvedValueOnce({
        excerpt: undefined,
        divisionTags: ['logistics'],
        freeFormTags: [],
        taggingConfidence: 0.8,
        metaTitle: undefined,
        metaDescription: undefined,
        ogTitle: undefined,
        ogDescription: undefined,
        failed: ['excerpt', 'seo'],
      } as any);

      const result = await service.requestAiProposals('a1');
      // excerptSource should remain whatever it was on the mock article
      // (untouched) rather than being force-set to anything, since the
      // excerpt proposal itself failed.
      expect(result.excerptSource).toBe('human');
    });
  });
});
