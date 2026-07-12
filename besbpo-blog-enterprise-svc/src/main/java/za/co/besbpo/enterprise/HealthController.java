package za.co.besbpo.enterprise;

import java.time.Instant;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {

    @GetMapping("/healthz")
    public Map<String, Object> health() {
        return Map.of(
            "status", "ok",
            "service", "besbpo-blog-enterprise-svc",
            "time", Instant.now().toString()
        );
    }
}
