import Link from 'next/link';
import type { PageInfo } from '../lib/pagination';

interface PaginationProps {
  pageInfo: PageInfo;
  /** Builds the href for a given page number — callers own their own URL shape. */
  hrefForPage: (pageNumber: number) => string;
}

export function Pagination({ pageInfo, hrefForPage }: PaginationProps) {
  if (pageInfo.totalPages <= 1) return null;

  return (
    <nav className="pagination" aria-label="Pagination">
      {pageInfo.hasPrevious ? (
        <Link href={hrefForPage(pageInfo.pageNumber - 1)}>&larr; Newer</Link>
      ) : (
        <span className="pagination__disabled">&larr; Newer</span>
      )}

      <span>
        Page {pageInfo.pageNumber} of {pageInfo.totalPages}
      </span>

      {pageInfo.hasNext ? (
        <Link href={hrefForPage(pageInfo.pageNumber + 1)}>Older &rarr;</Link>
      ) : (
        <span className="pagination__disabled">Older &rarr;</span>
      )}
    </nav>
  );
}
