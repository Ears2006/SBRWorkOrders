import { STATUS_ORDER, type SortConfig, type WorkOrder, type WorkOrderSortColumn } from '@/types';

/**
 * Default dashboard order: Active -> Waiting for Parts -> Completed,
 * newest-first within each status group. Returns a new sorted array.
 */
export function defaultSort(orders: WorkOrder[]): WorkOrder[] {
  return [...orders].sort((a, b) => {
    const statusCmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (statusCmp !== 0) return statusCmp;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

/**
 * Sorts orders by the given column and direction. When `config.column` is null,
 * falls back to `defaultSort`.
 */
export function sortWorkOrders(orders: WorkOrder[], config: SortConfig): WorkOrder[] {
  if (!config.column) return defaultSort(orders);

  const dir = config.direction === 'asc' ? 1 : -1;
  return [...orders].sort((a, b) => {
    let cmp = 0;
    switch (config.column) {
      case 'description':
        cmp = a.subject.localeCompare(b.subject, 'en', { sensitivity: 'base' });
        break;
      case 'status':
        cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        break;
      case 'assignedTo':
        cmp = (a.assigned_to ?? '').localeCompare(b.assigned_to ?? '', 'en', { sensitivity: 'base' });
        break;
      case 'createdBy':
        cmp = a.created_by_name.localeCompare(b.created_by_name, 'en', { sensitivity: 'base' });
        break;
      case 'dateCreated':
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        break;
    }
    return cmp * dir;
  });
}

export const INITIAL_SORT_DIRECTIONS: Record<WorkOrderSortColumn, 'asc' | 'desc'> = {
  description: 'asc',
  status: 'asc',
  assignedTo: 'asc',
  createdBy: 'asc',
  dateCreated: 'desc',
};
