/** @type {import('next').NextConfig} */
const nextConfig = {
  // Doc-04 Section 3.1: blog.besbpo.co.za is rebuilt on publish events and
  // deployed to GitHub Pages. Static export keeps that deployment path
  // simple. The Editorial Dashboard route group below (app/dashboard) needs
  // server-side auth/data and should NOT be exported statically — Phase 1
  // (Doc-05) should split it into its own Next.js deployment on Coolify
  // rather than trying to force it through `next export`.
  output: 'export',
  images: { unoptimized: true },
};

module.exports = nextConfig;
