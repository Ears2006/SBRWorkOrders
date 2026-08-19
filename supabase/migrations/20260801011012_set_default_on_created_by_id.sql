/*
# Set default on created_by_id

The `created_by_id` column was added as NOT NULL without a default, so inserts
that omit it fail with a 400. This sets it to `DEFAULT auth.uid()` — the same
pattern used by the existing `user_id` column — so it auto-fills from the
authenticated session.

1. Column changes on `work_orders`
   - `created_by_id`: add `DEFAULT auth.uid()`

2. No data changes — existing rows already have valid values.
*/

ALTER TABLE work_orders
  ALTER COLUMN created_by_id SET DEFAULT auth.uid();