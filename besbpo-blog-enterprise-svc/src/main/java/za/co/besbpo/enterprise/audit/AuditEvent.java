package za.co.besbpo.enterprise.audit;

import java.time.Instant;

import jakarta.validation.constraints.NotBlank;

/**
 * Immutable audit record. Mirrors the append-only pattern used by
 * `syndication_events` in besbpo-blog-architecture/db/schema.sql, but
 * scoped to editorial/administrative actions rather than syndication
 * delivery events — e.g. "user X approved AI-proposed SEO metadata for
 * article Y", per the human-approval gate in Doc-03 Section 6.
 */
public record AuditEvent(
    @NotBlank String actorId,
    @NotBlank String action,
    String targetType,
    String targetId,
    String metadataJson,
    Instant occurredAt
) {
    public static AuditEvent now(String actorId, String action, String targetType, String targetId, String metadataJson) {
        return new AuditEvent(actorId, action, targetType, targetId, metadataJson, Instant.now());
    }
}
