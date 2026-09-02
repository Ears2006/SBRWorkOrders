/*
# Extend work_orders schema and tighten column security

1. Overview
   Extends the existing work_orders table to add a proper `created_by_id`
   foreign key (referencing auth.users) plus a denormalized `created_by_name`
   column for fast display, while preserving the existing `created_by` and
   `created_by_email` columns and all existing rows. Also tightens security so
   only the `status` column is client-writable via the Data API, removes the
   DELETE policy (no deletes in v1), and adds a subject index.

2. Existing data preservation
   - The existing 1 work_order row is preserved. New columns are nullable
     during the ALTER, then backfilled from `user_id` and `created_by`, then
     set NOT NULL. No rows are dropped.

3. Column changes on `work_orders`
   - `created_by_id uuid` — new, FK to auth.users(id) ON DELETE CASCADE.
     Backfilled from existing `user_id`, then NOT NULL.
   - `created_by_name text` — new, denormalized creator full name.
     Backfilled from existing `created_by`, then NOT NULL.

4. Indexes
   - `work_orders_subject_idx` on `work_orders(subject)` (new — supports
     sorting/searching by subject).

5. Security changes
   a) Column-level UPDATE: revoke table-level UPDATE from authenticated, then
      grant UPDATE ONLY (status) — creation fields (subject, location,
      description, created_by*, user_id, created_at, updated_at) can no longer
      be modified by the client. The existing `update_own_work_orders` policy
      still gates which rows may be touched.
   b) Remove DELETE policy — users cannot directly delete work orders in v1.
      The table-level DELETE grant from `authenticated` is also revoked.
   c) profiles.email unique constraint added (required by spec).

6. Trigger
   - The existing `set_updated_at` BEFORE UPDATE trigger continues to refresh
     `updated_at` automatically. No change needed.
*/

-- ---------------------------------------------------------------
-- Backfill-safe column additions
-- ---------------------------------------------------------------
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS created_by_id uuid;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS created_by_name text;

-- Backfill from existing columns so current rows are valid.
UPDATE work_orders
SET created_by_id = user_id,
    created_by_name = created_by
WHERE created_by_id IS NULL OR created_by_name IS NULL;

-- Now make them required and add the foreign key.
ALTER TABLE work_orders
  ALTER COLUMN created_by_id SET NOT NULL,
  ALTER COLUMN created_by_name SET NOT NULL;

-- Add FK; use IF NOT EXISTS pattern via DO block.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'work_orders_created_by_id_fkey'
  ) THEN
    ALTER TABLE work_orders
      ADD CONSTRAINT work_orders_created_by_id_fkey
      FOREIGN KEY (created_by_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------
-- profiles: unique email
-- ---------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'profiles'::regclass AND conname = 'profiles_email_key'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_email_key UNIQUE (email);
  END IF;
END $$;

-- ---------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------
CREATE INDEX IF NOT EXISTS work_orders_subject_idx ON work_orders(subject);

-- ---------------------------------------------------------------
-- Column-level UPDATE: only status is client-writable
-- ---------------------------------------------------------------
REVOKE UPDATE ON work_orders FROM authenticated;
GRANT UPDATE (status) ON work_orders TO authenticated;

-- ---------------------------------------------------------------
-- Remove DELETE: users cannot delete work orders in v1
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "delete_own_work_orders" ON work_orders;
REVOKE DELETE ON work_orders FROM authenticated;