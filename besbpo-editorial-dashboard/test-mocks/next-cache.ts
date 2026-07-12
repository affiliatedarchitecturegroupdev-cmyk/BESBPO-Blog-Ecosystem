// Test-only stand-in for next/cache, aliased via tsconfig.test.json's
// `paths`. Needed because FieldSourceBadge imports a Server Action
// (app/articles/actions.ts) which imports next/cache's revalidatePath —
// a no-op is fine for rendering tests, which only check what gets
// rendered, not cache invalidation side effects.
export function revalidatePath(_path: string): void {
  // no-op in tests
}
