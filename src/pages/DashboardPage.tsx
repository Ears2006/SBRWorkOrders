import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, X } from 'lucide-react';
import { useWorkOrders } from '@/hooks/useWorkOrders';
import { SummaryCards } from '@/components/SummaryCards';
import { WorkOrderTable } from '@/components/WorkOrderTable';
import { WorkOrderMobileCard } from '@/components/WorkOrderMobileCard';
import { EmptyState } from '@/components/EmptyState';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Pagination, PAGE_SIZE_OPTIONS, type PageSize } from '@/components/Pagination';
import { sortWorkOrders, INITIAL_SORT_DIRECTIONS } from '@/utils/sorting';
import {
  STATUS_VALUES,
  type WorkOrderStatus,
  type WorkOrderSortColumn,
  type SortConfig,
} from '@/types';

export type StatusFilter = 'all' | WorkOrderStatus;

export function DashboardPage() {
  const navigate = useNavigate();
  const { orders, loading, error, refetch } = useWorkOrders();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ column: null, direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(PAGE_SIZE_OPTIONS[0]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = orders;

    if (filter !== 'all') {
      rows = rows.filter((o) => o.status === filter);
    }

    if (q) {
      rows = rows.filter((o) =>
        [o.subject, o.location, o.description, o.created_by_name, o.requester_name, o.assigned_to ?? '', o.work_order_number]
          .some((field) => field.toLowerCase().includes(q)),
      );
    }
    return rows;
  }, [orders, query, filter]);

  const sorted = useMemo(() => sortWorkOrders(filtered, sortConfig), [filtered, sortConfig]);

  // Reset to page 1 when search/filter/sort/pageSize changes.
  useEffect(() => {
    setCurrentPage(1);
  }, [query, filter, sortConfig, pageSize]);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paged = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, safePage, pageSize]);

  function handleSort(col: WorkOrderSortColumn) {
    setSortConfig((prev) => {
      if (prev.column === col) {
        return { column: col, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { column: col, direction: INITIAL_SORT_DIRECTIONS[col] };
    });
  }

  function handleQueryChange(value: string) {
    setQuery(value);
  }

  function resetFilters() {
    setFilter('all');
    setQuery('');
    setSortConfig({ column: null, direction: 'asc' });
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length };
    for (const s of STATUS_VALUES) c[s] = 0;
    for (const o of orders) c[o.status] += 1;
    return c;
  }, [orders]);

  const activeFilter = filter !== 'all' || query.trim() !== '' || sortConfig.column !== null;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Work Orders</h1>
          <p className="mt-1 text-sm text-slate-500">
            {loading
              ? 'Loading work orders…'
              : `${sorted.length} ${sorted.length === 1 ? 'work order' : 'work orders'} visible`}
            {sorted.length !== orders.length && !loading && (
              <span className="text-slate-400"> of {orders.length} total</span>
            )}
          </p>
        </div>
        <button
          onClick={() => navigate('/work-orders/create')}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Create Work Order
        </button>
      </div>

      {/* Summary cards */}
      <SummaryCards counts={counts} active={filter} onSelect={setFilter} />

      {/* Search + filters */}
      <div className="mb-5 space-y-3">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none"
            aria-hidden
          />
          <input
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search by work order #, subject, location, requester, assigned tech, or creator…"
            className="w-full rounded-lg border-0 bg-white pl-10 pr-10 py-3 text-base sm:text-sm text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 transition"
            aria-label="Search work orders"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeFilter && (
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              Reset
            </button>
          )}
        </div>
      </div>

      {error && <ErrorMessage message={error} onRetry={refetch} />}

      {loading ? (
        <LoadingIndicator label="Loading work orders…" />
      ) : sorted.length === 0 ? (
        <EmptyState hasOrders={orders.length > 0} onCreate={() => navigate('/work-orders/create')} />
      ) : (
        <>
          <WorkOrderTable orders={paged} sortConfig={sortConfig} onSort={handleSort} />
          <div className="md:hidden space-y-3">
            {paged.map((o) => (
              <WorkOrderMobileCard key={o.id} order={o} />
            ))}
          </div>
          <Pagination
            currentPage={safePage}
            pageSize={pageSize}
            totalItems={total}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </>
      )}
    </div>
  );
}
