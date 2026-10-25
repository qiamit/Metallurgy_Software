-- Security hardening (idempotent: safe to run more than once).
--
-- 1. Every SECURITY DEFINER function in public pins search_path = public, pg_temp
--    (several used `SET search_path TO 'public'`, which still searches pg_temp first for tables).
-- 2. Trigger-only functions cannot be called through PostgREST; anon executes nothing in public.
-- 3. audit_log is append-only: no role can UPDATE / DELETE / TRUNCATE it, and a trigger refuses
--    it even for roles that still hold the privilege. Inserts happen only in write_audit_log()
--    (SECURITY DEFINER, runs as the table owner).
-- 4. Value limits the browser can write directly (AI model id, key length, lab name).
-- 5. Bucket definitions are written only by migrations / service role.

-- ---------------------------------------------------------------------------
-- 1. search_path on SECURITY DEFINER functions (and the two plain helpers)
-- ---------------------------------------------------------------------------
DO $$
DECLARE f regprocedure;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (p.prosecdef OR p.proname IN ('set_updated_at', 'app_try_uuid', 'org_dashboard_stats'))
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', f);
  END LOOP;
END
$$;

-- ---------------------------------------------------------------------------
-- 2. Function privileges
-- ---------------------------------------------------------------------------
-- Trigger functions: nobody needs EXECUTE (triggers fire regardless of the caller's privileges).
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_organization() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_org_name_from_lab_settings() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.write_audit_log() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- The anonymous role calls nothing in public (lab sign-up goes through functions /register).
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;

-- No one but the owner creates objects in public (default since Postgres 15; explicit here).
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 3. Append-only audit log
-- ---------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.audit_log FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.audit_log TO service_role;

CREATE OR REPLACE FUNCTION public.audit_log_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Retention / restore work: the table owner runs
  --   ALTER TABLE public.audit_log DISABLE TRIGGER audit_log_no_update_delete; (and _no_truncate)
  -- inside a transaction, then enables them again.
  RAISE EXCEPTION 'audit_log is append-only (% refused)', TG_OP USING ERRCODE = '42501';
END;
$$;
REVOKE ALL ON FUNCTION public.audit_log_immutable() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS audit_log_no_update_delete ON public.audit_log;
CREATE TRIGGER audit_log_no_update_delete
  BEFORE UPDATE OR DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_immutable();

DROP TRIGGER IF EXISTS audit_log_no_truncate ON public.audit_log;
CREATE TRIGGER audit_log_no_truncate
  BEFORE TRUNCATE ON public.audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.audit_log_immutable();

-- ---------------------------------------------------------------------------
-- 4. Limits on browser-writable values (NOT VALID: existing rows are not re-checked,
--    every new insert / update is)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_settings_model_format') THEN
    -- Same rule as MODEL_RE in backend/functions/lib/ai.mjs (the model id is sent in the request body).
    ALTER TABLE public.ai_settings ADD CONSTRAINT ai_settings_model_format
      CHECK (model ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$') NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_settings_api_key_length') THEN
    ALTER TABLE public.ai_settings ADD CONSTRAINT ai_settings_api_key_length
      CHECK (api_key IS NULL OR char_length(api_key) <= 512) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organizations_name_length') THEN
    ALTER TABLE public.organizations ADD CONSTRAINT organizations_name_length
      CHECK (char_length(name) BETWEEN 1 AND 200) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organizations_accent_format') THEN
    ALTER TABLE public.organizations ADD CONSTRAINT organizations_accent_format
      CHECK (accent ~ '^#[0-9A-Fa-f]{3,8}$') NOT VALID;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 5. Buckets: browser roles may read definitions (policy metallurgy_buckets_select), never change them
-- ---------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE storage.buckets FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
