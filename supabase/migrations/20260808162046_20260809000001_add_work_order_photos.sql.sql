-- Add work order photo attachments table and storage bucket
--
-- 1. Overview
--    Adds support for optional photo attachments on work orders. Employees
--    can attach multiple photos when creating a work order so maintenance
--    can visually see what is broken and where the problem is.
--
-- 2. New table: work_order_photos
--    - id (uuid PK)
--    - work_order_id (uuid FK -> work_orders, ON DELETE CASCADE)
--    - uploaded_by_id (uuid FK -> auth.users, default auth.uid())
--    - storage_path (text NOT NULL) - path inside the storage bucket
--    - file_name (text) - original file name for display
--    - file_size (bigint) - bytes
--    - mime_type (text) - e.g. image/jpeg
--    - created_at (timestamptz, default now())
--
-- 3. Security - work_order_photos RLS
--    Internal employee system; all authenticated employees see all photos.
--    - SELECT: any authenticated employee can view all photos.
--    - INSERT: any authenticated employee can add photos.
--    - DELETE: uploader or maintenance/supervisor/admin can remove.
--
-- 4. Storage bucket: work-order-photos
--    - Private bucket; files accessed via signed URLs.
--    - Storage RLS: authenticated can read, insert, delete objects.
--    - MIME and size limits enforced client-side (image only, max 10MB).
--
-- 5. Indexes
--    - work_order_photos_work_order_id_idx for fast lookup by order.
--
-- 6. No existing data is affected. Existing work orders simply have no
--    photos, and the Photos section will not render for them.

CREATE TABLE IF NOT EXISTS work_order_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  uploaded_by_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  file_name text,
  file_size bigint,
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE work_order_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_all_work_order_photos" ON work_order_photos;
CREATE POLICY "select_all_work_order_photos" ON work_order_photos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_work_order_photos" ON work_order_photos;
CREATE POLICY "insert_work_order_photos" ON work_order_photos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by_id);

DROP POLICY IF EXISTS "delete_work_order_photos" ON work_order_photos;
CREATE POLICY "delete_work_order_photos" ON work_order_photos
  FOR DELETE TO authenticated USING (
    auth.uid() = uploaded_by_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('maintenance', 'supervisor', 'admin')
    )
  );

CREATE INDEX IF NOT EXISTS work_order_photos_work_order_id_idx
  ON work_order_photos(work_order_id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('work-order-photos', 'work-order-photos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "read_work_order_photos" ON storage.objects;
CREATE POLICY "read_work_order_photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'work-order-photos');

DROP POLICY IF EXISTS "insert_work_order_photos_obj" ON storage.objects;
CREATE POLICY "insert_work_order_photos_obj" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'work-order-photos');

DROP POLICY IF EXISTS "delete_work_order_photos_obj" ON storage.objects;
CREATE POLICY "delete_work_order_photos_obj" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'work-order-photos');
