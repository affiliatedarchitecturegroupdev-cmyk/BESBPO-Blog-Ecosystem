export async function flushMicrotasks(rounds = 6) {
  for (let i = 0; i < rounds; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

export function sampleFeedPayload(overrides: Partial<{ articles: unknown[] }> = {}) {
  return {
    tenant_id: 't-1',
    generated_at: '2026-07-07T00:00:00Z',
    articles: [
      {
        id: 'a-1',
        slug: 'sample',
        title: 'Sample Article',
        excerpt: 'An excerpt.',
        canonical_url: 'https://blog.besbpo.co.za/articles/sample',
        division_tags: ['logistics'],
        published_at: '2026-07-01T00:00:00Z',
        reading_time_minutes: 4,
        syndication_meta: { attribution_line: 'Originally published by Besbpo Group', canonical_rel: true },
      },
    ],
    pagination: { next_cursor: null },
    ...overrides,
  };
}
