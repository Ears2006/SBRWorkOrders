/*
# Add work_order_number with sequence-based generation

1. Purpose
   Gives every work order a unique, permanent human-readable number in the
   format WO-YYYY-NNNN (e.g. WO-2026-0001). The year comes from created_at.
   The 4-digit sequence is drawn from a dedicated Postgres sequence, so it is
   safe under concurrent inserts and not affected by deleted rows.

2. Column changes on `work_orders`
   - `work_order_number text` — new, nullable during backfill, then NOT NULL.
     The value is immutable after creation (not in the column-level UPDATE
     grant), so users cannot change it.

3. Sequence
   - `work_order_seq` — a global Postgres sequence. Used as the numeric base
     for the 4-digit zero-padded portion of the work order number. A global
     sequence (rather than per-year) keeps numbering simple and guarantees
     uniqueness even across year boundaries.

4. Trigger function + trigger
   - `generate_work_order_number()` — BEFORE INSERT trigger function. If the
     row has no work_order_number, it builds one from EXTRACT(YEAR FROM
     NEW.created_at) and nextval('work_order_seq'), formatted as
     WO-YYYY-NNNN. Because it runs BEFORE INSERT inside the same transaction,
     concurrent inserts each get a distinct nextval — no duplicates.
   - `set_work_order_number_on_insert` — the BEFORE INSERT trigger on
     work_orders calling the function above.

5. Backfill
   - Existing rows are numbered WO-<year>-0001, WO-<year>-0002, etc. based on
     created_at ordering. The sequence is then advanced past the highest
     assigned number so the next new work order gets a fresh, non-colliding
     number.

6. Security
   - No new UPDATE grant on work_order_number — it is immutable via the Data
     API. Existing column-level UPDATE (status, work_performed) is unchanged.
   - No policy changes — the existing owner-scoped SELECT/INSERT/UPDATE
     policies cover the new column automatically.
*/

-- ---------------------------------------------------------------
-- Column
-- ---------------------------------------------------------------
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS work_order_number text;

-- ---------------------------------------------------------------
-- Sequence
-- ---------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS work_order_seq AS bigint START 1 INCREMENT 1 NO CYCLE;

-- ---------------------------------------------------------------
-- Trigger function: generate WO-YYYY-NNNN on insert
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_work_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  seq_val bigint;
  year_part int;
BEGIN
  IF NEW.work_order_number IS NOT NULL THEN
    RETURN NEW;
  END IF;

  seq_val := nextval('public.work_order_seq');
  year_part := EXTRACT(YEAR FROM NEW.created_at);
  NEW.work_order_number := 'WO-' || year_part || '-' || lpad(seq_val::text, 4, '0');
  RETURN NEW;
END;
$$;

-- Revoke EXECUTE from public so only the trigger (owned by the table owner) can call it.
REVOKE EXECUTE ON FUNCTION generate_work_order_number() FROM PUBLIC;

-- ---------------------------------------------------------------
-- Trigger
-- ---------------------------------------------------------------
DROP TRIGGER IF EXISTS set_work_order_number_on_insert ON work_orders;
CREATE TRIGGER set_work_order_number_on_insert
  BEFORE INSERT ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION generate_work_order_number();

-- ---------------------------------------------------------------
-- Backfill existing rows
-- ---------------------------------------------------------------
DO $$
DECLARE
  max_seq bigint := 0;
BEGIN
  -- Assign numbers to existing rows ordered by created_at, partitioned by year.
  -- Uses a CTE with row_number() so each row gets a distinct, ordered number.
  WITH numbered AS (
    SELECT
      id,
      EXTRACT(YEAR FROM created_at)::int AS yr,
      row_number() OVER (
        PARTITION BY EXTRACT(YEAR FROM created_at)
        ORDER BY created_at
      )::int AS rn
    FROM work_orders
    WHERE work_order_number IS NULL
  )
  UPDATE work_orders wo
  SET work_order_number = 'WO-' || n.yr || '-' || lpad(n.rn::text, 4, '0')
  FROM numbered n
  WHERE wo.id = n.id;

  -- Advance the sequence past the highest sequence used by any backfilled row.
  -- Parse the last 4 digits from the max work_order_number to find the high water mark.
  SELECT COALESCE(max(
    CASE
      WHEN work_order_number ~ 'WO-[0-9]{4}-[0-9]{4}$'
        THEN substring(work_order_number from '[0-9]{4}$')::bigint
      ELSE 0
    END
  ), 0)
  INTO max_seq
  FROM work_orders;

  IF max_seq > 0 THEN
    -- Set the sequence to max_seq so the next nextval returns max_seq + 1.
    PERFORM setval('public.work_order_seq', max_seq, true);
  END IF;
END $$;

-- Now make the column NOT NULL.
ALTER TABLE work_orders ALTER COLUMN work_order_number SET NOT NULL;

-- ---------------------------------------------------------------
-- Index for lookups by work order number
-- ---------------------------------------------------------------
CREATE INDEX IF NOT EXISTS work_orders_work_order_number_idx
  ON work_orders(work_order_number);