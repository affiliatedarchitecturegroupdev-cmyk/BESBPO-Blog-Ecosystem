import Link from 'next/link';

export default function NotFound() {
  return (
    <section>
      <p className="eyebrow">404</p>
      <h1>This page isn&apos;t on file.</h1>
      <p className="article-card__excerpt">
        The article, division, or tag you're looking for doesn't exist — or has been archived.
        Try the <Link href="/" className="stamp">homepage</Link>.
      </p>
    </section>
  );
}
