import { cookies } from 'next/headers';
import { decodeSessionUser, type SessionUser } from './jwt-decode.ts';

export type { SessionUser };

// Next.js 14 (see package.json) — cookies() is synchronous here, not the
// Promise-based API Next.js 15 introduced. Checked against the actual
// pinned version rather than copied from newer docs (same discipline as
// the params/searchParams fix elsewhere in this app).

const SESSION_COOKIE_NAME = 'besbpo_session';

/** 24h — a reasonable session length for the cookie itself, but NOT the
 * real enforcement point: the JWT's own expiry (JWT_EXPIRES_IN on the
 * CMS API side, 15m by default) is what actually limits how long a
 * stolen or leaked token stays valid. A longer-lived cookie just avoids
 * forcing a re-login more often than the token itself would already
 * require. */
const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24;

/**
 * Reads the current request's session JWT from its HTTP-only cookie —
 * the only place a per-user token should live. Deliberately never
 * localStorage/sessionStorage, which client-side JavaScript can read —
 * an HTTP-only cookie can't be, which is the actual point: an XSS bug
 * elsewhere in this app can't exfiltrate a token it has no way to read.
 */
export function getSessionToken(): string | undefined {
  return cookies().get(SESSION_COOKIE_NAME)?.value;
}

/** Can only be called from a Server Action or Route Handler (a Next.js
 * constraint — only contexts that can send a Set-Cookie header can
 * mutate cookies), never from a plain Server Component render. */
export function setSessionCookie(token: string): void {
  cookies().set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(): void {
  cookies().delete(SESSION_COOKIE_NAME);
}

/** Convenience: the current request's decoded session user, or null if
 * not logged in / the cookie is missing or unparseable. */
export function getSessionUser(): SessionUser | null {
  const token = getSessionToken();
  if (!token) {
    return null;
  }
  return decodeSessionUser(token);
}
