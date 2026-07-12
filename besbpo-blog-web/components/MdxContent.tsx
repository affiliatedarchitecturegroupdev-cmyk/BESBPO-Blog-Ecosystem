import { MDXRemote } from 'next-mdx-remote/rsc';

// Thin wrapper around next-mdx-remote's React Server Components renderer.
// Kept as its own component (rather than inlined in the article page) so
// the mdxComponents mapping has one obvious home as it grows — e.g. custom
// callout/figure components specific to the Besbpo Group brand.
const mdxComponents = {
  // next-mdx-remote/rsc renders standard HTML tags by default; this map is
  // where custom overrides go as they're needed. Left empty deliberately —
  // Phase 2 doesn't yet have a design need for custom MDX shortcodes.
};

export function MdxContent({ source }: { source: string }) {
  return <MDXRemote source={source} components={mdxComponents} />;
}
