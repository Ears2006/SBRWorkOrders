/*
# Revoke EXECUTE on trigger functions

1. Purpose
   The `generate_work_order_number()` and `set_updated_at()` functions are
   trigger functions — they should only be invoked by their respective
   triggers, never directly via the REST API or by any role.

2. Security changes
   - Revoke EXECUTE on both functions from PUBLIC, anon, and authenticated.
   - The functions remain callable by the table owner (the postgres/superuser
     role that owns the table and trigger), which is all that's needed for the
     triggers to work.
*/

REVOKE EXECUTE ON FUNCTION generate_work_order_number() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION generate_work_order_number() FROM anon;
REVOKE EXECUTE ON FUNCTION generate_work_order_number() FROM authenticated;

REVOKE EXECUTE ON FUNCTION set_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION set_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION set_updated_at() FROM authenticated;