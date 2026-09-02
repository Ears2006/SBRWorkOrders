import { supabase } from '@/lib/supabase';
import type { WorkOrder, WorkOrderStatus, WorkOrderUpdate } from '@/types';

export async function fetchWorkOrders(): Promise<WorkOrder[]> {
  const { data, error } = await supabase
    .from('work_orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as WorkOrder[];
}

export async function fetchWorkOrderById(id: string): Promise<WorkOrder | null> {
  const { data, error } = await supabase
    .from('work_orders')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data as WorkOrder | null;
}

export interface CreateWorkOrderInput {
  location: string;
  subject: string;
  description: string;
  requesterName: string;
  createdByName: string;
  createdByEmail: string;
}

export async function createWorkOrder(input: CreateWorkOrderInput): Promise<WorkOrder> {
  const payload = {
    location: input.location,
    subject: input.subject,
    description: input.description,
    status: 'active' as WorkOrderStatus,
    requester_name: input.requesterName,
    created_by: input.createdByName,
    created_by_name: input.createdByName,
    created_by_email: input.createdByEmail,
  };
  const { data, error } = await supabase
    .from('work_orders')
    .insert(payload)
    .select()
    .maybeSingle();

  if (error) {
    console.error('createWorkOrder failed:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    throw error;
  }
  if (!data) throw new Error('Unable to create the work order. Please try again.');
  return data as WorkOrder;
}

/**
 * Marks a work order as completed with the required technician and work
 * performed notes. Enforced server-side via a SECURITY DEFINER function —
 * only maintenance/supervisor/admin roles may call it.
 */
export async function completeWorkOrder(
  id: string,
  workPerformed: string,
  technician: string,
): Promise<WorkOrder> {
  const { data, error } = await supabase
    .rpc('complete_work_order', {
      p_order_id: id,
      p_work_performed: workPerformed,
      p_technician: technician,
    })
    .maybeSingle();

  if (error) {
    console.error('completeWorkOrder failed:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    throw error;
  }
  if (!data) throw new Error('Unable to complete the work order.');
  return data as WorkOrder;
}

/**
 * Assigns a technician to a work order. Enforced server-side via a
 * SECURITY DEFINER function — only supervisor/admin roles may call it.
 * Pass null or empty string to unassign.
 */
export async function assignWorkOrder(id: string, technician: string | null): Promise<WorkOrder> {
  const { data, error } = await supabase
    .rpc('assign_work_order', {
      p_order_id: id,
      p_technician: technician ?? '',
    })
    .maybeSingle();

  if (error) {
    console.error('assignWorkOrder failed:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    throw error;
  }
  if (!data) throw new Error('Unable to assign the work order.');
  return data as WorkOrder;
}

/**
 * Adds a progress update to a work order and changes its status in one atomic
 * operation. Enforced server-side via a SECURITY DEFINER function — only
 * maintenance/supervisor/admin roles may call it. The update text is required.
 */
export async function addWorkOrderUpdate(
  id: string,
  updateText: string,
  status: WorkOrderStatus,
): Promise<WorkOrder> {
  const { data, error } = await supabase
    .rpc('add_work_order_update', {
      p_order_id: id,
      p_update_text: updateText,
      p_status: status,
    })
    .maybeSingle();

  if (error) {
    console.error('addWorkOrderUpdate failed:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    throw error;
  }
  if (!data) throw new Error('Unable to add the work update.');
  return data as WorkOrder;
}

export async function fetchWorkOrderUpdates(workOrderId: string): Promise<WorkOrderUpdate[]> {
  const { data, error } = await supabase
    .from('work_order_updates')
    .select('*')
    .eq('work_order_id', workOrderId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as WorkOrderUpdate[];
}

/**
 * Changes work order status (non-completed transitions only). Completed
 * transitions must go through completeWorkOrder which requires the
 * technician and work performed fields. Uses a SECURITY DEFINER RPC.
 */
export async function updateWorkOrderStatus(id: string, status: WorkOrderStatus): Promise<WorkOrder> {
  if (status === 'completed') {
    throw new Error('Use completeWorkOrder to mark a work order as completed.');
  }

  const { data, error } = await supabase
    .rpc('update_work_order_status', {
      p_order_id: id,
      p_status: status,
    })
    .maybeSingle();

  if (error) {
    console.error('updateWorkOrderStatus failed:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
    throw error;
  }
  if (!data) throw new Error('Unable to update the work order status.');
  return data as WorkOrder;
}
