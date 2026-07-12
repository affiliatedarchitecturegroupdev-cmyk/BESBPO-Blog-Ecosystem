import './globals.css';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { getSessionUser } from '../lib/session.ts';
import { logoutAction } from './login/actions.ts';

export const metadata = {
  title: 'Besbpo Editorial Dashboard',
  description: 'Internal editorial dashboard for Besbpo Group — article authoring/review and syndication analytics.',
  robots: 'noindex, nofollow',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // Safe to call in every render, including /login itself (where it will
  // simply be null for a logged-out visitor) — this is a read of the
  // request's cookie, not a mutation, so it doesn't hit the
  // Server-Action-or-Route-Handler-only restriction setSessionCookie/
  // clearSessionCookie are under.
  const user = getSessionUser();

  return (
    <html lang="en">
      <body>
        <header className="app-header">
          <h1>Besbpo Editorial Dashboard</h1>
          <p className="app-header__subtitle">Internal use only — Besbpo Group</p>
          <nav className="app-nav">
            <Link href="/articles">Articles</Link>
            <Link href="/">Analytics</Link>
          </nav>
          {user && (
            <div className="app-user">
              <span>
                Logged in as {user.displayName || user.email || user.id}
                {user.roles.length > 0 && ` (${user.roles.join(', ')})`}
              </span>
              {/* A Server Action passed directly as a form's action prop
                  works without any client-side JavaScript/'use client' —
                  a core supported Next.js App Router pattern, not a
                  workaround. */}
              <form action={logoutAction}>
                <button type="submit" className="app-user__logout">
                  Log out
                </button>
              </form>
            </div>
          )}
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
