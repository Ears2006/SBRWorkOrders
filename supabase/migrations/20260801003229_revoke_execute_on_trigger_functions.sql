/*
# Revoke public EXECUTE on trigger helper functions

1. Security Change
   The functions `handle_new_user()` and `set_updated_at()` are SECURITY DEFINER
   trigger helpers. They are only meant to run as table triggers (AFTER INSERT
   on auth.users / BEFORE UPDATE on work_orders), never via the REST/RPC API.
   By default PostgreSQL grants EXECUTE to PUBLIC, which means the anon and
   authenticated roles can invoke them at `/rest/v1/rpc/<name>`.

   This migration revokes EXECUTE from PUBLIC and from the anon + authenticated
   roles, so the functions can no longer be called through the Data API. They
   continue to work as triggers because triggers run with the function's own
   privileges (SECURITY DEFINER), independent of role EXECUTE grants.

2. Tables / Columns
   None changed.

3. Important Notes
   - No data is altered.
   - Trigger behavior is unaffected.
*/

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;