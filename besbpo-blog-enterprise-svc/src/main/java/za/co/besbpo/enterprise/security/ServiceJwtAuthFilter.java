package za.co.besbpo.enterprise.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;
import java.util.Map;

/**
 * Verifies the {@code Authorization: Bearer <token>} header against
 * {@link ServiceJwtVerifier} and populates the Spring Security context on
 * success. {@code /healthz} is exempted here (also exempted in
 * {@link SecurityConfig}'s {@code permitAll} rule) so health checks don't
 * need a token.
 *
 * Closes a real gap this repo carried since Phase 0 — {@code /api/v1/audit}
 * had no authentication at all, reachable by anyone who could route to it.
 */
@Component
public class ServiceJwtAuthFilter extends OncePerRequestFilter {

    private final ServiceJwtVerifier verifier;

    public ServiceJwtAuthFilter(@Value("${besbpo.service-jwt-secret}") String serviceJwtSecret) {
        this.verifier = new ServiceJwtVerifier(serviceJwtSecret);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        if ("/healthz".equals(request.getRequestURI())) {
            filterChain.doFilter(request, response);
            return;
        }

        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "missing service bearer token");
            return;
        }

        String token = authHeader.substring("Bearer ".length());
        try {
            Map<String, Object> claims = verifier.verify(token);
            Object service = claims.get("service");
            String principal = service != null ? service.toString() : "unknown-service";

            var authentication = new UsernamePasswordAuthenticationToken(principal, null, Collections.emptyList());
            SecurityContextHolder.getContext().setAuthentication(authentication);

            filterChain.doFilter(request, response);
        } catch (ServiceJwtVerifier.VerificationException e) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "invalid service token: " + e.getMessage());
        }
    }
}
