package za.co.besbpo.enterprise.security;

import com.fasterxml.jackson.databind.ObjectMapper;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.Map;

/**
 * Verifies HS256-signed JWTs using the raw UTF-8 bytes of a shared secret —
 * matching exactly what besbpo-blog-cms-api (NestJS's {@code jsonwebtoken}
 * library, via {@code @nestjs/jwt}) and besbpo-blog-syndication-svc
 * (Go's {@code golang-jwt/v5}) already do for the same shared-secret
 * convention (see those repos' {@code JWT_SECRET}/{@code SERVICE_JWT_SECRET}
 * env vars).
 *
 * <p><b>Deliberately not using a JWT library (e.g. JJWT):</b> JJWT's
 * {@code Keys.hmacShaKeyFor(byte[])} enforces a minimum key length for
 * HS256 (256 bits / 32 bytes) and throws if the provided key is shorter —
 * a real, well-intentioned security default, but one that would reject
 * the short dev-secret values ({@code "dev-secret-change-me"}, 23 ASCII
 * bytes) the other two services accept and sign with directly. Standard
 * HMAC (RFC 2104) has no such minimum — a short key is simply zero-padded
 * internally — so Go and NestJS's HMAC implementations happily sign and
 * verify with it. Using JJWT here would mean either diverging from the
 * platform's shared-secret convention (breaking interoperability) or
 * fighting the library's validation on every short secret. Hand-rolling
 * this narrow piece with {@link Mac} (JDK stdlib, no minimum enforced)
 * preserves actual cross-language interoperability instead.
 */
public class ServiceJwtVerifier {

    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private static final String EXPECTED_ALG_HEADER = "HS256";
    private static final ObjectMapper MAPPER = new ObjectMapper();

    public static class VerificationException extends RuntimeException {
        public VerificationException(String message) {
            super(message);
        }
    }

    private final byte[] secretBytes;

    public ServiceJwtVerifier(String secret) {
        this.secretBytes = secret.getBytes(StandardCharsets.UTF_8);
    }

    /**
     * Verifies the token's signature, algorithm header, and expiry, then
     * returns its claims as a plain map. Throws {@link VerificationException}
     * for any failure — malformed token, wrong/missing {@code alg}, bad
     * signature, or an expired {@code exp} claim.
     */
    public Map<String, Object> verify(String token) {
        String[] parts = token.split("\\.");
        if (parts.length != 3) {
            throw new VerificationException("malformed token: expected 3 dot-separated parts, got " + parts.length);
        }
        String headerB64 = parts[0];
        String payloadB64 = parts[1];
        String signatureB64 = parts[2];

        Map<String, Object> header = decodeJsonSegment(headerB64);

        // Algorithm confusion guard: never trust a token's own claim about
        // its algorithm beyond checking it's exactly the one we compute
        // against below. A token claiming "alg":"none" or any algorithm
        // other than HS256 is rejected outright, regardless of whether its
        // signature would otherwise "verify" against something.
        Object alg = header.get("alg");
        if (!EXPECTED_ALG_HEADER.equals(alg)) {
            throw new VerificationException("unexpected or missing alg header: " + alg);
        }

        byte[] expectedSignature = hmacSha256(headerB64 + "." + payloadB64);
        byte[] providedSignature;
        try {
            providedSignature = Base64.getUrlDecoder().decode(padBase64Url(signatureB64));
        } catch (IllegalArgumentException e) {
            throw new VerificationException("invalid base64url signature: " + e.getMessage());
        }

        // Constant-time comparison — MessageDigest.isEqual is specifically
        // designed to avoid leaking timing information about how many
        // leading bytes matched, unlike Arrays.equals or byte[].equals.
        if (!MessageDigest.isEqual(expectedSignature, providedSignature)) {
            throw new VerificationException("signature mismatch");
        }

        Map<String, Object> claims = decodeJsonSegment(payloadB64);

        Object expClaim = claims.get("exp");
        if (expClaim instanceof Number) {
            long expSeconds = ((Number) expClaim).longValue();
            long nowSeconds = System.currentTimeMillis() / 1000;
            if (nowSeconds >= expSeconds) {
                throw new VerificationException("token expired");
            }
        }

        return claims;
    }

    private byte[] hmacSha256(String data) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(secretBytes, HMAC_ALGORITHM));
            return mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            // GeneralSecurityException variants only — HmacSHA256 is always
            // available on any standard JDK, so this path is unreachable in
            // practice, but propagate as a VerificationException rather than
            // letting a checked exception type leak into callers either way.
            throw new VerificationException("HMAC computation failed: " + e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> decodeJsonSegment(String base64UrlSegment) {
        try {
            byte[] jsonBytes = Base64.getUrlDecoder().decode(padBase64Url(base64UrlSegment));
            return MAPPER.readValue(jsonBytes, Map.class);
        } catch (Exception e) {
            throw new VerificationException("invalid JSON segment: " + e.getMessage());
        }
    }

    /**
     * JWT base64url segments omit padding per the spec; {@link Base64.Decoder}
     * expects it restored before decoding. Padding to a multiple of 4 is
     * always unambiguous to restore since the original unpadded length
     * alone determines how many '=' characters were stripped.
     */
    private String padBase64Url(String segment) {
        int remainder = segment.length() % 4;
        if (remainder == 0) {
            return segment;
        }
        return segment + "=".repeat(4 - remainder);
    }
}
