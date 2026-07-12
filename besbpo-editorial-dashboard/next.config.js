/** @type {import('next').NextConfig} */
const nextConfig = {
  // Deliberately NO `output: 'export'` — this is the whole point of this
  // repo existing separately from besbpo-blog-web. The analytics page
  // fetches from besbpo-blog-syndication-svc's admin-JWT-guarded
  // /api/v1/analytics/summary using a server-side secret (SYNDICATION_ADMIN_JWT),
  // which is fundamentally incompatible with a static export (there's no
  // server at request time to keep that secret server-side). Deployed on
  // Coolify as a real running Next.js server, per Doc-01 Section 5 / the
  // note this repo's existence closes in besbpo-blog-web's
  // app/dashboard/page.tsx.
};

module.exports = nextConfig;
