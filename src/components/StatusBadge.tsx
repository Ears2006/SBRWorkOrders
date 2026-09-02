import { CheckCircle2, Clock, Wrench } from 'lucide-react';
import type { WorkOrderStatus } from '@/types';
import { STATUS_LABELS } from '@/types';

interface StatusBadgeProps {
  status: WorkOrderStatus;
  size?: 'sm' | 'md';
}

const CONFIG: Record<
  WorkOrderStatus,
  { icon: typeof CheckCircle2; classes: string; dot: string }
> = {
  active: {
    icon: Wrench,
    classes: 'bg-blue-50 text-blue-700 ring-blue-600/20',
    dot: 'bg-blue-500',
  },
  waiting_for_parts: {
    icon: Clock,
    classes: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    dot: 'bg-amber-500',
  },
  completed: {
    icon: CheckCircle2,
    classes: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    dot: 'bg-emerald-500',
  },
};

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const { icon: Icon, classes, dot } = CONFIG[status];
  const sizing =
    size === 'sm'
      ? 'text-xs px-2 py-0.5 gap-1'
      : 'text-sm px-2.5 py-1 gap-1.5';
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ring-1 ring-inset ${classes} ${sizing}`}
    >
      <Icon className={iconSize} aria-hidden />
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  );
}
