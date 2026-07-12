import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Article, ContentFieldSource } from './entities/article.entity';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { TagsService } from '../tags/tags.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { EmbeddingService } from '../embeddings/embedding.service';
import { AiProposalService } from '../ai-proposals/ai-proposal.service';
import { AuditService } from '../audit/audit.service';
import { AuthorsService } from '../authors/authors.service';
import {
  ArticleStatus,
  ARTICLE_STATUS_TRANSITIONS,
  HUMAN_APPROVAL_REQUIRED_BEFORE,
} from '../common/enums/article-status.enum';

export interface CurrentUser {
  id: string;
  roles: string[];
  divisionId?: string;
  /** Both added alongside real per-user login (see JwtStrategy.validate) —
   * displayName specifically is what AuthorsService.getOrCreateForUser
   * uses to back a new author record the first time a given user
   * publishes anything. */
  email?: string;
  displayName?: string;
}

/** The three content fields this platform's human-approval gate tracks
 * provenance for (Doc-03 Section 6) — the only fields `approveField` and
 * the AI-proposals flow operate on. */
export type ApprovableField = 'excerpt' | 'divisionTags' | 'seoMeta';

@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(Article)
    private readonly articlesRepo: Repository<Article>,
    private readonly tagsService: TagsService,
    private readonly webhooksService: WebhooksService,
    private readonly embeddingService: EmbeddingService,
    private readonly aiProposalService: AiProposalService,
    private readonly auditService: AuditService,
    private readonly authorsService: AuthorsService,
  ) {}

  findAll(filters: { division?: string; status?: ArticleStatus; tag?: string }): Promise<Article[]> {
    const qb = this.articlesRepo.createQueryBuilder('article').leftJoinAndSelect('article.tags', 'tag');
    if (filters.division) {
      qb.andWhere(':division = ANY(article.division_tags)', {
        division: filters.division,
      });
    }
    if (filters.status) {
      qb.andWhere('article.status = :status', { status: filters.status });
    }
    if (filters.tag) {
      // Filter on a subquery rather than the leftJoinAndSelect'd `tag` alias
      // directly, so the result still eagerly loads ALL of each matched
      // article's tags, not just the one it was filtered by.
      qb.andWhere(
        'article.id IN (' +
          'SELECT at.article_id FROM article_tags at ' +
          'INNER JOIN tags t ON t.id = at.tag_id WHERE t.name = :tagName' +
          ')',
        { tagName: filters.tag },
      );
    }
    return qb.orderBy('article.created_at', 'DESC').getMany();
  }

  async findBySlug(slug: string): Promise<Article> {
    const article = await this.articlesRepo.findOne({ where: { slug }, relations: ['tags'] });
    if (!article) {
      throw new NotFoundException(`Article '${slug}' not found`);
    }
    return article;
  }

  /** Fetch by ID — separate from findBySlug because the Editorial
   * Dashboard's edit page navigates by ID (from findAll's results, before
   * a slug is necessarily finalised), while findBySlug stays the public,
   * unauthenticated canonical-site lookup (Doc-02 Section 5). Keeping
   * these as two distinct methods/routes rather than one "smart" lookup
   * that guesses which kind of identifier it was given avoids ever
   * accidentally exposing draft content through the public slug route.
   */
  async findById(id: string): Promise<Article> {
    const article = await this.articlesRepo.findOne({ where: { id }, relations: ['tags'] });
    if (!article) {
      throw new NotFoundException(`Article ${id} not found`);
    }
    return article;
  }

  /**
   * `articles.author_id` is a NOT NULL foreign key to `authors(id)`, not
   * `users(id)` — author.id here is the LOGGED-IN USER's id (from the
   * JWT), which is a different table entirely. Real Postgres would have
   * rejected every single article creation with a foreign key violation
   * the moment this ran against it — a bug that had been sitting here
   * undiscovered because nothing in this environment could actually
   * enforce that constraint until a CI workflow applied schema.sql to a
   * real database for the first time. AuthorsService.getOrCreateForUser
   * is the fix: resolves (or lazily creates) the author record this
   * user's articles should actually be attributed to.
   */
  async create(dto: CreateArticleDto, author: CurrentUser): Promise<Article> {
    const { tagNames, ...rest } = dto;
    const tags = tagNames?.length ? await this.tagsService.findOrCreateMany(tagNames) : [];
    const authorRecord = await this.authorsService.getOrCreateForUser(
      author.id,
      author.displayName ?? author.email ?? author.id,
    );

    const article = this.articlesRepo.create({
      ...rest,
      divisionTags: dto.divisionTags ?? [],
      authorId: authorRecord.id,
      status: ArticleStatus.DRAFT,
      tags,
    });
    return this.articlesRepo.save(article);
  }

  /**
   * Updates article fields directly. Deliberately sets the provenance
   * (`excerptSource`/`divisionTagsSource`/`seoMetaSource`) to `'human'`
   * itself whenever the corresponding content field is present in the
   * update payload — the CLIENT never gets to set a source value
   * directly (see CreateArticleDto's header comment for why: allowing
   * that would let anyone claim `human_approved` without an actual human
   * having approved anything). A direct edit always means "a human wrote
   * or changed this content just now," which is exactly what `'human'`
   * means — a human who wants to instead ACCEPT an AI proposal unchanged
   * uses `approveField` below, not this method.
   */
  async update(id: string, dto: UpdateArticleDto): Promise<Article> {
    const article = await this.articlesRepo.findOne({ where: { id }, relations: ['tags'] });
    if (!article) {
      throw new NotFoundException(`Article ${id} not found`);
    }

    const { tagNames, ...rest } = dto;
    Object.assign(article, rest);
    if (dto.excerpt !== undefined) {
      article.excerptSource = 'human';
    }
    if (dto.divisionTags !== undefined) {
      article.divisionTagsSource = 'human';
    }
    if (dto.seoMeta !== undefined) {
      article.seoMetaSource = 'human';
    }
    if (tagNames !== undefined) {
      article.tags = tagNames.length ? await this.tagsService.findOrCreateMany(tagNames) : [];
    }

    return this.articlesRepo.save(article);
  }

  /**
   * Marks a field as `'human_approved'` WITHOUT changing its value — the
   * explicit "I reviewed this AI proposal and I'm accepting it as-is"
   * action, distinct from `update()` (which always means "a human is
   * providing/changing the content itself," setting the source to
   * `'human'` instead). Only meaningful — and only allowed — on a field
   * that's currently `'ai_proposed'`; approving a field a human already
   * wrote, or one that's already approved, isn't a real action, so it's
   * rejected rather than silently accepted.
   */
  /**
   * `actorId` is optional only in the TypeScript sense (so existing
   * internal callers that predate the audit trail don't break) — every
   * real caller through the controller always has one, since
   * approveField's route requires JwtAuthGuard. See AuditService.record
   * for what happens if it's ever actually missing (a logged skip, not
   * a thrown error — a missing actor shouldn't block the approval
   * itself, only the record of who did it).
   */
  async approveField(id: string, field: ApprovableField, actorId?: string): Promise<Article> {
    const article = await this.articlesRepo.findOne({ where: { id } });
    if (!article) {
      throw new NotFoundException(`Article ${id} not found`);
    }

    const sourceKey = this.sourceKeyFor(field);
    if (article[sourceKey] !== 'ai_proposed') {
      throw new BadRequestException(
        `Cannot approve '${field}': it is currently '${article[sourceKey]}', not 'ai_proposed'.`,
      );
    }

    article[sourceKey] = 'human_approved';
    const saved = await this.articlesRepo.save(article);

    // Doc-01 Section 9: "AI proposes. Humans approve. The system
    // records." — this IS the "records" step for the "humans approve"
    // half of that sentence. Fire-and-forget from this method's
    // perspective (AuditService.record is itself fail-soft and never
    // throws — see that method), so a momentary enterprise-svc outage
    // never blocks the approval that already succeeded above.
    await this.auditService.record({
      actorId: actorId ?? '',
      action: 'approve_ai_proposed_field',
      targetType: 'article',
      targetId: id,
      metadataJson: JSON.stringify({ field }),
    });

    return saved;
  }

  /**
   * Requests AI proposals for excerpt, division tags, and SEO meta all at
   * once (Doc-03 Section 6), via AiProposalService, then writes whichever
   * of the three actually came back to the article with source set to
   * `'ai_proposed'` — fields that failed are left untouched (not cleared,
   * not defaulted), so a partial intelligence-service outage never wipes
   * out existing human-authored content.
   */
  async requestAiProposals(id: string): Promise<Article> {
    const article = await this.articlesRepo.findOne({ where: { id } });
    if (!article) {
      throw new NotFoundException(`Article ${id} not found`);
    }

    const proposals = await this.aiProposalService.requestProposals(
      article.id,
      article.title,
      article.bodyMdx,
      article.excerpt,
    );

    if (proposals.excerpt !== undefined) {
      article.excerpt = proposals.excerpt;
      article.excerptSource = 'ai_proposed';
    }
    if (proposals.divisionTags !== undefined) {
      article.divisionTags = proposals.divisionTags;
      article.divisionTagsSource = 'ai_proposed';
    }
    if (proposals.metaTitle !== undefined && proposals.metaDescription !== undefined) {
      article.seoMeta = {
        meta_title: proposals.metaTitle,
        meta_description: proposals.metaDescription,
        og_title: proposals.ogTitle,
        og_description: proposals.ogDescription,
      };
      article.seoMetaSource = 'ai_proposed';
    }

    return this.articlesRepo.save(article);
  }

  private sourceKeyFor(field: ApprovableField): 'excerptSource' | 'divisionTagsSource' | 'seoMetaSource' {
    switch (field) {
      case 'excerpt':
        return 'excerptSource';
      case 'divisionTags':
        return 'divisionTagsSource';
      case 'seoMeta':
        return 'seoMetaSource';
    }
  }

  /**
   * Transitions an article to a new lifecycle status, enforcing:
   *  1. The valid-transition graph (Doc-03 Section 3).
   *  2. The human-approval gate (Doc-03 Section 6 / Doc-01 Section 9) — an
   *     article cannot reach `scheduled` or `published` while any AI-proposed
   *     field (excerpt, division tags, SEO meta) remains unapproved.
   *
   * This is the single choke point that guarantees "AI proposes, humans
   * approve" is enforced in code rather than merely by process.
   */
  async transition(id: string, nextStatus: ArticleStatus, actorId?: string): Promise<Article> {
    const article = await this.articlesRepo.findOne({ where: { id } });
    if (!article) {
      throw new NotFoundException(`Article ${id} not found`);
    }

    const previousStatus = article.status;
    const allowed = ARTICLE_STATUS_TRANSITIONS[article.status] ?? [];
    if (!allowed.includes(nextStatus)) {
      throw new BadRequestException(
        `Cannot transition article from '${article.status}' to '${nextStatus}'. ` +
          `Allowed: ${allowed.join(', ') || '(none — terminal state)'}`,
      );
    }

    if (HUMAN_APPROVAL_REQUIRED_BEFORE.includes(nextStatus)) {
      const unapprovedFields = [
        article.excerptSource === 'ai_proposed' ? 'excerpt' : null,
        article.divisionTagsSource === 'ai_proposed' ? 'divisionTags' : null,
        article.seoMetaSource === 'ai_proposed' ? 'seoMeta' : null,
      ].filter(Boolean);

      if (unapprovedFields.length > 0) {
        throw new BadRequestException(
          `Cannot move to '${nextStatus}': the following AI-proposed fields ` +
            `still require human approval: ${unapprovedFields.join(', ')}.`,
        );
      }
    }

    article.status = nextStatus;
    if (nextStatus === ArticleStatus.PUBLISHED) {
      article.publishedAt = new Date();
    }
    if (nextStatus === ArticleStatus.ARCHIVED) {
      article.archivedAt = new Date();
    }

    const saved = await this.articlesRepo.save(article);

    // Doc-02 Section 7: notify the Syndication Distribution Service so it
    // can invalidate tenant caches and fan out build-time repository_dispatch
    // events. Fired for every status change tenants might care about, not
    // just the initial publish — an update to an already-published article,
    // or an archive/unpublish, both need to propagate too.
    const webhookEvent = this.webhookEventFor(nextStatus);
    if (webhookEvent) {
      await this.webhooksService.notifyPublishEvent(saved.id, webhookEvent, saved.divisionTags);
    }

    // Doc-03 Sections 6-7: (re)generate the article's embedding whenever
    // its content becomes (or remains) publicly relevant — on the initial
    // publish, and again on any subsequent update, so the vector doesn't
    // go stale against edited content. Not fired for unpublish/archive:
    // besbpo-blog-search-media-svc's sync job only ever indexes
    // status='published' articles in the first place (see that repo's
    // internal/db.rs), so a stale embedding on an archived article is
    // already irrelevant to search regardless of whether it's refreshed.
    if (webhookEvent === 'published' || webhookEvent === 'updated') {
      await this.embeddingService.generateAndPersist(saved.id, `${saved.title}\n\n${saved.bodyMdx}`);
    }

    // Doc-01 Section 9: "AI proposes. Humans approve. The system
    // records." — every status transition is a real editorial action
    // worth a trail, not just the moment something goes live. Fail-soft
    // (see AuditService.record), so this never blocks a transition that
    // already succeeded above.
    await this.auditService.record({
      actorId: actorId ?? '',
      action: 'article_status_transition',
      targetType: 'article',
      targetId: id,
      metadataJson: JSON.stringify({ from: previousStatus, to: nextStatus }),
    });

    return saved;
  }

  private webhookEventFor(status: ArticleStatus): 'published' | 'updated' | 'unpublished' | 'archived' | null {
    switch (status) {
      case ArticleStatus.PUBLISHED:
        return 'published';
      case ArticleStatus.SYNDICATED:
        return 'updated';
      case ArticleStatus.ARCHIVED:
        return 'archived';
      default:
        return null;
    }
  }
}
