import { ChevronLeft, ChevronRight } from 'lucide-react';

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

interface PaginationProps {
  currentPage: number;
  pageSize: PageSize;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
}

export function Pagination({
  currentPage,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIdx = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(currentPage * pageSize, totalItems);

  const pageNumbers = getPageNumbers(currentPage, totalPages);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-5">
      {/* Showing X-Y of Z + rows per page */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
        <span>
          Showing <strong className="text-slate-700">{startIdx}</strong>–
          <strong className="text-slate-700">{endIdx}</strong> of{' '}
          <strong className="text-slate-700">{totalItems}</strong>{' '}
          {totalItems === 1 ? 'work order' : 'work orders'}
        </span>
        <div className="flex items-center gap-2">
          <label htmlFor="rows-per-page" className="text-slate-500">
            Rows per page:
          </label>
          <select
            id="rows-per-page"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value) as PageSize)}
            className="appearance-none rounded-lg border-0 bg-white py-1.5 pl-3 pr-8 text-sm font-medium text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 transition"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Page navigation */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Previous</span>
          </button>

          {pageNumbers.map((pn, i) =>
            pn === '...' ? (
              <span key={`ellipsis-${i}`} className="px-2 text-slate-400 text-sm">
                …
              </span>
            ) : (
              <button
                key={pn}
                onClick={() => onPageChange(pn)}
                className={`min-w-[2.25rem] h-9 rounded-lg px-2 text-sm font-medium transition ${
                  pn === currentPage
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 ring-1 ring-inset ring-slate-300 hover:bg-slate-50'
                }`}
                aria-label={`Page ${pn}`}
                aria-current={pn === currentPage ? 'page' : undefined}
              >
                {pn}
              </button>
            ),
          )}

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Next page"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | '...')[] = [1];

  if (current > 3) pages.push('...');

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) pages.push('...');

  pages.push(total);

  return pages;
}
