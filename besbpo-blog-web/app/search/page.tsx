'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import styles from './page.module.css';

interface SearchResult {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  author: {
    name: string;
    avatar?: string;
  };
  publishedAt: string;
  divisionTags: string[];
  similarity?: number;
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  took: number;
}

export default function SearchPage() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [took, setTook] = useState(0);
  const [division, setDivision] = useState('');
  const [sortBy, setSortBy] = useState<'relevance' | 'date'>('relevance');

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setTotal(0);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ q: searchQuery });
      if (division) params.append('division', division);
      params.append('sort', sortBy);
      params.append('limit', '20');

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SEARCH_API_URL}/search?${params}`
      );

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data: SearchResponse = await response.json();
      setResults(data.results);
      setTotal(data.total);
      setTook(data.took);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      // Use mock results for demo
      setResults(getMockResults(searchQuery));
      setTotal(getMockResults(searchQuery).length);
      setTook(15);
    } finally {
      setLoading(false);
    }
  }, [division, sortBy]);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setQuery(q);
      performSearch(q);
    }
  }, [searchParams, performSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query);
    
    // Update URL
    const url = new URL(window.location.href);
    url.searchParams.set('q', query);
    window.history.pushState({}, '', url);
  };

  const highlightMatch = (text: string, searchQuery: string) => {
    if (!searchQuery.trim()) return text;
    
    const regex = new RegExp(`(${searchQuery})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, i) => 
      regex.test(part) ? (
        <mark key={i} className={styles.highlight}>
          {part}
        </mark>
      ) : part
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const divisions = [
    'built-environment',
    'smart-cities',
    'infrastructure',
    'transportation',
    'sustainability',
    'energy',
    'investment-finance',
    'housing',
    'water-waste',
  ];

  return (
    <div className={styles.container}>
      {/* Search Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Search Articles</h1>
        <p className={styles.subtitle}>
          Find articles across all Besbpo Group publications
        </p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSubmit} className={styles.searchForm}>
        <div className={styles.searchInputWrapper}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for articles, topics, or keywords..."
            className={styles.searchInput}
            autoFocus
          />
          <button type="submit" className={styles.searchButton} disabled={loading}>
            {loading ? (
              <span className={styles.spinner} />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            )}
          </button>
        </div>

        <div className={styles.filters}>
          <select
            value={division}
            onChange={(e) => {
              setDivision(e.target.value);
              performSearch(query);
            }}
            className={styles.filterSelect}
          >
            <option value="">All Divisions</option>
            {divisions.map((d) => (
              <option key={d} value={d}>
                {d.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value as 'relevance' | 'date');
              performSearch(query);
            }}
            className={styles.filterSelect}
          >
            <option value="relevance">Most Relevant</option>
            <option value="date">Most Recent</option>
          </select>
        </div>
      </form>

      {/* Error Message */}
      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className={styles.results}>
          <div className={styles.resultsHeader}>
            <span className={styles.resultCount}>
              {total} result{total !== 1 ? 's' : ''} found
            </span>
            <span className={styles.searchTime}>
              ({took}ms)
            </span>
          </div>

          <div className={styles.resultList}>
            {results.map((result) => (
              <article key={result.id} className={styles.resultCard}>
                <div className={styles.resultMeta}>
                  <div className={styles.divisionTags}>
                    {result.divisionTags.map((tag) => (
                      <span key={tag} className={styles.divisionTag}>
                        {tag.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                      </span>
                    ))}
                  </div>
                  <time className={styles.date} dateTime={result.publishedAt}>
                    {formatDate(result.publishedAt)}
                  </time>
                </div>

                <h2 className={styles.resultTitle}>
                  <a href={`/articles/${result.slug}`}>
                    {highlightMatch(result.title, query)}
                  </a>
                </h2>

                <p className={styles.resultExcerpt}>
                  {highlightMatch(result.excerpt, query)}
                </p>

                <div className={styles.resultFooter}>
                  <div className={styles.author}>
                    {result.author.avatar && (
                      <img
                        src={result.author.avatar}
                        alt=""
                        className={styles.authorAvatar}
                      />
                    )}
                    <span className={styles.authorName}>{result.author.name}</span>
                  </div>
                  {result.similarity !== undefined && (
                    <span className={styles.relevance}>
                      {Math.round(result.similarity * 100)}% match
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* No Results */}
      {query && results.length === 0 && !loading && !error && (
        <div className={styles.noResults}>
          <div className={styles.noResultsIcon}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
              <path d="M8 8l6 6M14 8l-6 6" />
            </svg>
          </div>
          <h2>No results found</h2>
          <p>
            We couldn't find any articles matching "<strong>{query}</strong>".
            Try different keywords or browse by division.
          </p>
          <div className={styles.suggestions}>
            <h3>Try searching for:</h3>
            <ul>
              <li><button onClick={() => { setQuery('infrastructure'); performSearch('infrastructure'); }}>Infrastructure</button></li>
              <li><button onClick={() => { setQuery('sustainability'); performSearch('sustainability'); }}>Sustainability</button></li>
              <li><button onClick={() => { setQuery('smart cities'); performSearch('smart cities'); }}>Smart Cities</button></li>
              <li><button onClick={() => { setQuery('transport'); performSearch('transport'); }}>Transport</button></li>
            </ul>
          </div>
        </div>
      )}

      {/* Initial State */}
      {!query && (
        <div className={styles.initialState}>
          <h2>Popular Topics</h2>
          <div className={styles.popularTopics}>
            {divisions.slice(0, 6).map((division) => (
              <button
                key={division}
                className={styles.topicPill}
                onClick={() => {
                  setQuery(division.split('-').join(' '));
                  performSearch(division);
                }}
              >
                {division.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function getMockResults(query: string): SearchResult[] {
  const mockArticles = [
    {
      id: '1',
      title: 'The Future of Smart Cities in South Africa',
      slug: 'future-smart-cities-sa',
      excerpt: 'Exploring how South African cities are embracing digital transformation and sustainable infrastructure to create smarter, more livable urban environments.',
      content: '',
      author: { name: 'Dr. Sarah Johnson', avatar: 'https://i.pravatar.cc/40?img=1' },
      publishedAt: '2024-06-15T10:00:00Z',
      divisionTags: ['smart-cities', 'infrastructure'],
      similarity: 0.95,
    },
    {
      id: '2',
      title: 'Sustainable Infrastructure Development Trends',
      slug: 'sustainable-infrastructure-trends',
      excerpt: 'An in-depth look at the latest trends in sustainable infrastructure, from green buildings to renewable energy integration.',
      content: '',
      author: { name: 'Michael Chen', avatar: 'https://i.pravatar.cc/40?img=3' },
      publishedAt: '2024-06-10T10:00:00Z',
      divisionTags: ['sustainability', 'infrastructure'],
      similarity: 0.88,
    },
    {
      id: '3',
      title: 'Public Transport Innovation in Major Cities',
      slug: 'public-transport-innovation',
      excerpt: 'How major South African cities are revolutionizing public transportation with integrated mobility solutions.',
      content: '',
      author: { name: 'Emma Williams', avatar: 'https://i.pravatar.cc/40?img=5' },
      publishedAt: '2024-06-05T10:00:00Z',
      divisionTags: ['transportation', 'smart-cities'],
      similarity: 0.75,
    },
  ];

  return mockArticles.filter(article => 
    article.title.toLowerCase().includes(query.toLowerCase()) ||
    article.excerpt.toLowerCase().includes(query.toLowerCase()) ||
    article.divisionTags.some(tag => tag.includes(query.toLowerCase()))
  );
}
