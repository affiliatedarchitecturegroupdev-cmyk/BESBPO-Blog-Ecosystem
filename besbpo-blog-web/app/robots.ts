const SITE_URL = 'https://blog.besbpo.co.za';

export default function robots() {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
