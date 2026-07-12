import Link from 'next/link';
import { listDivisions } from '../lib/api';

// Server component — division nav is enumerated at build time, consistent
// with this app's static export model (Doc-04 Section 3.1). If the
// division list changes, the site rebuilds on the next publish event; it
// doesn't need to change without one.
export async function SiteHeader() {
  const divisions = await listDivisions();

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link href="/" className="site-header__wordmark">
          Besbpo Group <strong>/ Field Index</strong>
        </Link>
        <nav className="site-nav" aria-label="Divisions">
          {divisions.slice(0, 6).map((division) => (
            <Link key={division.key} href={`/divisions/${division.key}`}>
              {division.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
