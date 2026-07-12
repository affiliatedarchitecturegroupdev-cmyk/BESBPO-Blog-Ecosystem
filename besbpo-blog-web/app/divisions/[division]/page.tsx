import { listArticlesByDivision, listDivisions } from '../../../lib/api';
import { ArticleCard } from '../../../components/ArticleCard';

// Required for `output: export` — enumerate every division key at build
// time (Doc-03 Section 5 taxonomy).
export async function generateStaticParams() {
  const divisions = await listDivisions();
  return divisions.map((division) => ({ division: division.key }));
}

export default async function DivisionPage({ params }: { params: { division: string } }) {
  const articles = await listArticlesByDivision(params.division);

  return (
    <section>
      <p className="eyebrow">Division</p>
      <h1>{params.division.replace(/-/g, ' ')}</h1>
      <div className="article-list">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>
    </section>
  );
}
