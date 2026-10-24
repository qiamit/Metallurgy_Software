-- storage-api runs each request as anon / authenticated / service_role. A fresh Railway Postgres
-- (unlike a Supabase-managed one) has no grants for those roles on the `storage` schema, and
-- Postgres silently skips search_path schemas a role cannot use ("relation buckets does not exist").
-- Access is still limited by RLS: metallurgy_objects_* policies on objects, and the bucket policy below.

GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;

GRANT ALL ON TABLE storage.buckets, storage.objects TO anon, authenticated, service_role;

DO $$
DECLARE t text;
BEGIN
  -- Present in newer storage-api versions only.
  FOREACH t IN ARRAY ARRAY['prefixes', 's3_multipart_uploads', 's3_multipart_uploads_parts'] LOOP
    IF to_regclass('storage.' || t) IS NOT NULL THEN
      EXECUTE format('GRANT ALL ON TABLE storage.%I TO anon, authenticated, service_role', t);
    END IF;
  END LOOP;
END
$$;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA storage TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA storage TO anon, authenticated, service_role;

-- Tables storage-api adds in future upgrades get the same grants.
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_storage_admin IN SCHEMA storage
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_storage_admin IN SCHEMA storage
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_storage_admin IN SCHEMA storage
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

-- Signed-in users may read our bucket definitions (size / MIME limits); nothing else.
DROP POLICY IF EXISTS metallurgy_buckets_select ON storage.buckets;
CREATE POLICY metallurgy_buckets_select ON storage.buckets FOR SELECT TO authenticated
  USING (id IN ('job-images', 'job-overlays', 'lab-branding', 'ring-test-images'));

NOTIFY pgrst, 'reload schema';
