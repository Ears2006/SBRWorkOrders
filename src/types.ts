export type WorkOrderStatus = 'active' | 'waiting_for_parts' | 'completed';

export type UserRole = 'employee' | 'maintenance' | 'supervisor' | 'admin';

export const ROLE_LABELS: Record<UserRole, string> = {
  employee: 'Employee',
  maintenance: 'Maintenance',
  supervisor: 'Supervisor',
  admin: 'Admin',
};

export const TECHNICIANS: string[] = ['Adam', 'Orlando', 'Marco', 'EJ', 'Dillon'];

export const STATUS_VALUES: WorkOrderStatus[] = [
  'active',
  'waiting_for_parts',
  'completed',
];

export const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  active: 'Active',
  waiting_for_parts: 'Waiting for Parts',
  completed: 'Completed',
};

// Numeric weight used for status sorting and default ordering.
// Lower weight sorts first: active(0) -> waiting(1) -> completed(2).
export const STATUS_ORDER: Record<WorkOrderStatus, number> = {
  active: 0,
  waiting_for_parts: 1,
  completed: 2,
};

export interface WorkOrder {
  id: string;
  work_order_number: string;
  location: string;
  subject: string;
  description: string;
  status: WorkOrderStatus;
  user_id: string;
  created_by: string;
  created_by_email: string;
  created_by_id: string;
  created_by_name: string;
  requester_name: string;
  assigned_to: string | null;
  completed_by_technician: string | null;
  work_performed: string | null;
  new_work_order_email_sent_at: string | null;
  completion_email_sent_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type WorkOrderSortColumn = 'description' | 'status' | 'assignedTo' | 'createdBy' | 'dateCreated';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  column: WorkOrderSortColumn | null;
  direction: SortDirection;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
}

export interface WorkOrderFormData {
  location: string;
  subject: string;
  description: string;
  requesterName: string;
}

export interface WorkOrderFormErrors {
  location?: string;
  subject?: string;
  description?: string;
  requesterName?: string;
}

export interface WorkOrderPhoto {
  id: string;
  work_order_id: string;
  uploaded_by_id: string;
  storage_path: string;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

export interface WorkOrderUpdate {
  id: string;
  work_order_id: string;
  update_text: string;
  status: WorkOrderStatus;
  created_by_name: string | null;
  created_by_id: string | null;
  created_at: string;
}

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  message: string;
  variant: ToastVariant;
}
