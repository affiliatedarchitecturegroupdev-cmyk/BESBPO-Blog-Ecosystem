// Test-only stand-in for next/navigation, aliased via tsconfig.test.json's
// `paths`. useRouter() returns a no-op router — sufficient for a static
// react-dom/server render (which never actually calls router.push(), it
// only needs the hook to not throw when called during render).
export function useRouter() {
  return {
    push: (_href: string) => {},
    replace: (_href: string) => {},
    refresh: () => {},
    back: () => {},
  };
}

export function notFound(): never {
  throw new Error('notFound() called in test — this stub does not simulate Next.js 404 handling');
}
