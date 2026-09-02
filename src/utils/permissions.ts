import type { UserRole } from '@/types';

export function canCompleteWorkOrder(role: UserRole | undefined | null): boolean {
  return role === 'maintenance' || role === 'supervisor' || role === 'admin';
}

export function canAssignTechnician(role: UserRole | undefined | null): boolean {
  return role === 'supervisor' || role === 'admin';
}

export function canUpdateWorkOrder(role: UserRole | undefined | null): boolean {
  return role === 'maintenance' || role === 'supervisor' || role === 'admin';
}

export function canAddWorkUpdate(role: UserRole | undefined | null): boolean {
  return role === 'maintenance' || role === 'supervisor' || role === 'admin';
}
