-- Metallurgy Lab baseline schema (multi-tenant).
-- Requires: 20261024000000_bootstrap_roles.sql, and GoTrue has created the `auth` schema
-- (auth.users, auth.uid()).
--
-- Tenancy: every lab is an `organizations` row. Users join labs through `memberships`
-- with a role. RLS checks the caller's role in the row's organization.
-- Role order matters: enum comparison uses declaration order (viewer < ... < owner).

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.org_role AS ENUM ('viewer', 'analyst', 'reviewer', 'admin', 'owner');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.analysis_type AS ENUM ('grain_size', 'micro', 'macro', 'inclusion', 'decarb');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.job_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'reviewed', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Shared trigger: updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text,
  status text NOT NULL DEFAULT 'Active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  accent text NOT NULL DEFAULT '#2f6f6a',
  created_by uuid REFERENCES public.user_profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles (id) ON DELETE CASCADE,
  role public.org_role NOT NULL DEFAULT 'analyst',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT memberships_user_org_key UNIQUE (user_id, organization_id)
);
CREATE INDEX IF NOT EXISTS memberships_org_idx ON public.memberships (organization_id);

CREATE TABLE IF NOT EXISTS public.lab_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations (id) ON DELETE CASCADE,
  company_name text NOT NULL DEFAULT '',
  gst_number text NOT NULL DEFAULT '',
  contact_person_name text NOT NULL DEFAULT '',
  mobile_number text NOT NULL DEFAULT '',
  email_id text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  pin_code text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT '',
  company_logo_path text,
  company_header_path text,
  company_footer_path text,
  watermark_path text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations (id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'deepseek' CHECK (provider IN ('deepseek', 'openai')),
  model text NOT NULL DEFAULT 'deepseek-v4-flash-vision-exp',
  api_key text,
  has_api_key boolean GENERATED ALWAYS AS (api_key IS NOT NULL AND length(btrim(api_key)) > 0) STORED,
  api_key_hint text GENERATED ALWAYS AS (
    CASE WHEN api_key IS NOT NULL AND length(btrim(api_key)) > 0
      THEN '••••' || right(btrim(api_key), 4) END
  ) STORED,
  ring_ai_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.calibrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  objective text NOT NULL,
  um_per_px_x double precision NOT NULL CHECK (um_per_px_x > 0),
  um_per_px_y double precision NOT NULL CHECK (um_per_px_y > 0),
  unit text NOT NULL DEFAULT 'um',
  notes text,
  created_by uuid REFERENCES public.user_profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calibrations_id_org_key UNIQUE (id, organization_id)
);
CREATE INDEX IF NOT EXISTS calibrations_org_idx ON public.calibrations (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  sample_code text NOT NULL,
  material text,
  description text,
  created_by uuid REFERENCES public.user_profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT samples_id_org_key UNIQUE (id, organization_id)
);
CREATE INDEX IF NOT EXISTS samples_org_idx ON public.samples (organization_id, created_at DESC);

-- Composite FKs keep the sample and calibration inside the job's own lab.
CREATE TABLE IF NOT EXISTS public.analysis_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  sample_id uuid NOT NULL,
  calibration_id uuid,
  analysis_type public.analysis_type NOT NULL,
  status public.job_status NOT NULL DEFAULT 'pending',
  run_ai boolean NOT NULL DEFAULT true,
  source_image_path text,
  overlay_image_path text,
  software_result jsonb,
  ai_result jsonb,
  comparison jsonb,
  error_message text,
  reviewed_by uuid REFERENCES public.user_profiles (id) ON DELETE SET NULL,
  review_notes text,
  reviewed_at timestamptz,
  created_by uuid REFERENCES public.user_profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT analysis_jobs_sample_fk FOREIGN KEY (sample_id, organization_id)
    REFERENCES public.samples (id, organization_id) ON DELETE CASCADE,
  CONSTRAINT analysis_jobs_calibration_fk FOREIGN KEY (calibration_id, organization_id)
    REFERENCES public.calibrations (id, organization_id) ON DELETE SET NULL (calibration_id)
);
CREATE INDEX IF NOT EXISTS analysis_jobs_org_idx ON public.analysis_jobs (organization_id, created_at DESC);

-- IS 1786:2008 TMT rebar ring (rib) measurement. `results` is computed in the browser editor.
CREATE TABLE IF NOT EXISTS public.ring_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  sample_description text,
  sample_diameter_mm double precision NOT NULL CHECK (sample_diameter_mm > 0),
  batch_number text,
  mfg_date text,
  tester_name text NOT NULL,
  test_date text NOT NULL,
  test_time text NOT NULL,
  image_path text,
  results jsonb NOT NULL DEFAULT '{}'::jsonb,
  overall_pass boolean GENERATED ALWAYS AS ((results ->> 'overall_pass')::boolean) STORED,
  observations text,
  created_by uuid REFERENCES public.user_profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ring_tests_org_idx ON public.ring_tests (organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ring_test_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations (id) ON DELETE CASCADE,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id bigserial PRIMARY KEY,
  organization_id uuid,
  user_id uuid,
  action text NOT NULL,
  table_name text NOT NULL,
  record_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_org_idx ON public.audit_log (organization_id, created_at DESC);

-- updated_at triggers
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['user_profiles','organizations','lab_settings','ai_settings','calibrations',
                           'samples','analysis_jobs','ring_tests','ring_test_settings']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_set_updated_at ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON public.%I
                    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t, t);
  END LOOP;
END
$$;

-- ---------------------------------------------------------------------------
-- Role helpers (SECURITY DEFINER, same pattern as QIRLPL LIMS app_is_* helpers)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_is_active_user()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND lower(btrim(coalesce(up.status, 'active'))) <> 'inactive'
  );
$$;

CREATE OR REPLACE FUNCTION public.app_org_role(p_org uuid)
RETURNS public.org_role
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT m.role
  FROM public.memberships m
  JOIN public.user_profiles up ON up.id = m.user_id
  WHERE m.organization_id = p_org
    AND m.user_id = auth.uid()
    AND lower(btrim(coalesce(up.status, 'active'))) <> 'inactive';
$$;

CREATE OR REPLACE FUNCTION public.app_has_org_role(p_org uuid, p_min public.org_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(public.app_org_role(p_org) >= p_min, false);
$$;

-- Storage paths are "<org_id>/<file>"; bad prefixes must not raise.
CREATE OR REPLACE FUNCTION public.app_try_uuid(p text)
RETURNS uuid
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
  RETURN p::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.app_shares_org_with(p_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships mine
    JOIN public.memberships theirs ON theirs.organization_id = mine.organization_id
    WHERE mine.user_id = auth.uid() AND theirs.user_id = p_user
  );
$$;

REVOKE ALL ON FUNCTION public.app_is_active_user() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_org_role(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_has_org_role(uuid, public.org_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.app_shares_org_with(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_is_active_user() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_org_role(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_has_org_role(uuid, public.org_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_shares_org_with(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_try_uuid(text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- New auth user -> profile
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, email, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    lower(NEW.email),
    'Active'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- New organization -> settings rows
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.lab_settings (organization_id, company_name) VALUES (NEW.id, NEW.name)
  ON CONFLICT DO NOTHING;
  INSERT INTO public.ai_settings (organization_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO public.ring_test_settings (organization_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_organization_created ON public.organizations;
CREATE TRIGGER on_organization_created
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization();

-- Lab Setting company name also renames the lab (same as the old API).
CREATE OR REPLACE FUNCTION public.sync_org_name_from_lab_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF length(btrim(NEW.company_name)) > 0 AND NEW.company_name IS DISTINCT FROM OLD.company_name THEN
    UPDATE public.organizations SET name = btrim(NEW.company_name) WHERE id = NEW.organization_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lab_settings_sync_org_name ON public.lab_settings;
CREATE TRIGGER lab_settings_sync_org_name
  AFTER UPDATE OF company_name ON public.lab_settings
  FOR EACH ROW EXECUTE FUNCTION public.sync_org_name_from_lab_settings();

-- ---------------------------------------------------------------------------
-- Create a lab and make p_owner its owner (slug: name -> kebab, -2, -3 ... if taken)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_organization_with_owner(p_name text, p_owner uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_name text := btrim(coalesce(p_name, ''));
  v_base text;
  v_slug text;
  v_n int := 1;
  v_org uuid;
BEGIN
  IF v_name = '' THEN
    RAISE EXCEPTION 'Organization name is required' USING ERRCODE = '22023';
  END IF;
  v_base := btrim(regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'), '-');
  IF v_base = '' THEN v_base := 'org'; END IF;
  v_slug := v_base;
  WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = v_slug) LOOP
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  END LOOP;

  INSERT INTO public.organizations (name, slug, created_by)
  VALUES (v_name, v_slug, p_owner)
  RETURNING id INTO v_org;

  INSERT INTO public.memberships (organization_id, user_id, role) VALUES (v_org, p_owner, 'owner');
  RETURN v_org;
END;
$$;

REVOKE ALL ON FUNCTION public.create_organization_with_owner(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_organization_with_owner(text, uuid) TO service_role;

-- A signed-in user can open another lab workspace (shows in the org switcher).
CREATE OR REPLACE FUNCTION public.create_my_organization(p_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.app_is_active_user() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  RETURN public.create_organization_with_owner(p_name, auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.create_my_organization(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_my_organization(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Job review (reviewer+) — the only way to set reviewed / rejected
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_analysis_job(p_job uuid, p_approve boolean, p_notes text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_org uuid;
BEGIN
  SELECT organization_id INTO v_org FROM public.analysis_jobs WHERE id = p_job;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Job not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.app_has_org_role(v_org, 'reviewer') THEN
    RAISE EXCEPTION 'Requires role reviewer or higher' USING ERRCODE = '42501';
  END IF;
  UPDATE public.analysis_jobs
  SET status = CASE WHEN p_approve THEN 'reviewed'::public.job_status ELSE 'rejected'::public.job_status END,
      reviewed_by = auth.uid(),
      review_notes = nullif(btrim(coalesce(p_notes, '')), ''),
      reviewed_at = now()
  WHERE id = p_job;
END;
$$;

REVOKE ALL ON FUNCTION public.review_analysis_job(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_analysis_job(uuid, boolean, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Dashboard counts (SECURITY INVOKER: RLS applies)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.org_dashboard_stats(p_org uuid)
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'samples', (SELECT count(*) FROM public.samples WHERE organization_id = p_org),
    'jobs', (SELECT count(*) FROM public.analysis_jobs WHERE organization_id = p_org),
    'completed', (SELECT count(*) FROM public.analysis_jobs
                  WHERE organization_id = p_org AND status IN ('completed', 'reviewed')),
    'pending', (SELECT count(*) FROM public.analysis_jobs
                WHERE organization_id = p_org AND status IN ('pending', 'processing')),
    'by_type', coalesce((
      SELECT jsonb_object_agg(analysis_type, n)
      FROM (SELECT analysis_type, count(*) AS n FROM public.analysis_jobs
            WHERE organization_id = p_org GROUP BY analysis_type) t
    ), '{}'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.org_dashboard_stats(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_dashboard_stats(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Audit log (api_key never stored)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.write_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_old jsonb := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) - 'api_key' END;
  v_new jsonb := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) - 'api_key' END;
  v_row jsonb := coalesce(v_new, v_old);
BEGIN
  INSERT INTO public.audit_log (organization_id, user_id, action, table_name, record_id, old_data, new_data)
  VALUES (
    public.app_try_uuid(coalesce(v_row->>'organization_id', CASE WHEN TG_TABLE_NAME = 'organizations' THEN v_row->>'id' END)),
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    coalesce(v_row->>'id', v_row->>'organization_id'),
    v_old,
    v_new
  );
  RETURN coalesce(NEW, OLD);
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['organizations','memberships','lab_settings','ai_settings','calibrations',
                           'samples','analysis_jobs','ring_tests','ring_test_settings']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_audit ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER %I_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I
                    FOR EACH ROW EXECUTE FUNCTION public.write_audit_log()', t, t);
  END LOOP;
END
$$;

-- ---------------------------------------------------------------------------
-- Grants (table level; RLS narrows rows)
-- ---------------------------------------------------------------------------
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

GRANT SELECT ON public.user_profiles TO authenticated;
GRANT UPDATE (full_name) ON public.user_profiles TO authenticated;

GRANT SELECT ON public.organizations TO authenticated;
GRANT UPDATE (name, accent) ON public.organizations TO authenticated;

GRANT SELECT ON public.memberships TO authenticated;

GRANT SELECT ON public.lab_settings TO authenticated;
GRANT UPDATE (company_name, gst_number, contact_person_name, mobile_number, email_id, address,
              pin_code, city, state, country, company_logo_path, company_header_path,
              company_footer_path, watermark_path) ON public.lab_settings TO authenticated;

-- The API key column is write-only for the browser; reads see has_api_key / api_key_hint.
GRANT SELECT (organization_id, provider, model, has_api_key, api_key_hint, ring_ai_enabled, updated_at)
  ON public.ai_settings TO authenticated;
GRANT UPDATE (provider, model, api_key, ring_ai_enabled) ON public.ai_settings TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calibrations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.samples TO authenticated;

GRANT SELECT, INSERT, DELETE ON public.analysis_jobs TO authenticated;
GRANT UPDATE (calibration_id, analysis_type, run_ai) ON public.analysis_jobs TO authenticated;

GRANT SELECT, INSERT, DELETE ON public.ring_tests TO authenticated;
GRANT UPDATE (sample_description, batch_number, mfg_date, tester_name, observations)
  ON public.ring_tests TO authenticated;

GRANT SELECT ON public.ring_test_settings TO authenticated;
GRANT UPDATE (settings) ON public.ring_test_settings TO authenticated;

GRANT SELECT ON public.audit_log TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calibrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ring_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ring_test_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- user_profiles: yourself, or people in a lab you belong to. Status changes go through functions.
DROP POLICY IF EXISTS user_profiles_select ON public.user_profiles;
CREATE POLICY user_profiles_select ON public.user_profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.app_shares_org_with(id));
DROP POLICY IF EXISTS user_profiles_update_self ON public.user_profiles;
CREATE POLICY user_profiles_update_self ON public.user_profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- organizations: members read, admins rename. Create via create_my_organization / functions.
DROP POLICY IF EXISTS organizations_select ON public.organizations;
CREATE POLICY organizations_select ON public.organizations FOR SELECT TO authenticated
  USING (public.app_has_org_role(id, 'viewer'));
DROP POLICY IF EXISTS organizations_update ON public.organizations;
CREATE POLICY organizations_update ON public.organizations FOR UPDATE TO authenticated
  USING (public.app_has_org_role(id, 'admin')) WITH CHECK (public.app_has_org_role(id, 'admin'));

-- memberships: members of the lab can see the team. Writes go through functions
-- (it enforces "no one grants a role above their own" and keeps at least one owner).
DROP POLICY IF EXISTS memberships_select ON public.memberships;
CREATE POLICY memberships_select ON public.memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.app_has_org_role(organization_id, 'viewer'));

-- lab_settings: everyone in the lab reads (PDF branding), admins write.
DROP POLICY IF EXISTS lab_settings_select ON public.lab_settings;
CREATE POLICY lab_settings_select ON public.lab_settings FOR SELECT TO authenticated
  USING (public.app_has_org_role(organization_id, 'viewer'));
DROP POLICY IF EXISTS lab_settings_update ON public.lab_settings;
CREATE POLICY lab_settings_update ON public.lab_settings FOR UPDATE TO authenticated
  USING (public.app_has_org_role(organization_id, 'admin'))
  WITH CHECK (public.app_has_org_role(organization_id, 'admin'));

DROP POLICY IF EXISTS ai_settings_select ON public.ai_settings;
CREATE POLICY ai_settings_select ON public.ai_settings FOR SELECT TO authenticated
  USING (public.app_has_org_role(organization_id, 'viewer'));
DROP POLICY IF EXISTS ai_settings_update ON public.ai_settings;
CREATE POLICY ai_settings_update ON public.ai_settings FOR UPDATE TO authenticated
  USING (public.app_has_org_role(organization_id, 'admin'))
  WITH CHECK (public.app_has_org_role(organization_id, 'admin'));

-- calibrations / samples: viewer reads, analyst creates and edits, admin deletes.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['calibrations', 'samples'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_select ON public.%I FOR SELECT TO authenticated
                    USING (public.app_has_org_role(organization_id, ''viewer''))', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_insert ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_insert ON public.%I FOR INSERT TO authenticated
                    WITH CHECK (public.app_has_org_role(organization_id, ''analyst'') AND created_by = auth.uid())', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_update ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_update ON public.%I FOR UPDATE TO authenticated
                    USING (public.app_has_org_role(organization_id, ''analyst''))
                    WITH CHECK (public.app_has_org_role(organization_id, ''analyst''))', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_delete ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_delete ON public.%I FOR DELETE TO authenticated
                    USING (public.app_has_org_role(organization_id, ''admin''))', t, t);
  END LOOP;
END
$$;

-- analysis_jobs: viewer reads; analyst creates pending jobs, edits type/calibration, deletes.
-- Results are written only by the functions service (service_role).
DROP POLICY IF EXISTS analysis_jobs_select ON public.analysis_jobs;
CREATE POLICY analysis_jobs_select ON public.analysis_jobs FOR SELECT TO authenticated
  USING (public.app_has_org_role(organization_id, 'viewer'));
DROP POLICY IF EXISTS analysis_jobs_insert ON public.analysis_jobs;
CREATE POLICY analysis_jobs_insert ON public.analysis_jobs FOR INSERT TO authenticated
  WITH CHECK (
    public.app_has_org_role(organization_id, 'analyst')
    AND created_by = auth.uid()
    AND status = 'pending'
    AND software_result IS NULL AND ai_result IS NULL AND comparison IS NULL
    AND overlay_image_path IS NULL AND reviewed_by IS NULL
  );
DROP POLICY IF EXISTS analysis_jobs_update ON public.analysis_jobs;
CREATE POLICY analysis_jobs_update ON public.analysis_jobs FOR UPDATE TO authenticated
  USING (public.app_has_org_role(organization_id, 'analyst'))
  WITH CHECK (public.app_has_org_role(organization_id, 'analyst'));
DROP POLICY IF EXISTS analysis_jobs_delete ON public.analysis_jobs;
CREATE POLICY analysis_jobs_delete ON public.analysis_jobs FOR DELETE TO authenticated
  USING (public.app_has_org_role(organization_id, 'analyst'));

-- ring_tests: viewer reads, analyst creates / edits text / deletes.
DROP POLICY IF EXISTS ring_tests_select ON public.ring_tests;
CREATE POLICY ring_tests_select ON public.ring_tests FOR SELECT TO authenticated
  USING (public.app_has_org_role(organization_id, 'viewer'));
DROP POLICY IF EXISTS ring_tests_insert ON public.ring_tests;
CREATE POLICY ring_tests_insert ON public.ring_tests FOR INSERT TO authenticated
  WITH CHECK (public.app_has_org_role(organization_id, 'analyst') AND created_by = auth.uid());
DROP POLICY IF EXISTS ring_tests_update ON public.ring_tests;
CREATE POLICY ring_tests_update ON public.ring_tests FOR UPDATE TO authenticated
  USING (public.app_has_org_role(organization_id, 'analyst'))
  WITH CHECK (public.app_has_org_role(organization_id, 'analyst'));
DROP POLICY IF EXISTS ring_tests_delete ON public.ring_tests;
CREATE POLICY ring_tests_delete ON public.ring_tests FOR DELETE TO authenticated
  USING (public.app_has_org_role(organization_id, 'analyst'));

DROP POLICY IF EXISTS ring_test_settings_select ON public.ring_test_settings;
CREATE POLICY ring_test_settings_select ON public.ring_test_settings FOR SELECT TO authenticated
  USING (public.app_has_org_role(organization_id, 'viewer'));
DROP POLICY IF EXISTS ring_test_settings_update ON public.ring_test_settings;
CREATE POLICY ring_test_settings_update ON public.ring_test_settings FOR UPDATE TO authenticated
  USING (public.app_has_org_role(organization_id, 'analyst'))
  WITH CHECK (public.app_has_org_role(organization_id, 'analyst'));

DROP POLICY IF EXISTS audit_log_select ON public.audit_log;
CREATE POLICY audit_log_select ON public.audit_log FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND public.app_has_org_role(organization_id, 'admin'));

NOTIFY pgrst, 'reload schema';
