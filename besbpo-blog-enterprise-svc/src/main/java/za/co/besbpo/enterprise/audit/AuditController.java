package za.co.besbpo.enterprise.audit;

import java.util.List;

import jakarta.validation.Valid;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Internal-only audit endpoints. besbpo-blog-cms-api and the Editorial
 * Dashboard call POST /api/v1/audit whenever a human approves an
 * AI-proposed field or performs another action worth an immutable record
 * (Doc-01 Section 8, Doc-03 Section 6).
 *
 * <p>Phase 7: every route here (except {@code /healthz}, handled
 * elsewhere) now requires a valid service JWT — see
 * {@link za.co.besbpo.enterprise.security.SecurityConfig} and
 * {@link za.co.besbpo.enterprise.security.ServiceJwtAuthFilter}, which
 * apply before any request reaches this controller. No auth-specific code
 * belongs in this class itself; that's the point of handling it at the
 * filter-chain layer instead of per-endpoint.
 *
 * <p>Still open: actual network-level restriction (Doc-04 Section 5) so
 * this is unreachable from the public internet even if a valid token were
 * somehow leaked — that's an infrastructure/deployment concern (security
 * groups, VPC placement), not something this class or Spring Security
 * config can enforce from inside the JVM.
 */
@RestController
@RequestMapping("/api/v1/audit")
public class AuditController {

    private final AuditService auditService;

    public AuditController(AuditService auditService) {
        this.auditService = auditService;
    }

    @PostMapping
    public AuditEvent record(@Valid @RequestBody AuditEvent event) {
        return auditService.record(event);
    }

    @GetMapping
    public List<AuditEvent> findAll() {
        return auditService.findAll();
    }
}
