-- Private buckets. Every object path starts with the lab id: "<organization_id>/<file>".
-- Requires the storage-api service to have created the `storage` schema.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('job-images', 'job-images', false, 26214400, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/tiff', 'image/bmp']),
  ('job-overlays', 'job-overlays', false, 26214400, ARRAY['image/png', 'image/jpeg']),
  ('lab-branding', 'lab-branding', false, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
  ('ring-test-images', 'ring-test-images', false, 26214400, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Read: anyone in the lab. Overlays are written only by the functions service.
DROP POLICY IF EXISTS metallurgy_objects_select ON storage.objects;
CREATE POLICY metallurgy_objects_select ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id IN ('job-images', 'job-overlays', 'lab-branding', 'ring-test-images')
    AND public.app_has_org_role(public.app_try_uuid((storage.foldername(name))[1]), 'viewer')
  );

DROP POLICY IF EXISTS metallurgy_objects_insert ON storage.objects;
CREATE POLICY metallurgy_objects_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    (bucket_id IN ('job-images', 'ring-test-images')
      AND public.app_has_org_role(public.app_try_uuid((storage.foldername(name))[1]), 'analyst'))
    OR (bucket_id = 'lab-branding'
      AND public.app_has_org_role(public.app_try_uuid((storage.foldername(name))[1]), 'admin'))
  );

DROP POLICY IF EXISTS metallurgy_objects_update ON storage.objects;
CREATE POLICY metallurgy_objects_update ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'lab-branding'
    AND public.app_has_org_role(public.app_try_uuid((storage.foldername(name))[1]), 'admin')
  );

DROP POLICY IF EXISTS metallurgy_objects_delete ON storage.objects;
CREATE POLICY metallurgy_objects_delete ON storage.objects FOR DELETE TO authenticated
  USING (
    (bucket_id IN ('job-images', 'job-overlays', 'ring-test-images')
      AND public.app_has_org_role(public.app_try_uuid((storage.foldername(name))[1]), 'analyst'))
    OR (bucket_id = 'lab-branding'
      AND public.app_has_org_role(public.app_try_uuid((storage.foldername(name))[1]), 'admin'))
  );

NOTIFY pgrst, 'reload schema';
