-- Production cleanup: remove all test work orders and associated data.
-- Preserves: user accounts, auth records, profiles, roles, schema, secrets.

-- 1. Delete stored photo files from the storage bucket.
--    The protect_delete trigger checks storage.allow_delete_query; setting it
--    allows direct deletion from storage.objects for this migration only.
SET storage.allow_delete_query = 'true';
DELETE FROM storage.objects WHERE bucket_id = 'work-order-photos';

-- 2. Delete work_order_photos rows.
DELETE FROM work_order_photos;

-- 3. Delete email notification logs tied to test work orders.
DELETE FROM email_notifications;

-- 4. Delete all work orders.
DELETE FROM work_orders;

-- 5. Reset the work order sequence so the next production work order is WO-2026-0001.
ALTER SEQUENCE public.work_order_seq RESTART WITH 1;
