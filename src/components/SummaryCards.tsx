import { ClipboardList, Wrench, Clock, CheckCircle2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { StatusFilter } from '@/pages/DashboardPage';

interface SummaryCardsProps {
  counts: Record<string, number>;
  active: StatusFilter;
  onSelect: (filter: StatusFilter) => void;
}

interface CardConfig {
  key: StatusFilter;
  label: string;
  icon: LucideIcon;
  accent: string;
  iconBg: string;
  iconText: string;
  ring: string;
  hover: string;
}

const CARDS: CardConfig[] = [
  {
    key: 'all',
    label: 'Total Work Orders',
    icon: ClipboardList,
    accent: 'text-slate-900',
    iconBg: 'bg-slate-100',
    iconText: 'text-slate-600',
    ring: 'ring-blue-600 bg-blue-50',
    hover: 'hover:bg-slate-50 hover:ring-slate-400',
  },
  {
    key: 'active',
    label: 'Active',
    icon: Wrench,
    accent: 'text-blue-700',
    iconBg: 'bg-blue-50',
    iconText: 'text-blue-600',
    ring: 'ring-blue-600 bg-blue-50',
    hover: 'hover:bg-blue-50/60 hover:ring-blue-300',
  },
  {
    key: 'waiting_for_parts',
    label: 'Waiting for Parts',
    icon: Clock,
    accent: 'text-amber-700',
    iconBg: 'bg-amber-50',
    iconText: 'text-amber-600',
    ring: 'ring-amber-500 bg-amber-50',
    hover: 'hover:bg-amber-50/60 hover:ring-amber-300',
  },
  {
    key: 'completed',
    label: 'Completed',
    icon: CheckCircle2,
    accent: 'text-emerald-700',
    iconBg: 'bg-emerald-50',
    iconText: 'text-emerald-600',
    ring: 'ring-emerald-500 bg-emerald-50',
    hover: 'hover:bg-emerald-50/60 hover:ring-emerald-300',
  },
];

export function SummaryCards({ counts, active, onSelect }: SummaryCardsProps) {
  return (
    <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {CARDS.map((card) => {
        const isSelected = active === card.key;
        const count = counts[card.key] ?? 0;
        const Icon = card.icon;
        return (
          <button
            key={card.key}
            onClick={() => onSelect(card.key)}
            aria-pressed={isSelected}
            className={`group relative flex items-center gap-3 rounded-xl bg-white p-3.5 text-left ring-1 ring-inset transition-all duration-200 ${
              isSelected
                ? `${card.ring} ring-2 shadow-sm`
                : `ring-slate-200 ${card.hover}`
            }`}
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${card.iconBg} ${card.iconText} transition`}
            >
              <Icon className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold leading-none tracking-tight text-slate-900 tabular-nums">
                {count}
              </p>
              <p className="mt-1 truncate text-xs font-medium text-slate-500">
                {card.label}
              </p>
            </div>
            {isSelected && (
              <span
                className={`absolute right-3 top-3 h-2 w-2 rounded-full ${
                  card.key === 'all'
                    ? 'bg-blue-600'
                    : card.key === 'active'
                      ? 'bg-blue-600'
                      : card.key === 'waiting_for_parts'
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                }`}
                aria-hidden
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
