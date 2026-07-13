'use client';

import { useState, useMemo } from 'react';
import { KanbanArticle } from './EditorialKanban';
import styles from './EditorialCalendar.module.css';

interface EditorialCalendarProps {
  articles: KanbanArticle[];
  onArticleClick?: (id: string) => void;
  onDateChange?: (articleId: string, newDate: Date) => void;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const EditorialCalendar = ({
  articles,
  onArticleClick,
  onDateChange,
}: EditorialCalendarProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: Array<{ date: Date; isCurrentMonth: boolean; articles: KanbanArticle[] }> = [];

    // Previous month days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({
        date,
        isCurrentMonth: false,
        articles: getArticlesForDate(date),
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      days.push({
        date,
        isCurrentMonth: true,
        articles: getArticlesForDate(date),
      });
    }

    // Next month days
    const remainingDays = 42 - days.length; // 6 rows * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(year, month + 1, i);
      days.push({
        date,
        isCurrentMonth: false,
        articles: getArticlesForDate(date),
      });
    }

    return days;
  }, [year, month, articles]);

  function getArticlesForDate(date: Date): KanbanArticle[] {
    return articles.filter((article) => {
      const articleDate = article.scheduledAt || article.publishedAt;
      if (!articleDate) return false;
      const d = new Date(articleDate);
      return (
        d.getDate() === date.getDate() &&
        d.getMonth() === date.getMonth() &&
        d.getFullYear() === date.getFullYear()
      );
    });
  }

  const goToPrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  return (
    <div className={styles.container}>
      {/* Calendar Header */}
      <div className={styles.header}>
        <div className={styles.navigation}>
          <button className={styles.navButton} onClick={goToPrevMonth}>
            &larr;
          </button>
          <h2 className={styles.monthYear}>
            {MONTHS[month]} {year}
          </h2>
          <button className={styles.navButton} onClick={goToNextMonth}>
            &rarr;
          </button>
        </div>
        <button className={styles.todayButton} onClick={goToToday}>
          Today
        </button>
      </div>

      {/* Day Headers */}
      <div className={styles.dayHeaders}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className={styles.dayHeader}>
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className={styles.calendar}>
        {calendarDays.map((day, index) => (
          <div
            key={index}
            className={`${styles.day} ${!day.isCurrentMonth ? styles.otherMonth : ''} ${
              isToday(day.date) ? styles.today : ''
            } ${selectedDate?.getTime() === day.date.getTime() ? styles.selected : ''}`}
            onClick={() => setSelectedDate(day.date)}
          >
            <div className={styles.dayNumber}>{day.date.getDate()}</div>
            <div className={styles.dayArticles}>
              {day.articles.slice(0, 3).map((article) => (
                <div
                  key={article.id}
                  className={styles.articlePill}
                  onClick={(e) => {
                    e.stopPropagation();
                    onArticleClick?.(article.id);
                  }}
                  title={article.title}
                >
                  {article.title.substring(0, 15)}...
                </div>
              ))}
              {day.articles.length > 3 && (
                <div className={styles.moreArticles}>
                  +{day.articles.length - 3} more
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Selected Date Details */}
      {selectedDate && (
        <div className={styles.selectedDatePanel}>
          <h3>
            {selectedDate.toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </h3>
          <div className={styles.selectedDateArticles}>
            {getArticlesForDate(selectedDate).length > 0 ? (
              getArticlesForDate(selectedDate).map((article) => (
                <div
                  key={article.id}
                  className={styles.selectedArticle}
                  onClick={() => onArticleClick?.(article.id)}
                >
                  <span className={styles.articleTitle}>{article.title}</span>
                  <span className={styles.articleStatus}>{article.status}</span>
                </div>
              ))
            ) : (
              <p className={styles.noArticles}>No articles scheduled</p>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.draft}`} />
          Draft
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.review}`} />
          In Review
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.scheduled}`} />
          Scheduled
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.published}`} />
          Published
        </span>
      </div>
    </div>
  );
};

function getArticlesForDate(articles: KanbanArticle[], date: Date): KanbanArticle[] {
  return articles.filter((article) => {
    const articleDate = article.scheduledAt || article.publishedAt;
    if (!articleDate) return false;
    const d = new Date(articleDate);
    return (
      d.getDate() === date.getDate() &&
      d.getMonth() === date.getMonth() &&
      d.getFullYear() === date.getFullYear()
    );
  });
}

export default EditorialCalendar;
