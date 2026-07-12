// Test-only stand-in for next/link, aliased via tsconfig.test.json's
// `paths` so component tests can render with plain react-dom/server
// without needing the full Next.js runtime. NOT used by the real app
// build — next.config.js / tsconfig.json (the ones `next build` reads)
// don't reference this file; only tsconfig.test.json does.
//
// Re-added in the authoring-UI pass — this app's Phase 8 incarnation
// (analytics-only, one page, no links between pages) genuinely had no
// client-side navigation to mock, so this file and its tsconfig.test.json
// path mapping were removed as dead config at the time. ArticleListTable
// now links to each article's edit page, so it's back.
import type { ReactNode, AnchorHTMLAttributes } from 'react';

interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children?: ReactNode;
}

export default function Link({ href, children, ...rest }: LinkProps) {
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}
