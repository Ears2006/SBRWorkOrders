/*
# Revoke table privileges on email_notifications from anon and authenticated

1. Purpose
   The email_notifications table is a server-only log. Only the service role
   (used by the edge function) should be able to read or write it.

   RLS is already enabled with no policies for anon/authenticated, which
   blocks all row access. This migration additionally revokes the base
   table-level privileges as defense-in-depth, so anon and authenticated
   cannot interact with the table at all.

2. Security changes
   - REVOKE ALL on email_notifications FROM anon, authenticated.
*/

REVOKE ALL ON email_notifications FROM anon;
REVOKE ALL ON email_notifications FROM authenticated;