// ⚠️ PHASE 1 ARCHITECTURAL NOTE for OpenHands (and any human reviewer):
//
// This page exists as a placeholder ONLY. The Editorial Dashboard needs
// live authenticated data (auth via SSO, editorial workflow state, the
// syndication reach preview from Doc-03 Section 10) — none of which is
// compatible with this repo's `output: 'export'` setting in
// next.config.js, which is required for the public blog's GitHub Pages
// deployment (Doc-04 Section 3.1).
//
// Do NOT try to make this page "work" by fetching client-side around the
// static export limitation. Instead, Phase 1 should split the Editorial
// Dashboard into its OWN Next.js application, deployed on Coolify (Doc-01
// Section 5) alongside the other dynamic-tier services, with its own
// package.json/next.config.js/Dockerfile — likely as a new top-level
// directory or its own repository, not nested under this statically
// exported app. This route is left in place only as a visible marker of
// that decision, referenced from besbpo-blog-architecture's ADRs.
export default function DashboardPlaceholder() {
  return (
    <section>
      <h1>Editorial Dashboard</h1>
      <p>
        This route is a placeholder. See the comment at the top of
        <code>app/dashboard/page.tsx</code> — the real dashboard must be its
        own Coolify-deployed Next.js app, not part of this statically
        exported site.
      </p>
    </section>
  );
}
