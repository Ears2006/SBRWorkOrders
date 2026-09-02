import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { SortIcon } from '@/components/SortIcon';
import { formatDate } from '@/lib/format';
import type { SortConfig, WorkOrder, WorkOrderSortColumn } from '@/types';

interface WorkOrderTableProps {
  orders: WorkOrder[];
  sortConfig: SortConfig;
  onSort: (col: WorkOrderSortColumn) => void;
}

export function WorkOrderTable({ orders, sortConfig, onSort }: WorkOrderTableProps) {
  const navigate = useNavigate();

  return (
    <div className="hidden md:block bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/60">
            <th scope="col" className="px-4 py-3 text-left">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">WO #</span>
            </th>
            <Th column="description" sortConfig={sortConfig} onSort={onSort}>
              Description
            </Th>
            <Th column="status" sortConfig={sortConfig} onSort={onSort}>
              Status
            </Th>
            <Th column="assignedTo" sortConfig={sortConfig} onSort={onSort}>
              Assigned To
            </Th>
            <Th column="createdBy" sortConfig={sortConfig} onSort={onSort}>
              Created By
            </Th>
            <Th column="dateCreated" sortConfig={sortConfig} onSort={onSort}>
              Date Created
            </Th>
            <th className="w-10 px-4 py-3" aria-label="open" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {orders.map((o) => (
            <tr
              key={o.id}
              onClick={() => navigate(`/work-orders/${o.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(`/work-orders/${o.id}`);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`Open work order: ${o.subject}`}
              className="group cursor-pointer outline-none transition hover:bg-slate-50 focus-visible:bg-blue-50/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600"
            >
              <td className="px-4 py-3.5">
                <span className="font-mono text-xs text-slate-500 whitespace-nowrap">{o.work_order_number}</span>
              </td>
              <td className="px-4 py-3.5">
                <div className="font-medium text-slate-900 truncate max-w-md">{o.subject}</div>
                <div className="text-xs text-slate-400 truncate max-w-md">{o.location}</div>
              </td>
              <td className="px-4 py-3.5">
                <StatusBadge status={o.status} size="sm" />
              </td>
              <td className="px-4 py-3.5 text-sm text-slate-600">
                {o.assigned_to ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    {o.assigned_to}
                  </span>
                ) : (
                  <span className="text-slate-300">Unassigned</span>
                )}
              </td>
              <td className="px-4 py-3.5 text-sm text-slate-600">{o.requester_name}</td>
              <td className="px-4 py-3.5 text-sm text-slate-600 whitespace-nowrap">
                {formatDate(o.created_at)}
              </td>
              <td className="px-4 py-3.5">
                <ChevronRight
                  className="h-4 w-4 text-slate-300 group-hover:text-slate-500 group-focus-visible:text-blue-600 transition"
                  aria-hidden
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface ThProps {
  column: WorkOrderSortColumn;
  sortConfig: SortConfig;
  onSort: (col: WorkOrderSortColumn) => void;
  children: React.ReactNode;
}

function Th({ column, sortConfig, onSort, children }: ThProps) {
  const active = sortConfig.column === column;
  return (
    <th scope="col" className="px-4 py-3 text-left">
      <button
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide hover:text-slate-900 transition"
        aria-sort={active ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        {children}
        <SortIcon active={active} direction={sortConfig.direction} />
      </button>
    </th>
  );
}
