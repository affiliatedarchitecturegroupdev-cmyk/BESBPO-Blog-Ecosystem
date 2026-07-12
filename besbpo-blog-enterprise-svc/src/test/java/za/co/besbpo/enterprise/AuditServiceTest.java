package za.co.besbpo.enterprise;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import za.co.besbpo.enterprise.audit.AuditEvent;
import za.co.besbpo.enterprise.audit.AuditEventEntity;
import za.co.besbpo.enterprise.audit.AuditEventRepository;
import za.co.besbpo.enterprise.audit.AuditService;

/**
 * Uses a mocked {@link AuditEventRepository} (Mockito, already available
 * via spring-boot-starter-test — no new test dependency needed) rather
 * than a real database, matching every other repo's unit-test style in
 * this platform (mock the persistence boundary, test the service logic
 * around it). Updated for Phase 7 — AuditService previously held its own
 * in-memory list and took no constructor argument at all.
 */
class AuditServiceTest {

    private AuditEventRepository repository;
    private AuditService service;

    @BeforeEach
    void setUp() {
        repository = mock(AuditEventRepository.class);
        service = new AuditService(repository);
    }

    @Test
    void recordSavesAnEntityToTheRepository() {
        AuditEvent event = AuditEvent.now("user-1", "approved_seo_meta", "article", "a-123", "{}");

        AuditEvent result = service.record(event);

        verify(repository, times(1)).save(any(AuditEventEntity.class));
        assertThat(result.actorId()).isEqualTo("user-1");
        assertThat(result.action()).isEqualTo("approved_seo_meta");
    }

    @Test
    void recordFillsInDefaultsForNullMetadataAndOccurredAt() {
        AuditEvent event = new AuditEvent("user-1", "some_action", "article", "a-123", null, null);

        AuditEvent result = service.record(event);

        assertThat(result.metadataJson()).isEqualTo("{}");
        assertThat(result.occurredAt()).isNotNull();
    }

    @Test
    void findAllMapsRepositoryEntitiesBackToAuditEvents() {
        AuditEventEntity entity = new AuditEventEntity("user-1", "approved_seo_meta", "article", "a-123", "{}", Instant.now());
        when(repository.findAll()).thenReturn(List.of(entity));

        List<AuditEvent> events = service.findAll();

        assertThat(events).hasSize(1);
        assertThat(events.get(0).actorId()).isEqualTo("user-1");
        assertThat(events.get(0).action()).isEqualTo("approved_seo_meta");
        assertThat(events.get(0).targetType()).isEqualTo("article");
        assertThat(events.get(0).targetId()).isEqualTo("a-123");
    }

    @Test
    void findAllReturnsEmptyListWhenRepositoryIsEmpty() {
        when(repository.findAll()).thenReturn(List.of());

        assertThat(service.findAll()).isEmpty();
    }
}
