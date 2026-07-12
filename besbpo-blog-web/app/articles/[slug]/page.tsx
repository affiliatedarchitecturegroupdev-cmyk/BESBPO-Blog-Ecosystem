import { getArticleBySlug, listPublishedArticles } from '../../../lib/api';
import { MdxContent } from '../../../components/MdxContent';
import Link from 'next/link';

// Required for `output: export` (Doc-04 Section 3.1) — every article slug
// that should exist as a static page must be enumerated at build time.
export async function generateStaticParams() {
  const articles = await listPublishedArticles();
  return articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const article = await getArticleBySlug(params.slug);
  return {
    title: (article.seo_meta?.meta_title as string) ?? article.title,
    description: (article.seo_meta?.meta_description as string) ?? article.excerpt,
    alternates: {
      // blog.besbpo.co.za is always the canonical origin (Doc-02 Section 9),
      // even though this exact page IS that origin — set explicitly so any
      // future proxy/mirror can safely copy this metadata verbatim.
      canonical: article.canonical_url,
    },
  };
}

export default async function ArticlePage({ params }: { params: { slug: string } }) {
  const article = await getArticleBySlug(params.slug);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    datePublished: article.published_at,
    author: { '@type': 'Person', name: article.author?.name },
    publisher: { '@type': 'Organization', name: 'Besbpo Group' },
    mainEntityOfPage: article.canonical_url,
  };

  return (
    <article>
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <p className="eyebrow">{article.author?.division}</p>
      <h1>{article.title}</h1>
      <p className="article__meta">
        {article.author?.name} &middot;{' '}
        {new Date(article.published_at).toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' })}
        {' '}&middot; {article.reading_time_minutes} min read
      </p>
      <p className="article-card__meta" style={{ marginBottom: '1.5rem' }}>
        {article.division_tags.map((division) => (
          <Link key={division} href={`/divisions/${division}`} className="stamp">
            {division}
          </Link>
        ))}
        {(article.tags ?? []).map((tag) => (
          <Link key={tag} href={`/tags/${tag}`} className="stamp">
            #{tag}
          </Link>
        ))}
      </p>

      <div className="article__body">
        <MdxContent source={article.body_mdx} />
      </div>
    </article>
  );
}
