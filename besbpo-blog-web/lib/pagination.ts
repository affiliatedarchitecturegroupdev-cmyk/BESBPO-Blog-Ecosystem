// Pure pagination logic, deliberately dependency-free so it can be unit
// tested in complete isolation (see pagination.test.ts) — no Next.js/React
// types needed to verify this is correct.

// Shared page size for the homepage and /articles/page/[page] archive —
// centralised so both routes stay consistent without hardcoding the number
// twice.
export const ARTICLES_PAGE_SIZE = 4;

export interface PageInfo {
  pageNumber: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export interface PaginatedResult<T> {
  items: T[];
  pageInfo: PageInfo;
}

export function totalPages(itemCount: number, pageSize: number): number {
  if (pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(itemCount / pageSize));
}

/**
 * Slices `items` for a given 1-indexed `pageNumber`. Out-of-range page
 * numbers clamp to the nearest valid page rather than throwing — a
 * statically-generated page for page 99 of a 3-page archive should still
 * render something sane instead of crashing the build.
 */
export function paginate<T>(items: T[], pageSize: number, pageNumber: number): PaginatedResult<T> {
  const safePageSize = pageSize > 0 ? pageSize : items.length || 1;
  const pages = totalPages(items.length, safePageSize);
  const safePageNumber = Math.min(Math.max(1, Math.floor(pageNumber) || 1), pages);

  const start = (safePageNumber - 1) * safePageSize;
  const end = start + safePageSize;

  return {
    items: items.slice(start, end),
    pageInfo: {
      pageNumber: safePageNumber,
      pageSize: safePageSize,
      totalItems: items.length,
      totalPages: pages,
      hasPrevious: safePageNumber > 1,
      hasNext: safePageNumber < pages,
    },
  };
}

/** Builds the list of page numbers `generateStaticParams` should enumerate. */
export function pageNumberParams(itemCount: number, pageSize: number): { page: string }[] {
  const pages = totalPages(itemCount, pageSize);
  return Array.from({ length: pages }, (_, i) => ({ page: String(i + 1) }));
}
