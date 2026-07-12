package za.co.besbpo.enterprise.security;

import org.junit.jupiter.api.Test;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ServiceJwtVerifierTest {

    private static final String SECRET = "test-secret-for-jwt-verification";

    /**
     * Hand-signs a token the same way this test's own production code
     * verifies one — deliberately re-implemented here rather than reusing
     * any shared signing helper, so a bug in one wouldn't be masked by the
     * same bug in the other.
     */
    private static String signToken(String secret, String headerJson, String payloadJson) throws Exception {
        String headerB64 = base64UrlNoPad(headerJson.getBytes(StandardCharsets.UTF_8));
        String payloadB64 = base64UrlNoPad(payloadJson.getBytes(StandardCharsets.UTF_8));
        String signingInput = headerB64 + "." + payloadB64;

        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        byte[] signature = mac.doFinal(signingInput.getBytes(StandardCharsets.UTF_8));
        String signatureB64 = base64UrlNoPad(signature);

        return signingInput + "." + signatureB64;
    }

    private static String base64UrlNoPad(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private long nowPlusSeconds(long seconds) {
        return (System.currentTimeMillis() / 1000) + seconds;
    }

    @Test
    void acceptsAValidToken() throws Exception {
        long exp = nowPlusSeconds(3600);
        String token = signToken(SECRET, "{\"alg\":\"HS256\",\"typ\":\"JWT\"}", "{\"service\":\"besbpo-blog-cms-api\",\"exp\":" + exp + "}");

        var claims = new ServiceJwtVerifier(SECRET).verify(token);

        assertThat(claims.get("service")).isEqualTo("besbpo-blog-cms-api");
    }

    @Test
    void rejectsAnExpiredToken() throws Exception {
        long exp = nowPlusSeconds(-3600);
        String token = signToken(SECRET, "{\"alg\":\"HS256\",\"typ\":\"JWT\"}", "{\"service\":\"besbpo-blog-cms-api\",\"exp\":" + exp + "}");

        assertThatThrownBy(() -> new ServiceJwtVerifier(SECRET).verify(token))
                .isInstanceOf(ServiceJwtVerifier.VerificationException.class)
                .hasMessageContaining("expired");
    }

    @Test
    void rejectsATokenSignedWithADifferentSecret() throws Exception {
        long exp = nowPlusSeconds(3600);
        String token = signToken("a-completely-different-secret", "{\"alg\":\"HS256\"}", "{\"service\":\"x\",\"exp\":" + exp + "}");

        assertThatThrownBy(() -> new ServiceJwtVerifier(SECRET).verify(token))
                .isInstanceOf(ServiceJwtVerifier.VerificationException.class)
                .hasMessageContaining("signature mismatch");
    }

    @Test
    void rejectsATamperedPayload() throws Exception {
        long exp = nowPlusSeconds(3600);
        String token = signToken(SECRET, "{\"alg\":\"HS256\"}", "{\"service\":\"besbpo-blog-cms-api\",\"exp\":" + exp + "}");
        String[] parts = token.split("\\.");
        // Swap in a different, still well-formed payload without re-signing —
        // simulates an attacker modifying claims without knowing the secret.
        String tamperedPayload = base64UrlNoPad("{\"service\":\"attacker\",\"exp\":" + exp + "}".getBytes(StandardCharsets.UTF_8));
        String tamperedToken = parts[0] + "." + tamperedPayload + "." + parts[2];

        assertThatThrownBy(() -> new ServiceJwtVerifier(SECRET).verify(tamperedToken))
                .isInstanceOf(ServiceJwtVerifier.VerificationException.class)
                .hasMessageContaining("signature mismatch");
    }

    @Test
    void rejectsAnUnexpectedAlgorithmHeader() throws Exception {
        // A token that claims a different (or missing) algorithm must be
        // rejected outright — the algorithm-confusion guard — even though
        // this specific test still signs it with real HMAC-SHA256; the
        // header claim alone must not be trusted.
        long exp = nowPlusSeconds(3600);
        String token = signToken(SECRET, "{\"alg\":\"none\"}", "{\"service\":\"x\",\"exp\":" + exp + "}");

        assertThatThrownBy(() -> new ServiceJwtVerifier(SECRET).verify(token))
                .isInstanceOf(ServiceJwtVerifier.VerificationException.class)
                .hasMessageContaining("alg");
    }

    @Test
    void rejectsAMalformedTokenWithWrongNumberOfParts() {
        assertThatThrownBy(() -> new ServiceJwtVerifier(SECRET).verify("not.a.real.jwt.token"))
                .isInstanceOf(ServiceJwtVerifier.VerificationException.class)
                .hasMessageContaining("malformed");
    }

    @Test
    void acceptsAShortDevSecret_theWholePointOfNotUsingAJwtLibrary() throws Exception {
        // This is the specific case JJWT's Keys.hmacShaKeyFor would reject
        // (23 ASCII bytes = 184 bits, short of HS256's 256-bit minimum) —
        // see the class-level doc comment on ServiceJwtVerifier for why
        // that matters for cross-language interoperability with the
        // Go/NestJS services, which sign with this exact secret string.
        String shortSecret = "dev-secret-change-me";
        long exp = nowPlusSeconds(3600);
        String token = signToken(shortSecret, "{\"alg\":\"HS256\"}", "{\"service\":\"besbpo-blog-cms-api\",\"exp\":" + exp + "}");

        var claims = new ServiceJwtVerifier(shortSecret).verify(token);

        assertThat(claims.get("service")).isEqualTo("besbpo-blog-cms-api");
    }
}
