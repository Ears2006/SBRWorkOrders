/*
# Add work_performed column to work_orders

1. Adds a nullable `work_performed text` column (empty by default).
2. Grants UPDATE on the new column to `authenticated` so any authorized
   technician can edit and save it at any time, alongside the existing
   status-only column grant.

No data changes. Existing rows get NULL, which the app treats as empty.
*/

ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS work_performed text;

GRANT UPDATE (status, work_performed) ON work_orders TO authenticated;