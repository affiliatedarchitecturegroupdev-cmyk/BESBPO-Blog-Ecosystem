// A deliberately minimal DOM shim — just enough surface area for
// src/embed.ts to run its real logic paths (querySelectorAll, createElement,
// dataset, appendChild, innerHTML, localStorage) without pulling in jsdom
// (not available offline in the environment this was built in). This is a
// test harness, not a general-purpose DOM implementation — it supports
// exactly what embed.ts uses, nothing more.

export class FakeElement {
  tagName: string;
  dataset: Record<string, string> = {};
  className = '';
  href = '';
  rel = '';
  private _textContent = '';
  children: FakeElement[] = [];
  private listeners: Record<string, Array<() => void>> = {};

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  get textContent(): string {
    return this._textContent;
  }
  set textContent(value: string) {
    this._textContent = value;
  }

  appendChild(child: FakeElement): void {
    this.children.push(child);
  }

  set innerHTML(_value: string) {
    // embed.ts only ever sets this to '' to clear a container before
    // re-rendering — that's the only behaviour this shim needs to support.
    this.children = [];
  }
  get innerHTML(): string {
    return this.children.length === 0 ? '' : '[fake-non-empty]';
  }

  querySelector(): null {
    return null;
  }

  // Added when embed.ts started attaching a click handler to each
  // rendered article link (Phase 8 beacon tracking) — every existing
  // test that reaches renderFeed would otherwise throw a TypeError the
  // moment embed.ts called link.addEventListener, since this shim didn't
  // support it at all before. Caught by tracing the new code against
  // this fake DOM's actual surface area rather than assuming it would
  // "just work" the same way the real DOM does.
  addEventListener(event: string, cb: () => void): void {
    (this.listeners[event] ||= []).push(cb);
  }

  // Test helper, not a real DOM API — the simplest way for a test to
  // simulate a user click without building a real event-dispatch system.
  simulateClick(): void {
    (this.listeners.click || []).forEach((cb) => cb());
  }
}

export class FakeDocument {
  private registered: FakeElement[] = [];
  readyState = 'complete';
  private listeners: Record<string, (() => void)[]> = {};

  register(el: FakeElement) {
    this.registered.push(el);
  }

  querySelectorAll(selector: string): FakeElement[] {
    // embed.ts only ever calls this with '#besbpo-feed, [data-besbpo-feed]' —
    // match on id-like or data-besbpo-feed-like registration instead of a
    // real CSS selector engine.
    if (selector.includes('besbpo-feed')) {
      return this.registered;
    }
    return [];
  }

  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName);
  }

  addEventListener(event: string, cb: () => void): void {
    (this.listeners[event] ||= []).push(cb);
  }
}

export class FakeLocalStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

export type FakeFetchHandler = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export function installFakeBrowserEnvironment(fetchHandler: FakeFetchHandler) {
  const fakeDocument = new FakeDocument();
  const fakeLocalStorage = new FakeLocalStorage();

  (globalThis as any).document = fakeDocument;
  (globalThis as any).localStorage = fakeLocalStorage;
  // Passes through the second (init/options) argument now too — needed
  // once embed.ts started POSTing beacon bodies (Phase 8); existing
  // handlers that only declare a `url` parameter are unaffected, since
  // JS/TS simply ignores an extra argument a function doesn't declare.
  (globalThis as any).fetch = (url: string, init?: any) => fetchHandler(url, init);
  (globalThis as any).console = console;
  // No navigator stubbing needed: Node's own ambient `navigator` global
  // (present in modern Node versions) already has no `sendBeacon` method,
  // so embed.ts's beacon-sending already deterministically falls through
  // to its fetch-based fallback path without any override here. An
  // earlier version of this shim tried to explicitly set
  // `globalThis.navigator = {}` for the same determinism goal, but that
  // throws in this Node version — `navigator` is defined as a getter-only
  // property on globalThis, not a writable one. Caught by actually
  // running the tests, not by reasoning about it in the abstract.

  return { fakeDocument, fakeLocalStorage };
}
