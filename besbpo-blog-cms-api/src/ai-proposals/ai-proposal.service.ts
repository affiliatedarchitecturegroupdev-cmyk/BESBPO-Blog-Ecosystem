import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DivisionsService } from '../divisions/divisions.service';
import { withRetry, HttpStatusError, isRetryableHttpError } from '../common/retry';

interface TaggingProposalResponse {
  division_tags: string[];
  free_form_tags: string[];
  confidence: number;
}

interface SeoProposalResponse {
  meta_title: string;
  meta_description: string;
  og_title: string;
  og_description: string;
}

interface SummarisationProposalResponse {
  excerpt: string;
}

export interface AiProposalResult {
  divisionTags?: string[];
  freeFormTags?: string[];
  taggingConfidence?: number;
  metaTitle?: string;
  metaDescription?: string;
  ogTitle?: string;
  ogDescription?: string;
  excerpt?: string;
  /** Names of the sub-requests that failed, e.g. ['seo'] — lets the caller
   * (and the UI) show a partial, honest result rather than an
   * all-or-nothing failure. */
  failed: string[];
}

/**
 * Bridges the authoring workflow to besbpo-blog-intelligence-svc's three
 * proposal endpoints (Doc-03 Section 6). Closes a real gap: that service
 * has existed since Phase 5 with no caller anywhere in the authoring
 * flow — an editor had no actual way to request an AI suggestion; the
 * whole "AI proposes" half of "AI proposes, humans approve" had nothing
 * wired to produce a proposal in the first place.
 *
 * Each of the three sub-requests (tagging, SEO, summary) is independent
 * and best-effort: one failing doesn't block the other two, and a total
 * intelligence-service outage returns an empty-but-valid result (every
 * field undefined, `failed` listing all three) rather than throwing —
 * matching the fail-soft posture used everywhere else this platform talks
 * to that service (EmbeddingService, WebhooksService).
 */
@Injectable()
export class AiProposalService {
  private readonly logger = new Logger(AiProposalService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly divisionsService: DivisionsService,
  ) {}

  async requestProposals(
    articleId: string,
    title: string,
    bodyMdx: string,
    existingExcerpt?: string,
  ): Promise<AiProposalResult> {
    const result: AiProposalResult = { failed: [] };
    const intelligenceUrl = this.config.get<string>('INTELLIGENCE_SERVICE_URL');

    if (!intelligenceUrl) {
      this.logger.warn(`INTELLIGENCE_SERVICE_URL is not set — skipping AI proposals for article ${articleId}`);
      result.failed = ['tagging', 'seo', 'summary'];
      return result;
    }

    const knownDivisions = (await this.divisionsService.findAll()).map((d) => d.key);

    const [tagging, seo, summary] = await Promise.all([
      this.callIntelligence<TaggingProposalResponse>(
        `${intelligenceUrl}/v1/tag/propose`,
        { article_id: articleId, title, body_mdx: bodyMdx, known_divisions: knownDivisions },
        'tagging',
      ),
      this.callIntelligence<SeoProposalResponse>(
        `${intelligenceUrl}/v1/seo/propose`,
        { article_id: articleId, title, excerpt: existingExcerpt ?? null, body_mdx: bodyMdx },
        'seo',
      ),
      this.callIntelligence<SummarisationProposalResponse>(
        `${intelligenceUrl}/v1/summarise/propose`,
        { article_id: articleId, body_mdx: bodyMdx, max_characters: 240 },
        'summary',
      ),
    ]);

    if (tagging) {
      result.divisionTags = tagging.division_tags;
      result.freeFormTags = tagging.free_form_tags;
      result.taggingConfidence = tagging.confidence;
    } else {
      result.failed.push('tagging');
    }

    if (seo) {
      result.metaTitle = seo.meta_title;
      result.metaDescription = seo.meta_description;
      result.ogTitle = seo.og_title;
      result.ogDescription = seo.og_description;
    } else {
      result.failed.push('seo');
    }

    if (summary) {
      result.excerpt = summary.excerpt;
    } else {
      result.failed.push('summary');
    }

    return result;
  }

  private async callIntelligence<T>(url: string, body: unknown, label: string): Promise<T | null> {
    try {
      return await withRetry(
        async () => {
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (!res.ok) {
            throw new HttpStatusError(`${label} request returned ${res.status}`, res.status);
          }
          return (await res.json()) as T;
        },
        { maxAttempts: 3, baseDelayMs: 300, isRetryable: isRetryableHttpError },
      );
    } catch (err) {
      this.logger.warn(`${label} proposal failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }
}
