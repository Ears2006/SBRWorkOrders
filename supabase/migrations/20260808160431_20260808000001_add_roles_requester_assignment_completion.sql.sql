/*
# Add roles, requester name, technician assignment, and completion tracking

1. Overview
   Extends the existing SBR Work Orders system to support:
   - Role-based permissions (employee, maintenance, supervisor, admin) stored
     server-side on profiles.
   - A required "Requester Name" — the actual employee submitting the work
     order while logged into a shared department account.
   - An "Assigned To" technician field, settable by supervisors.
   - Structured completion: a "Technician Who Completed Work" dropdown plus
     the existing Work Performed notes and a completion timestamp.
   - Shared department accounts: all authenticated employees can see and
     manage all work orders (internal system), gated by role for completion
     and assignment.

2. Existing data preservation
   - No rows are dropped. New columns are nullable or have safe defaults.
   - Existing work orders get requester_name backfilled from created_by_name,
     assigned_to/completed_by_technician set to NULL, role set to 'employee'.

3. Column changes on `profiles`
   - `role text NOT NULL DEFAULT 'employee'` — one of:
     'employee', 'maintenance', 'supervisor', 'admin'.
   - A CHECK constraint enforces valid values.

4. Column changes on `work_orders`
   - `requester_name text` — the actual employee submitting the work order.
     Nullable for backfill; backfilled from created_by_name then NOT NULL.
   - `assigned_to text` — the maintenance technician assigned to the order.
     Nullable (unassigned is allowed).
   - `completed_by_technician text` — the technician who completed the work.
     Nullable (set only on completion).
   - `completed_at` already exists (timestamptz, nullable) from a prior
     migration and is managed by the set_completed_at trigger.

5. Security changes — shared internal system
   This is an INTERNAL employee work-order system. All authenticated
   employees can see ALL work orders (not just their own), so the SELECT
   policy is broadened to `TO authenticated USING (true)`.
   - SELECT: any authenticated employee can view all work orders.
   - INSERT: any authenticated employee can create work orders
     (user_id defaults to auth.uid()).
   - UPDATE: revoked from authenticated at table level. Completion and
     assignment are performed exclusively through SECURITY DEFINER
     functions that enforce role checks server-side. This prevents clients
     from directly writing status/assigned_to/completed_by_technician via
     the Data API except through the authorized RPCs.
   - work_performed can no longer be edited directly by clients; it is
     written by the complete_work_order RPC.

6. SECURITY DEFINER functions (server-enforced authorization)
   a) `complete_work_order(p_order_id uuid, p_work_performed text,
      p_technician text)` — marks a work order Completed, sets work_performed,
      completed_by_technician, and completed_at (via the existing trigger).
      Only callers whose profile role is maintenance/supervisor/admin may
      call it. Validates that work_performed and technician are non-empty.
      Returns the updated row.
   b) `assign_work_order(p_order_id uuid, p_technician text)` — sets
      assigned_to. Only supervisor/admin may call it. Allows NULL to
      unassign. Returns the updated row.
   Both functions are SECURITY DEFINER, search_path = public, with EXECUTE
   revoked from public/anon and granted only to authenticated.

7. Role seeding for known department accounts
   - sbrmaintenance@robson.com  -> maintenance
   - adam.mancha@robson.com     -> supervisor
   These are applied via UPDATE on profiles where the email matches, so
   existing accounts receive the correct role. New accounts default to
   'employee' unless manually promoted.
*/

-- ---------------------------------------------------------------
-- profiles: add role column
-- ---------------------------------------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'employee';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'profiles'::regclass AND conname = 'profiles_role_check'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_role_check
      CHECK (role IN ('employee', 'maintenance', 'supervisor', 'admin'));
  END IF;
END $$;

-- Grant UPDATE on role column? No — roles are managed via service role or
-- SQL only. Keep role out of client-writable columns. authenticated already
-- has table-level UPDATE on profiles; revoke and grant only safe columns.
REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (full_name) ON profiles TO authenticated;

-- ---------------------------------------------------------------
-- work_orders: new columns
-- ---------------------------------------------------------------
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS requester_name text;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS assigned_to text;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS completed_by_technician text;

-- Backfill requester_name from created_by_name for existing rows.
UPDATE work_orders
SET requester_name = created_by_name
WHERE requester_name IS NULL;

-- Now make requester_name NOT NULL (existing rows are backfilled).
ALTER TABLE work_orders ALTER COLUMN requester_name SET NOT NULL;

-- ---------------------------------------------------------------
-- work_orders: RLS policies — shared internal system
-- ---------------------------------------------------------------
-- SELECT: any authenticated employee can see all work orders.
DROP POLICY IF EXISTS "select_own_work_orders" ON work_orders;
CREATE POLICY "select_all_work_orders" ON work_orders FOR SELECT
  TO authenticated USING (true);

-- INSERT: any authenticated employee can create work orders.
DROP POLICY IF EXISTS "insert_own_work_orders" ON work_orders;
CREATE POLICY "insert_work_orders" ON work_orders FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- UPDATE: remove direct client UPDATE entirely. Completion and assignment
-- go through SECURITY DEFINER functions that enforce roles server-side.
DROP POLICY IF EXISTS "update_own_work_orders" ON work_orders;
REVOKE UPDATE ON work_orders FROM authenticated;

-- ---------------------------------------------------------------
-- SECURITY DEFINER function: complete_work_order
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_work_order(
  p_order_id uuid,
  p_work_performed text,
  p_technician text
)
RETURNS work_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_row work_orders;
BEGIN
  -- Authorize: only maintenance/supervisor/admin may complete.
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to complete a work order.'
      USING ERRCODE = '42501';
  END IF;
  IF v_role NOT IN ('maintenance', 'supervisor', 'admin') THEN
    RAISE EXCEPTION 'You do not have permission to complete work orders.'
      USING ERRCODE = '42501';
  END IF;

  -- Validate inputs.
  IF COALESCE(TRIM(p_work_performed), '') = '' THEN
    RAISE EXCEPTION 'Work Performed is required before completing.'
      USING ERRCODE = '23502';
  END IF;
  IF COALESCE(TRIM(p_technician), '') = '' THEN
    RAISE EXCEPTION 'Technician Who Completed Work is required.'
      USING ERRCODE = '23502';
  END IF;

  UPDATE public.work_orders
    SET status = 'completed',
        work_performed = TRIM(p_work_performed),
        completed_by_technician = TRIM(p_technician)
    WHERE id = p_order_id
    RETURNING * INTO v_row;

  IF v_row IS NULL THEN
    RAISE EXCEPTION 'Work order not found.' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_work_order(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.complete_work_order(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.complete_work_order(uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------
-- SECURITY DEFINER function: assign_work_order
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_work_order(
  p_order_id uuid,
  p_technician text
)
RETURNS work_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_row work_orders;
BEGIN
  -- Authorize: only supervisor/admin may assign.
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to assign a work order.'
      USING ERRCODE = '42501';
  END IF;
  IF v_role NOT IN ('supervisor', 'admin') THEN
    RAISE EXCEPTION 'Only supervisors and admins can assign technicians.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.work_orders
    SET assigned_to = NULLIF(TRIM(p_technician), '')
    WHERE id = p_order_id
    RETURNING * INTO v_row;

  IF v_row IS NULL THEN
    RAISE EXCEPTION 'Work order not found.' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.assign_work_order(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_work_order(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.assign_work_order(uuid, text) TO authenticated;

-- ---------------------------------------------------------------
-- Indexes for new columns
-- ---------------------------------------------------------------
CREATE INDEX IF NOT EXISTS work_orders_assigned_to_idx ON work_orders(assigned_to);
CREATE INDEX IF NOT EXISTS work_orders_requester_name_idx ON work_orders(requester_name);

-- ---------------------------------------------------------------
-- Seed roles for known department accounts
-- ---------------------------------------------------------------
UPDATE profiles SET role = 'maintenance'
  WHERE email = 'sbrmaintenance@robson.com' AND role = 'employee';

UPDATE profiles SET role = 'supervisor'
  WHERE email = 'adam.mancha@robson.com' AND role = 'employee';
