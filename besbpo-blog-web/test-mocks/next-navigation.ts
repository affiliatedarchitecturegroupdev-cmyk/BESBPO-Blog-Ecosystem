// Test-only stand-in for next/navigation — see next-link.tsx for why this
// exists and how it's wired in (tsconfig.test.json `paths`).
export function notFound(): never {
  throw new Error('NEXT_NOT_FOUND');
}
