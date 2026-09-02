import { ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react';
import type { SortDirection } from '@/types';

interface SortIconProps {
  active: boolean;
  direction: SortDirection;
}

export function SortIcon({ active, direction }: SortIconProps) {
  if (!active) {
    return <ChevronsUpDown className="h-3.5 w-3.5 text-slate-300" aria-hidden />;
  }
  return direction === 'asc' ? (
    <ArrowUp className="h-3.5 w-3.5 text-blue-600" aria-hidden />
  ) : (
    <ArrowDown className="h-3.5 w-3.5 text-blue-600" aria-hidden />
  );
}
