package za.co.besbpo.enterprise.audit;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * Maps to {@code audit_events} in besbpo-blog-architecture/db/schema.sql.
 * Phase 7 replacement for the Phase 0 in-memory
 * {@code CopyOnWriteArrayList} — see {@link AuditService}.
 *
 * <p>{@code GenerationType.UUID} is the JPA 3.1 standard strategy for
 * client-generated UUID primary keys (added specifically for this use
 * case), used here rather than relying on the database's own
 * {@code DEFAULT uuid_generate_v4()} — Hibernate generates the value
 * before the INSERT, avoiding any ambiguity about which side is
 * authoritative for it.
 */
@Entity
@Table(name = "audit_events")
public class AuditEventEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "actor_id", nullable = false)
    private String actorId;

    @Column(nullable = false)
    private String action;

    @Column(name = "target_type")
    private String targetType;

    @Column(name = "target_id")
    private String targetId;

    @Column(name = "metadata_json", nullable = false)
    private String metadataJson;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    /** Required by JPA — entities must have a no-arg constructor. */
    protected AuditEventEntity() {
    }

    public AuditEventEntity(String actorId, String action, String targetType, String targetId, String metadataJson, Instant occurredAt) {
        this.actorId = actorId;
        this.action = action;
        this.targetType = targetType;
        this.targetId = targetId;
        this.metadataJson = metadataJson;
        this.occurredAt = occurredAt;
    }

    public UUID getId() {
        return id;
    }

    public String getActorId() {
        return actorId;
    }

    public String getAction() {
        return action;
    }

    public String getTargetType() {
        return targetType;
    }

    public String getTargetId() {
        return targetId;
    }

    public String getMetadataJson() {
        return metadataJson;
    }

    public Instant getOccurredAt() {
        return occurredAt;
    }
}
