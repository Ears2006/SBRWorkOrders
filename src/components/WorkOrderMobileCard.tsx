import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { formatDate } from '@/lib/format';
import type { WorkOrder } from '@/types';

interface WorkOrderMobileCardProps {
  order: WorkOrder;
}

export function WorkOrderMobileCard({ order }: WorkOrderMobileCardProps) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/work-orders/${order.id}`)}
      className="w-full text-left bg-white rounded-xl ring-1 ring-slate-200 p-4 active:bg-slate-50 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="font-mono text-xs text-slate-400">{order.work_order_number}</span>
          <h3 className="font-semibold text-slate-900 leading-snug mt-0.5">{order.subject}</h3>
        </div>
        <ArrowRight className="h-4 w-4 text-slate-300 shrink-0 mt-1" aria-hidden />
      </div>
      <div className="mt-2.5">
        <StatusBadge status={order.status} size="sm" />
      </div>
      <dl className="mt-3 space-y-1.5 text-sm">
        <div className="flex gap-2">
          <dt className="text-slate-400 w-20 shrink-0">Requester</dt>
          <dd className="text-slate-700">{order.requester_name}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-slate-400 w-20 shrink-0">Assigned To</dt>
          <dd className="text-slate-700">{order.assigned_to ?? 'Unassigned'}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-slate-400 w-20 shrink-0">Location</dt>
          <dd className="text-slate-700">{order.location}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-slate-400 w-20 shrink-0">Created By</dt>
          <dd className="text-slate-700">{order.requester_name}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-slate-400 w-20 shrink-0">Created</dt>
          <dd className="text-slate-700">{formatDate(order.created_at)}</dd>
        </div>
      </dl>
    </button>
  );
}
