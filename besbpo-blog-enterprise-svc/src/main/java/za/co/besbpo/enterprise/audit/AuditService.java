package za.co.besbpo.enterprise.audit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Phase 7: persists audit events to Postgres via {@link AuditEventRepository}
 * (the {@code audit_events} table in
 * besbpo-blog-architecture/db/schema.sql), replacing the Phase 0 in-memory
 * {@code CopyOnWriteArrayList}. Still logs every event too — unchanged
 * behaviour from Phase 0, kept alongside persistence rather than replaced
 * by it, since a log line is a useful cheap signal independent of whether
 * the DB write itself later needs debugging.
 */
@Service
public class AuditService {
    private static final Logger log = LoggerFactory.getLogger(AuditService.class);

    private final AuditEventRepository repository;

    public AuditService(AuditEventRepository repository) {
        this.repository = repository;
    }

    public AuditEvent record(AuditEvent event) {
        log.info("AUDIT actor={} action={} target={}/{}", event.actorId(), event.action(), event.targetType(), event.targetId());

        String metadataJson = event.metadataJson() != null ? event.metadataJson() : "{}";
        Instant occurredAt = event.occurredAt() != null ? event.occurredAt() : Instant.now();

        AuditEventEntity entity = new AuditEventEntity(
                event.actorId(), event.action(), event.targetType(), event.targetId(), metadataJson, occurredAt
        );
        repository.save(entity);

        // Return the caller's original event (with defaults filled in) rather
        // than re-reading the saved entity back — avoids a redundant round
        // trip for a value the caller already has everything needed to
        // reconstruct, matching the Phase 0 API shape callers already expect.
        return new AuditEvent(event.actorId(), event.action(), event.targetType(), event.targetId(), metadataJson, occurredAt);
    }

    public List<AuditEvent> findAll() {
        return repository.findAll().stream()
                .map(e -> new AuditEvent(e.getActorId(), e.getAction(), e.getTargetType(), e.getTargetId(), e.getMetadataJson(), e.getOccurredAt()))
                .collect(Collectors.toList());
    }
}
