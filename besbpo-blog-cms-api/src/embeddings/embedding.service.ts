import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Article } from '../articles/entities/article.entity';
import { withRetry, HttpStatusError, isRetryableHttpError } from '../common/retry';

interface EmbeddingApiResponse {
  article_id: string;
  embedding: number[];
  model: string;
  dimensions: number;
}

// Generates and persists an article's embedding on publish/update (Doc-03
// Sections 6-7) — closes a real gap that had been sitting since Phase 6:
// besbpo-blog-architecture's original Article entity comment recorded
// that embeddings would be "written/read by the Python Content
// Intelligence Service directly via SQL... revisit once the intelligence
// service (Doc-05 Phase 5) lands." Phase 5 landed (real Claude/Voyage AI
// integration in besbpo-blog-intelligence-svc), but nothing was ever
// wired to actually CALL it from here. Without this, every article's
// `embedding` column stayed NULL forever, and besbpo-blog-search-media-svc's
// hybrid search (Phase 6) was silently — but correctly — degrading to
// keyword-only for every single article. The infrastructure all worked;
// nothing was actually producing the data it depended on.
//
// Deliberately best-effort: a failed embedding call must never block an
// article from publishing. Search quality degrading gracefully is a far
// smaller problem than an editor being unable to publish because a
// downstream AI service is briefly unreachable — same fail-soft posture
// as WebhooksService.
//
// Writes via a raw parameterized query with an explicit ::vector cast,
// NOT through the Article TypeORM entity/repository.save() — deliberately
// preserving the ORIGINAL architectural decision recorded in
// article.entity.ts's header comment (avoid pulling a pgvector TypeORM
// driver into this service as a dependency), rather than quietly
// reversing that decision just to make this wiring more convenient.
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Article)
    private readonly articlesRepo: Repository<Article>,
  ) {}

  async generateAndPersist(articleId: string, text: string): Promise<void> {
    const intelligenceUrl = this.config.get<string>('INTELLIGENCE_SERVICE_URL');
    if (!intelligenceUrl) {
      this.logger.warn(
        `INTELLIGENCE_SERVICE_URL is not set — skipping embedding generation for article ${articleId}`,
      );
      return;
    }

    try {
      const response = await withRetry(
        async () => {
          const res = await fetch(`${intelligenceUrl}/v1/embeddings/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ article_id: articleId, text }),
          });
          if (!res.ok) {
            throw new HttpStatusError(`Embedding request returned ${res.status}`, res.status);
          }
          return (await res.json()) as EmbeddingApiResponse;
        },
        { maxAttempts: 3, baseDelayMs: 300, isRetryable: isRetryableHttpError },
      );

      // Postgres's `vector` type accepts a bracketed, comma-separated
      // text literal like "[0.1,0.2,0.3]" as input — the same
      // representation besbpo-blog-search-media-svc's db.rs reads back
      // via an explicit ::text cast on the way out; this is that same
      // representation written on the way in.
      const vectorLiteral = `[${response.embedding.join(',')}]`;
      await this.articlesRepo.query('UPDATE articles SET embedding = $1::vector WHERE id = $2', [
        vectorLiteral,
        articleId,
      ]);
    } catch (err) {
      // Covers both a network/HTTP failure (after retries) and any
      // unexpected shape in the response (e.g. response.embedding being
      // undefined) — either way, log and move on rather than let this
      // propagate up into ArticlesService.transition() and fail the
      // publish itself.
      this.logger.warn(
        `Embedding generation failed for article ${articleId} after retries, publishing without one: ` +
          `${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
