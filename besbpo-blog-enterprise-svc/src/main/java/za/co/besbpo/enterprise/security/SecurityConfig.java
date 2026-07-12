package za.co.besbpo.enterprise.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Wires {@link ServiceJwtAuthFilter} into the request pipeline and requires
 * authentication on everything except {@code /healthz}. Uses the Spring
 * Security 6.x lambda DSL (the {@code WebSecurityConfigurerAdapter}-based
 * style this superseded was removed as of Spring Security 5.7 / fully gone
 * in 6.x, which is what Spring Boot 3.3.1's managed version brings in).
 */
@Configuration
public class SecurityConfig {

    private final ServiceJwtAuthFilter serviceJwtAuthFilter;

    public SecurityConfig(ServiceJwtAuthFilter serviceJwtAuthFilter) {
        this.serviceJwtAuthFilter = serviceJwtAuthFilter;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                // Stateless service-to-service API — no browser form
                // submissions or cookies to protect against CSRF for.
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers("/healthz").permitAll()
                        .anyRequest().authenticated()
                )
                .addFilterBefore(serviceJwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
