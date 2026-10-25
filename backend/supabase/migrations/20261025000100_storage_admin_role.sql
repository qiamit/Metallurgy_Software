-- storage-api must connect as its own login role whose default search_path is `storage`
-- (it queries `buckets`, `objects` unqualified and switches to anon / authenticated / service_role
-- per request). Same layout as a standard Supabase install.
--
-- Run after storage-api has created the `storage` schema, then set a password and point
-- storage-api's DATABASE_URL at this role:
--   ALTER ROLE supabase_storage_admin WITH PASSWORD '<strong password>';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    CREATE ROLE supabase_storage_admin LOGIN NOINHERIT CREATEROLE;
  END IF;
END
$$;

GRANT anon, authenticated, service_role TO supabase_storage_admin;
ALTER ROLE supabase_storage_admin SET search_path = storage;

-- Own the storage schema so future storage-api upgrades can run their own migrations.
ALTER SCHEMA storage OWNER TO supabase_storage_admin;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT c.relname, c.relkind FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'storage' AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
  LOOP
    IF r.relkind = 'S' THEN
      EXECUTE format('ALTER SEQUENCE storage.%I OWNER TO supabase_storage_admin', r.relname);
    ELSIF r.relkind IN ('v') THEN
      EXECUTE format('ALTER VIEW storage.%I OWNER TO supabase_storage_admin', r.relname);
    ELSIF r.relkind IN ('m') THEN
      EXECUTE format('ALTER MATERIALIZED VIEW storage.%I OWNER TO supabase_storage_admin', r.relname);
    ELSE
      EXECUTE format('ALTER TABLE storage.%I OWNER TO supabase_storage_admin', r.relname);
    END IF;
  END LOOP;

  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
           JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'storage'
  LOOP
    EXECUTE format('ALTER ROUTINE %s OWNER TO supabase_storage_admin', r.sig);
  END LOOP;
END
$$;

-- The storage RLS policies call our lab-role helpers.
GRANT USAGE ON SCHEMA public TO supabase_storage_admin;
GRANT EXECUTE ON FUNCTION public.app_has_org_role(uuid, public.org_role) TO supabase_storage_admin;
GRANT EXECUTE ON FUNCTION public.app_try_uuid(text) TO supabase_storage_admin;

NOTIFY pgrst, 'reload schema';
