import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth/auth.service';
import { withRetry, HttpStatusError, isRetryableHttpError } from '../common/retry';

interface AuditEventPayload {
  actorId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadataJson?: string;
}

/**
 * Calls besbpo-blog-enterprise-svc's POST /api/v1/audit — closing a real
 * gap that had sat since Phase 7: that endpoint has existed, tested, and
 * genuinely persisted since then, with NO caller anywhere in this
 * codebase. This platform's own governing principle (Doc-01 Section 9)
 * is "AI proposes. Humans approve. The system records." — the first two
 * had real code behind them; the third had never fired once. Every "a
 * human approved this AI-proposed field" event the human-approval gate
 * exists to produce was going nowhere.
 *
 * Deliberately isolated in its own service, same reasoning as
 * WebhooksService — ArticlesService shouldn't need to know about HTTP or
 * service-JWT concerns to record an audit event. Uses the exact same
 * issueServiceToken + withRetry pattern as WebhooksService.notifyPublishEvent
 * (a fresh short-lived service token per attempt, 3 retries with
 * exponential backoff, 4xx not retried).
 *
 * Fail-soft by design: a failed audit call logs a warning and never
 * throws, so a momentary enterprise-svc outage can't block an editor
 * from approving a field or publishing an article. This is a real,
 * accepted tradeoff worth stating plainly — it means the audit trail is
 * not a strict guarantee, only a best-effort one, until this gets a
 * durable retry queue (e.g. an outbox table) instead of an in-process
 * retry loop that gives up after a few seconds. See this repo's README
 * for that as an open item, not glossed over.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly authService: AuthService,
  ) {}

  async record(event: AuditEventPayload): Promise<void> {
    if (!event.actorId) {
      // AuditEvent.actorId is @NotBlank on the enterprise-svc side — an
      // empty actorId would fail validation there anyway. Caught here
      // instead of sent, since "who did this" being unknown is itself
      // worth a clear local warning, not a 400 from a downstream service.
      this.logger.warn(`Skipping audit record for action '${event.action}': no actorId available.`);
      return;
    }

    const enterpriseServiceUrl = this.config.get<string | undefined>('ENTERPRISE_SERVICE_URL');
    if (!enterpriseServiceUrl) {
      this.logger.warn(`ENTERPRISE_SERVICE_URL is not set — skipping audit record for action '${event.action}'.`);
      return;
    }

    try {
      await withRetry(
        async () => {
          // Fresh token per attempt — same reasoning as
          // WebhooksService.notifyPublishEvent: tokens are short-lived
          // (5m), and a retry loop shouldn't risk sending an
          // already-expired one on a later attempt.
          const token = this.authService.issueServiceToken('besbpo-blog-cms-api');

          const res = await fetch(`${enterpriseServiceUrl}/api/v1/audit`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(event),
          });

          if (!res.ok) {
            throw new HttpStatusError(`Audit service returned ${res.status}`, res.status);
          }
        },
        { maxAttempts: 3, baseDelayMs: 300, isRetryable: isRetryableHttpError },
      );
    } catch (err) {
      this.logger.warn(
        `Audit record failed for action '${event.action}' (actor ${event.actorId}) after retries: ` +
          `${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
