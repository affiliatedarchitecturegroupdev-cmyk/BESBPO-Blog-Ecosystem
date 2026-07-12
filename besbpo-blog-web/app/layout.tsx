import type { ReactNode } from 'react';
import { SiteHeader } from '../components/Header';
import { SiteFooter } from '../components/Footer';
import './globals.css';

export const metadata = {
  metadataBase: new URL('https://blog.besbpo.co.za'),
  title: { default: 'Besbpo Group Blog', template: '%s · Besbpo Group Blog' },
  description: 'Field notes from across Besbpo Group — built environment, logistics, real estate, and more.',
  alternates: { types: { 'application/rss+xml': '/feed.xml' } },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Google Fonts loaded client-side; this is a design choice for the
            reader's browser, not something this build needs network access
            for. See app/globals.css for the token system these back. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;700&family=Source+Serif+4:ital,opsz@0,8..60;1,8..60&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
