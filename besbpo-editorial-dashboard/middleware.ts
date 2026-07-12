import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = 'besbpo_session';

/**
 * Protects every route except /login itself and the health check —
 * redirects to /login when no session cookie is present at all.
 *
 * Deliberately does NOT verify the JWT's signature here — middleware
 * runs in the Edge Runtime, a different, more restricted environment
 * than the rest of this app (no ready access to Node's crypto module
 * the way a Server Action or Server Component has), and real
 * verification already happens on every actual data-fetching call this
 * app makes to besbpo-blog-cms-api / besbpo-blog-syndication-svc — THAT
 * is the layer that actually matters for security. This middleware is
 * only a basic "is anyone logged in at all" gate: an expired or tampered
 * token still passes through here, then correctly fails on the first
 * real API call, which is exactly where it should fail.
 */
export function middleware(request: NextRequest) {
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except: /login (or a logged-out visitor redirect-loops
    // forever), /healthz (a health check shouldn't require auth), Next's
    // own internals, and common static files.
    '/((?!login|healthz|_next/static|_next/image|favicon.ico).*)',
  ],
};
