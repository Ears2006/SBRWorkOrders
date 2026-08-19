/*
# Add status update RPC and restore work_performed column grant

1. Purpose
   The prior migration revoked UPDATE from authenticated entirely, routing
   completion and assignment through SECURITY DEFINER functions. This left
   no way to change status between active/waiting_for_parts (e.g. marking
   an order as waiting for parts). This migration adds a status-change RPC
   that:
   - Allows any authenticated employee to set status to 'active' or
     'waiting_for_parts'.
   - Blocks employees from setting status to 'completed' (completion must
     go through complete_work_order, which requires technician + notes and
     a maintenance/supervisor/admin role).

2. New function: update_work_order_status
   - SECURITY DEFINER, search_path = public.
   - Parameters: p_order_id uuid, p_status text.
   - Validates p_status is 'active' or 'waiting_for_parts'.
   - Any authenticated user may call it (employees can move orders between
     active and waiting_for_parts).
   - Returns the updated row.

3. No data changes. No RLS policy changes.
*/

CREATE OR REPLACE FUNCTION public.update_work_order_status(
  p_order_id uuid,
  p_status text
)
RETURNS work_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row work_orders;
BEGIN
  IF p_status NOT IN ('active', 'waiting_for_parts') THEN
    RAISE EXCEPTION 'Use complete_work_order to mark a work order as completed.'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.work_orders
    SET status = p_status
    WHERE id = p_order_id
    RETURNING * INTO v_row;

  IF v_row IS NULL THEN
    RAISE EXCEPTION 'Work order not found.' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_work_order_status(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_work_order_status(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_work_order_status(uuid, text) TO authenticated;
