'use client';

import { useState, useMemo } from 'react';
import { ArticleStatusBadge } from '../ArticleStatusBadge.tsx';
import styles from './EditorialKanban.module.css';

export interface KanbanArticle {
  id: string;
  title: string;
  slug: string;
  status: string;
  author: string;
  divisionTags: string[];
  scheduledAt?: string;
  publishedAt?: string;
  updatedAt: string;
}

export type ViewMode = 'kanban' | 'calendar';

interface EditorialKanbanProps {
  articles: KanbanArticle[];
  onArticleClick?: (id: string) => void;
  onStatusChange?: (articleId: string, newStatus: string) => void;
  onBulkAction?: (articleIds: string[], action: string) => void;
}

const STATUS_COLUMNS = [
  { key: 'draft', label: 'Draft', color: '#6b7280' },
  { key: 'division_review', label: 'Division Review', color: '#f59e0b' },
  { key: 'corporate_review', label: 'Corporate Review', color: '#8b5cf6' },
  { key: 'scheduled', label: 'Scheduled', color: '#3b82f6' },
  { key: 'published', label: 'Published', color: '#10b981' },
];

const EditorialKanban = ({
  articles,
  onArticleClick,
  onStatusChange,
  onBulkAction,
}: EditorialKanbanProps) => {
  const [selectedArticles, setSelectedArticles] = useState<Set<string>>(new Set());
  const [draggedArticle, setDraggedArticle] = useState<KanbanArticle | null>(null);

  const articlesByStatus = useMemo(() => {
    const grouped: Record<string, KanbanArticle[]> = {};
    STATUS_COLUMNS.forEach((col) => {
      grouped[col.key] = articles.filter((a) => a.status === col.key);
    });
    // Also include other statuses
    articles.forEach((article) => {
      if (!grouped[article.status]) {
        grouped[article.status] = [];
      }
      if (!STATUS_COLUMNS.find((c) => c.key === article.status)) {
        grouped[article.status].push(article);
      }
    });
    return grouped;
  }, [articles]);

  const handleSelectArticle = (id: string) => {
    const newSelected = new Set(selectedArticles);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedArticles(newSelected);
  };

  const handleSelectAll = (status: string) => {
    const statusArticles = articlesByStatus[status] || [];
    const allSelected = statusArticles.every((a) => selectedArticles.has(a.id));
    
    if (allSelected) {
      const newSelected = new Set(selectedArticles);
      statusArticles.forEach((a) => newSelected.delete(a.id));
      setSelectedArticles(newSelected);
    } else {
      const newSelected = new Set(selectedArticles);
      statusArticles.forEach((a) => newSelected.add(a.id));
      setSelectedArticles(newSelected);
    }
  };

  const handleDragStart = (e: React.DragEvent, article: KanbanArticle) => {
    setDraggedArticle(article);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    if (draggedArticle && onStatusChange && draggedArticle.status !== newStatus) {
      onStatusChange(draggedArticle.id, newStatus);
    }
    setDraggedArticle(null);
  };

  const handleBulkTransition = (action: string) => {
    if (onBulkAction && selectedArticles.size > 0) {
      onBulkAction(Array.from(selectedArticles), action);
      setSelectedArticles(new Set());
    }
  };

  return (
    <div className={styles.container}>
      {/* Bulk Actions Bar */}
      {selectedArticles.size > 0 && (
        <div className={styles.bulkActionsBar}>
          <span className={styles.selectedCount}>
            {selectedArticles.size} article{selectedArticles.size > 1 ? 's' : ''} selected
          </span>
          <div className={styles.bulkButtons}>
            <button
              className={styles.bulkButton}
              onClick={() => handleBulkTransition('submit')}
            >
              Submit for Review
            </button>
            <button
              className={styles.bulkButton}
              onClick={() => handleBulkTransition('approve')}
            >
              Approve
            </button>
            <button
              className={styles.bulkButton}
              onClick={() => handleBulkTransition('publish')}
            >
              Publish
            </button>
            <button
              className={`${styles.bulkButton} ${styles.danger}`}
              onClick={() => handleBulkTransition('delete')}
            >
              Delete
            </button>
          </div>
          <button
            className={styles.clearSelection}
            onClick={() => setSelectedArticles(new Set())}
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* Kanban Columns */}
      <div className={styles.kanban}>
        {STATUS_COLUMNS.map((column) => (
          <div
            key={column.key}
            className={styles.column}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.key)}
          >
            <div className={styles.columnHeader} style={{ borderColor: column.color }}>
              <div className={styles.columnTitle}>
                <span className={styles.colorDot} style={{ backgroundColor: column.color }} />
                {column.label}
              </div>
              <span className={styles.columnCount}>
                {(articlesByStatus[column.key] || []).length}
              </span>
            </div>

            {/* Select All */}
            <div className={styles.columnSelectAll}>
              <input
                type="checkbox"
                checked={(articlesByStatus[column.key] || []).every((a) =>
                  selectedArticles.has(a.id)
                )}
                onChange={() => handleSelectAll(column.key)}
                disabled={(articlesByStatus[column.key] || []).length === 0}
              />
            </div>

            {/* Cards */}
            <div className={styles.columnCards}>
              {(articlesByStatus[column.key] || []).map((article) => (
                <div
                  key={article.id}
                  className={`${styles.card} ${
                    selectedArticles.has(article.id) ? styles.cardSelected : ''
                  } ${draggedArticle?.id === article.id ? styles.cardDragging : ''}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, article)}
                  onClick={() => onArticleClick?.(article.id)}
                >
                  <div className={styles.cardHeader}>
                    <input
                      type="checkbox"
                      checked={selectedArticles.has(article.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleSelectArticle(article.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className={styles.cardSlug}>{article.slug}</span>
                  </div>
                  <h4 className={styles.cardTitle}>{article.title}</h4>
                  <div className={styles.cardMeta}>
                    <span className={styles.cardAuthor}>{article.author}</span>
                    {article.scheduledAt && (
                      <span className={styles.cardDate}>
                        {new Date(article.scheduledAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <div className={styles.cardTags}>
                    {article.divisionTags.map((tag) => (
                      <span key={tag} className={styles.cardTag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))}

              {((articlesByStatus[column.key] || []).length === 0) && (
                <div className={styles.emptyColumn}>
                  Drop articles here
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EditorialKanban;
