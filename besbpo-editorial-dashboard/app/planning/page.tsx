'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import EditorialKanban, { KanbanArticle, ViewMode } from '@/components/planning/EditorialKanban';
import EditorialCalendar from '@/components/planning/EditorialCalendar';
import styles from './page.module.css';

export default function PlanningPage() {
  const router = useRouter();
  const [articles, setArticles] = useState<KanbanArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [filter, setFilter] = useState({
    division: '',
    author: '',
    status: '',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.NEXT_PUBLIC_CMS_API_URL}/articles`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch articles');
      }

      const data = await response.json();
      setArticles(
        data.map((article: any) => ({
          id: article.id,
          title: article.title,
          slug: article.slug,
          status: article.status,
          author: article.author?.displayName || 'Unknown',
          divisionTags: article.divisionTags || [],
          scheduledAt: article.scheduledAt,
          publishedAt: article.publishedAt,
          updatedAt: article.updatedAt,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load articles');
      // Use mock data for demo
      setArticles(getMockArticles());
    } finally {
      setLoading(false);
    }
  };

  const handleArticleClick = (id: string) => {
    router.push(`/articles/${id}`);
  };

  const handleStatusChange = async (articleId: string, newStatus: string) => {
    // Optimistic update
    setArticles((prev) =>
      prev.map((a) => (a.id === articleId ? { ...a, status: newStatus } : a))
    );

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_CMS_API_URL}/articles/${articleId}/transition`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update status');
      }
    } catch (err) {
      // Revert on error
      fetchArticles();
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  };

  const handleBulkAction = async (articleIds: string[], action: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_CMS_API_URL}/articles/bulk`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({ articleIds, action }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to ${action} articles`);
      }

      // Refresh articles
      fetchArticles();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} articles`);
    }
  };

  const filteredArticles = articles.filter((article) => {
    if (filter.division && !article.divisionTags.includes(filter.division)) {
      return false;
    }
    if (filter.author && !article.author.toLowerCase().includes(filter.author.toLowerCase())) {
      return false;
    }
    if (filter.status && article.status !== filter.status) {
      return false;
    }
    return true;
  });

  const divisions = [...new Set(articles.flatMap((a) => a.divisionTags))];
  const authors = [...new Set(articles.map((a) => a.author))];

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Loading editorial planning...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Editorial Planning</h1>
        <div className={styles.viewToggle}>
          <button
            className={`${styles.viewButton} ${viewMode === 'kanban' ? styles.active : ''}`}
            onClick={() => setViewMode('kanban')}
          >
            Kanban
          </button>
          <button
            className={`${styles.viewButton} ${viewMode === 'calendar' ? styles.active : ''}`}
            onClick={() => setViewMode('calendar')}
          >
            Calendar
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <select
          className={styles.filterSelect}
          value={filter.division}
          onChange={(e) => setFilter({ ...filter, division: e.target.value })}
        >
          <option value="">All Divisions</option>
          {divisions.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        <select
          className={styles.filterSelect}
          value={filter.author}
          onChange={(e) => setFilter({ ...filter, author: e.target.value })}
        >
          <option value="">All Authors</option>
          {authors.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        <select
          className={styles.filterSelect}
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="division_review">Division Review</option>
          <option value="corporate_review">Corporate Review</option>
          <option value="scheduled">Scheduled</option>
          <option value="published">Published</option>
        </select>

        <button
          className={styles.clearFilters}
          onClick={() => setFilter({ division: '', author: '', status: '' })}
        >
          Clear Filters
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className={styles.error}>
          {error}
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Main Content */}
      <div className={styles.content}>
        {viewMode === 'kanban' ? (
          <EditorialKanban
            articles={filteredArticles}
            onArticleClick={handleArticleClick}
            onStatusChange={handleStatusChange}
            onBulkAction={handleBulkAction}
          />
        ) : (
          <EditorialCalendar
            articles={filteredArticles}
            onArticleClick={handleArticleClick}
          />
        )}
      </div>

      {/* Stats */}
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{articles.length}</span>
          <span className={styles.statLabel}>Total Articles</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>
            {articles.filter((a) => a.status === 'draft').length}
          </span>
          <span className={styles.statLabel}>Drafts</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>
            {articles.filter((a) => a.status === 'published').length}
          </span>
          <span className={styles.statLabel}>Published</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>
            {articles.filter((a) => a.status === 'scheduled').length}
          </span>
          <span className={styles.statLabel}>Scheduled</span>
        </div>
      </div>
    </div>
  );
}

// Mock data for demo purposes
function getMockArticles(): KanbanArticle[] {
  return [
    {
      id: '1',
      title: 'The Future of Smart Cities in South Africa',
      slug: 'future-smart-cities-sa',
      status: 'draft',
      author: 'John Smith',
      divisionTags: ['smart-cities', 'built-environment'],
      updatedAt: new Date().toISOString(),
    },
    {
      id: '2',
      title: 'Sustainable Construction Practices',
      slug: 'sustainable-construction',
      status: 'division_review',
      author: 'Jane Doe',
      divisionTags: ['sustainability'],
      updatedAt: new Date().toISOString(),
    },
    {
      id: '3',
      title: 'Infrastructure Investment Trends',
      slug: 'infrastructure-investment',
      status: 'corporate_review',
      author: 'Bob Johnson',
      divisionTags: ['investment-finance'],
      scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '4',
      title: 'Renewable Energy in Infrastructure',
      slug: 'renewable-energy-infra',
      status: 'scheduled',
      author: 'Alice Brown',
      divisionTags: ['energy', 'sustainability'],
      scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '5',
      title: 'Urban Transport Solutions',
      slug: 'urban-transport',
      status: 'published',
      author: 'John Smith',
      divisionTags: ['transportation'],
      publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
}
