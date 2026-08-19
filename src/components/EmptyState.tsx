import { Inbox, Plus, SearchX } from 'lucide-react';

interface EmptyStateProps {
  hasOrders: boolean;
  onCreate: () => void;
}

export function EmptyState({ hasOrders, onCreate }: EmptyStateProps) {
  const isFiltered = hasOrders;
  return (
    <div className="text-center py-20 bg-white rounded-2xl ring-1 ring-slate-200">
      <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
        {isFiltered ? (
          <SearchX className="h-7 w-7 text-slate-400" aria-hidden />
        ) : (
          <Inbox className="h-7 w-7 text-slate-400" aria-hidden />
        )}
      </div>
      <h3 className="text-base font-semibold text-slate-900">
        {isFiltered ? 'No matching work orders' : 'No work orders have been created yet.'}
      </h3>
      <p className="mt-1 text-sm text-slate-500">
        {isFiltered
          ? 'Try adjusting your search or filters.'
          : 'Create your first work order to get started.'}
      </p>
      {!isFiltered && (
        <button
          onClick={onCreate}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Create Work Order
        </button>
      )}
    </div>
  );
}
