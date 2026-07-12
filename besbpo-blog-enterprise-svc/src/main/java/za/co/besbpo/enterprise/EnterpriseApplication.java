package za.co.besbpo.enterprise;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Enterprise Integration Service — SSO and immutable audit logging for the
 * Besbpo Group blog & syndication platform. Implements BESBPO-BLOG-ARCH-01
 * Section 5 (Enterprise Integration Service) and Section 8 (Security).
 */
@SpringBootApplication
public class EnterpriseApplication {
    public static void main(String[] args) {
        SpringApplication.run(EnterpriseApplication.class, args);
    }
}
