import { Loader2 } from 'lucide-react';
import { STATUS_VALUES, STATUS_LABELS, type WorkOrderStatus } from '@/types';

interface StatusDropdownProps {
  value: WorkOrderStatus;
  onChange: (next: WorkOrderStatus) => void;
  disabled?: boolean;
}

export function StatusDropdown({ value, onChange, disabled }: StatusDropdownProps) {
  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as WorkOrderStatus)}
        disabled={disabled}
        aria-label="Work Order Status"
        className="appearance-none rounded-lg border-0 bg-white py-2.5 pl-3.5 pr-10 text-sm font-medium text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 transition disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {STATUS_VALUES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {disabled ? (
        <Loader2 className="h-4 w-4 text-slate-400 absolute right-3 animate-spin" aria-hidden />
      ) : (
        <svg
          className="pointer-events-none absolute right-3 h-4 w-4 text-slate-400"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden
        >
          <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}
