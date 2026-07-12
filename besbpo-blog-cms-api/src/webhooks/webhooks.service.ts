import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth/auth.service';
import { withRetry, HttpStatusError, isRetryableHttpError } from '../common/retry';

export type PublishEvent = 'published' | 'updated' | 'unpublished' | 'archived';

interface PublishWebhookPayload {
  article_id: string;
  event: PublishEvent;
  division_tags: string[];
  occurred_at: string;
}

// Calls the Syndication Distribution Service's POST /api/v1/webhooks/publish
// (Doc-02 Section 5 & 7) whenever an article's status changes in a way that
// should propagate to tenants. Deliberately isolated in its own service so
// ArticlesService doesn't need to know about HTTP/service-JWT concerns.
//
// Closes the Phase 1 TODO this file used to carry (a console.log stub) —
// this now makes a real, signed HTTP call. See AuthService.issueServiceToken
// for the token shape and the shared-secret caveat that comes with it
// (besbpo-blog-syndication-svc's RequireServiceJWT must be configured with
// the same JWT_SECRET this service uses until distinct signing keys per
// token purpose are introduced on both sides).
//
// Also closes the retry/backoff TODO this file used to carry: transient
// failures (network blips, a 502 while the syndication service restarts)
// are retried up to 3 times with exponential backoff via withRetry
// (src/common/retry.ts, unit-tested there in isolation). A 4xx is NOT
// retried — a bad payload or auth failure won't fix itself by trying
// again, so isRetryableHttpError stops immediately on those.
@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly authService: AuthService,
  ) {}

  async notifyPublishEvent(articleId: string, event: PublishEvent, divisionTags: string[]): Promise<void> {
    const syndicationUrl = this.config.get<string>('SYNDICATION_SERVICE_URL');
    const payload: PublishWebhookPayload = {
      article_id: articleId,
      event,
      division_tags: divisionTags,
      occurred_at: new Date().toISOString(),
    };

    try {
      await withRetry(
        async () => {
          // Issue a fresh token per attempt rather than reusing one across
          // retries — tokens are short-lived (5m, see
          // AuthService.issueServiceToken), and a retry loop that spans
          // more than a few seconds should never risk sending an
          // already-expired token on a later attempt.
          const token = this.authService.issueServiceToken('besbpo-blog-cms-api');

          const res = await fetch(`${syndicationUrl}/api/v1/webhooks/publish`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          });

          if (!res.ok) {
            throw new HttpStatusError(`Syndication webhook returned ${res.status}`, res.status);
          }
        },
        { maxAttempts: 3, baseDelayMs: 300, isRetryable: isRetryableHttpError },
      );
    } catch (err) {
      this.logger.warn(
        `Syndication webhook call failed for article ${articleId}, event ${event} after retries: ` +
          `${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
