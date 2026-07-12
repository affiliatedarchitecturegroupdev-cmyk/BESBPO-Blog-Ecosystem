package za.co.besbpo.enterprise.audit;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

/**
 * Standard Spring Data JPA repository — {@code save}/{@code findAll} from
 * {@link JpaRepository} are all {@link AuditService} needs for Phase 7's
 * scope. No custom queries yet; add them here (e.g. findByActorId,
 * findByTargetTypeAndTargetId) as real query needs emerge.
 */
public interface AuditEventRepository extends JpaRepository<AuditEventEntity, UUID> {
}
