/*
# Add Work Order Updates (progress notes / history)

1. Purpose
   When a maintenance user changes a work order to "Waiting for Parts", they
   must document what was done, what parts are needed, ordering status, etc.
   These notes are saved as a separate chronological history — the work order's
   original Description is never overwritten.  Additional updates can be added
   at any time while the order is open, so there is a running log of progress.

2. New Table: work_order_updates
   - id           uuid PK
   - work_order_id uuid FK -> work_orders(id) ON DELETE CASCADE
   - update_text  text NOT NULL        (the progress note)
   - status       text NOT NULL        (the status associated with this update)
   - created_by_name text              (display name of the technician)
   - created_by_id   uuid              (auth user id of the technician)
   - created_at   timestamptz DEFAULT now()

3. New RPC: add_work_order_update(p_order_id, p_update_text, p_status)
   - SECURITY DEFINER, search_path = public (matches existing RPC pattern)
   - Authorizes the caller: must have role maintenance / supervisor / admin.
   - Validates that update_text is non-empty.
   - Validates that p_status is 'waiting_for_parts' or 'active' (not completed;
     completion goes through complete_work_order as before).
   - Inserts a work_order_updates row, then updates the work order status.
   - Returns the updated work_orders row (same return type as the other RPCs).
   - The status change and update insert run in a single atomic operation.

4. Security (RLS)
   - RLS enabled on work_order_updates.
   - SELECT: TO authenticated — any signed-in user can read the update history
     (they can already read the work order itself).
   - INSERT: TO authenticated WITH CHECK (auth.uid() = created_by_id) — only
     the author can create their own update row.  In practice inserts go
     through the SECURITY DEFINER RPC which sets created_by_id = auth.uid(),
     so the check always passes for legitimate callers and blocks others.
   - No UPDATE or DELETE policies — updates are immutable once written.

5. No changes to:
   - Existing work_orders table or its columns
   - work_order_photos, email_notifications, profiles, or auth
   - Existing RPCs (update_work_order_status, complete_work_order,
     assign_work_order)
   - Existing roles, permissions, or email notification flow
*/

CREATE TABLE IF NOT EXISTS public.work_order_updates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id   uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  update_text     text NOT NULL,
  status          text NOT NULL,
  created_by_name text,
  created_by_id   uuid,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_order_updates_order_time
  ON public.work_order_updates (work_order_id, created_at);

ALTER TABLE public.work_order_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_work_order_updates" ON public.work_order_updates;
CREATE POLICY "select_work_order_updates"
  ON public.work_order_updates FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_work_order_update" ON public.work_order_updates;
CREATE POLICY "insert_own_work_order_update"
  ON public.work_order_updates FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = created_by_id);

-- Revoke privileges from anon and public; only authenticated may use it.
REVOKE ALL ON public.work_order_updates FROM anon, public;
GRANT SELECT ON public.work_order_updates TO authenticated;

CREATE OR REPLACE FUNCTION public.add_work_order_update(
  p_order_id   uuid,
  p_update_text text,
  p_status     text
)
RETURNS public.work_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_role      text;
  v_profile   public.profiles%ROWTYPE;
  v_row       public.work_orders%ROWTYPE;
BEGIN
  -- Authorize: only maintenance / supervisor / admin may add work updates.
  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to add a work update.'
      USING ERRCODE = '42501';
  END IF;
  IF v_profile.role NOT IN ('maintenance', 'supervisor', 'admin') THEN
    RAISE EXCEPTION 'You do not have permission to add work updates.'
      USING ERRCODE = '42501';
  END IF;

  -- Validate inputs.
  IF COALESCE(TRIM(p_update_text), '') = '' THEN
    RAISE EXCEPTION 'A work update note is required before changing the status.'
      USING ERRCODE = '23502';
  END IF;
  IF p_status NOT IN ('active', 'waiting_for_parts') THEN
    RAISE EXCEPTION 'Work updates can only be added for Active or Waiting for Parts statuses.'
      USING ERRCODE = '22023';
  END IF;

  -- Verify the work order exists and is not completed.
  SELECT * INTO v_row FROM public.work_orders WHERE id = p_order_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Work order not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_row.status = 'completed' THEN
    RAISE EXCEPTION 'Cannot add updates to a completed work order.'
      USING ERRCODE = '22023';
  END IF;

  -- Insert the progress update.
  INSERT INTO public.work_order_updates (work_order_id, update_text, status, created_by_name, created_by_id)
  VALUES (p_order_id, TRIM(p_update_text), p_status, v_profile.full_name, auth.uid());

  -- Update the work order status.
  UPDATE public.work_orders
    SET status = p_status
    WHERE id = p_order_id
    RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

-- Allow authenticated users to call the RPC.
REVOKE ALL ON FUNCTION public.add_work_order_update(uuid, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.add_work_order_update(uuid, text, text) TO authenticated;
