// Test-only stand-in for next/link, aliased via tsconfig.test.json's
// `paths` so component tests can render with plain react-dom/server
// without needing the full Next.js runtime. NOT used by the real app
// build — next.config.js / tsconfig.json (the ones `next build` reads)
// don't reference this file; only tsconfig.test.json does.
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
