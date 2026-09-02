/*
# Add email notification tracking columns and email log

1. Purpose
   Supports secure server-side email notifications for work orders:
   - A "new work order" email sent to sbrmaintenance@robson.com on creation.
   - A "work order completed" email sent to the original creator when a work
     order transitions into Completed status.

   This migration adds the tracking columns and a durable email log table so
   the server-side edge function can record sends and prevent duplicates.

2. Column changes on `work_orders`
   - `new_work_order_email_sent_at` (timestamptz, nullable) — timestamp of the
     successful new-work-order email. NULL means not yet sent.
   - `completion_email_sent_at` (timestamptz, nullable) — timestamp of the
     most recent successful completion email. NULL means not yet sent.
   - `completed_at` (timestamptz, nullable) — timestamp the work order was
     last marked Completed. Cleared to NULL when reopened (status changes
     away from completed).

   These three columns are managed by the server (edge function + trigger),
   not by the browser. They are NOT included in the column-level UPDATE grant
   for authenticated users, so users cannot write them through the Data API.

3. Trigger: set_completed_at
   A BEFORE UPDATE trigger that automatically sets `completed_at = now()` when
   status transitions to 'completed', and clears it to NULL when status
   transitions away from 'completed'. This keeps completed_at in sync without
   requiring the edge function to manage it.

4. New table: email_notifications
   A durable log of every email send attempt. Used by the edge function to:
   - Record attempts and results (sent vs failed).
   - Prevent duplicate sends (idempotency via unique constraint on
     work_order_id + email_type).
   - Allow re-sending after a work order is reopened and re-completed (the
     completion row is deleted when the work order is reopened, or a new row
     with a different "occurrence" is inserted).

   Columns:
   - id (uuid PK)
   - work_order_id (uuid FK -> work_orders, ON DELETE CASCADE)
   - email_type (text: 'new_work_order' | 'completion')
   - recipient (text — the email address the server sent to)
   - status (text: 'sent' | 'failed')
   - provider_message_id (text, nullable — Resend message ID on success)
   - error_message (text, nullable — failure detail on error)
   - sent_at (timestamptz — when the record was written)
   - occurrence (int — 1 for the first completion, 2 for the second, etc.
     Only incremented for completion emails when a work order is reopened
     and re-completed. New-work-order emails always use occurrence 1.)

5. Security
   - email_notifications has RLS enabled with NO policies for anon or
     authenticated. Only the service role (used by the edge function) can
     read/write it. The browser cannot query or modify this table.
   - The three new work_orders columns are NOT granted UPDATE to
     authenticated — they are server-managed.
*/

-- ---------------------------------------------------------------
-- Column additions on work_orders
-- ---------------------------------------------------------------
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS new_work_order_email_sent_at timestamptz;
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS completion_email_sent_at timestamptz;
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- ---------------------------------------------------------------
-- Trigger function: set_completed_at
-- Sets completed_at when status -> 'completed', clears it otherwise.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_completed_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    NEW.completed_at := now();
  ELSIF NEW.status <> 'completed' AND OLD.status = 'completed' THEN
    -- Reopened: clear completed_at and completion_email_sent_at so a new
    -- completion email can be sent when it's completed again.
    NEW.completed_at := NULL;
    NEW.completion_email_sent_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION set_completed_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION set_completed_at() FROM anon;
REVOKE EXECUTE ON FUNCTION set_completed_at() FROM authenticated;

DROP TRIGGER IF EXISTS set_completed_at_trigger ON work_orders;
CREATE TRIGGER set_completed_at_trigger
  BEFORE UPDATE ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION set_completed_at();

-- ---------------------------------------------------------------
-- Email notifications log table
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS email_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  email_type text NOT NULL CHECK (email_type IN ('new_work_order', 'completion')),
  recipient text NOT NULL,
  status text NOT NULL CHECK (status IN ('sent', 'failed')),
  provider_message_id text,
  error_message text,
  occurrence int NOT NULL DEFAULT 1,
  sent_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;

-- No policies for anon or authenticated: only the service role can access.
-- The service role bypasses RLS by default.

CREATE INDEX IF NOT EXISTS email_notifications_work_order_idx
  ON email_notifications(work_order_id);
CREATE INDEX IF NOT EXISTS email_notifications_type_idx
  ON email_notifications(email_type);
CREATE UNIQUE INDEX IF NOT EXISTS email_notifications_unique_sent
  ON email_notifications(work_order_id, email_type, occurrence)
  WHERE status = 'sent';