'use server';

import { redirect } from 'next/navigation';
import { setSessionCookie, clearSessionCookie } from '../../lib/session.ts';

const CMS_API_BASE_URL = process.env.CMS_API_BASE_URL;

export interface LoginActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Real per-user login (Doc-01 Section 8 / Doc-04 Section 5) — calls
 * besbpo-blog-cms-api's POST /auth/login and, on success, stores the
 * returned JWT in an HTTP-only session cookie (lib/session.ts). This is
 * the ONE place a plaintext password exists in this app at all, and it
 * never leaves this server-side function — it's sent directly to the
 * CMS API over the request this action makes, never logged, never
 * stored, never echoed back in the result.
 *
 * Deliberately generic error message regardless of whether the email
 * didn't exist or the password was wrong (matching AuthService.login's
 * own generic-null-for-either-case design on the backend) — a specific
 * "no such user" vs "wrong password" distinction here would undo the
 * enumeration protection that backend already went to the trouble of
 * building via constant-ish-time comparison.
 */
export async function loginAction(email: string, password: string): Promise<LoginActionResult> {
  if (!email || !password) {
    return { ok: false, error: 'Email and password are both required.' };
  }
  if (!CMS_API_BASE_URL) {
    return { ok: false, error: 'CMS_API_BASE_URL is not configured — cannot log in.' };
  }

  try {
    const res = await fetch(`${CMS_API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      return { ok: false, error: 'Invalid email or password.' };
    }

    const result = (await res.json()) as { accessToken: string };
    setSessionCookie(result.accessToken);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function logoutAction(): Promise<void> {
  clearSessionCookie();
  // Explicit rather than relying on the next navigation to hit
  // middleware.ts and get redirected there implicitly — both would work
  // (middleware runs on every request, including whatever navigation
  // follows this form submission), but an explicit redirect here doesn't
  // depend on that reasoning holding.
  redirect('/login');
}
