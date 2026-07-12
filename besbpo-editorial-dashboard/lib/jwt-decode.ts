export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
}

/**
 * Decodes a JWT's payload WITHOUT verifying its signature — safe ONLY
 * for display purposes (showing "logged in as X" in the dashboard's
 * header). The CMS API is what actually verifies the signature on every
 * protected call this dashboard makes; this must never be used for any
 * access-control decision, only what to show a human.
 *
 * Deliberately has no dependency on next/headers or any other
 * framework-specific module — this is pure string/JSON handling, kept
 * separate from lib/session.ts's cookie I/O specifically so it can be
 * tested via plain `node --test` without needing next/headers mocked.
 */
export function decodeSessionUser(token: string): SessionUser | null {
  try {
    const payloadSegment = token.split('.')[1];
    if (!payloadSegment) {
      return null;
    }
    const decoded = JSON.parse(Buffer.from(payloadSegment, 'base64url').toString('utf-8'));
    if (typeof decoded.sub !== 'string') {
      return null;
    }
    return {
      id: decoded.sub,
      email: typeof decoded.email === 'string' ? decoded.email : '',
      displayName: typeof decoded.displayName === 'string' ? decoded.displayName : '',
      roles: Array.isArray(decoded.roles) ? decoded.roles : [],
    };
  } catch {
    return null;
  }
}
