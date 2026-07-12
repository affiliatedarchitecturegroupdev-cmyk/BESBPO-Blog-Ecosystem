// Test-only stand-in for next/headers, aliased via tsconfig.test.json's
// `paths`. Needed because lib/session.ts (imported transitively by
// app/articles/actions.ts, which nearly every authoring component now
// pulls in for its Server Actions) calls cookies() — without a mock,
// resolving that import fails outright during a component test, since
// next/headers genuinely isn't installed in this environment.
//
// Returns an always-empty cookie jar. Sufficient for a static
// react-dom/server render (which never runs in a real request context
// to have real cookies anyway) — the components under test here only
// need the import to resolve and the function to be callable, not to
// return anything meaningful.
function emptyCookieStore() {
  return {
    get(_name: string) {
      return undefined;
    },
    set(_name: string, _value: string, _opts?: unknown) {
      // no-op in tests
    },
    delete(_name: string) {
      // no-op in tests
    },
  };
}

export function cookies() {
  return emptyCookieStore();
}
