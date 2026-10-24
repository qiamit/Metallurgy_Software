-- Speed + safety hardening.
--
-- 1. Faster RLS reads: the caller's lab list is computed ONCE per query
--    (hashed sub-plan) instead of calling app_has_org_role() per row.
-- 2. Approved / rejected jobs can only be deleted by an admin (keeps signed-off records).
-- 3. Indexes for FK cascades and dashboard counts.
-- 4. Statement timeouts so one heavy request cannot hold the database.

-- ---------------------------------------------------------------------------
-- 1. Caller's labs at or above a role
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_my_org_ids(p_min public.org_role)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT m.organization_id
  FROM public.memberships m
  JOIN public.user_profiles up ON up.id = m.user_id
  WHERE m.user_id = auth.uid()
    AND m.role >= p_min
    AND lower(btrim(coalesce(up.status, 'active'))) <> 'inactive';
$$;

REVOKE ALL ON FUNCTION public.app_my_org_ids(public.org_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.app_my_org_ids(public.org_role) TO authenticated, service_role;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['calibrations', 'samples', 'analysis_jobs', 'ring_tests',
                           'lab_settings', 'ai_settings', 'ring_test_settings'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_select ON public.%I FOR SELECT TO authenticated
                    USING (organization_id IN (SELECT public.app_my_org_ids(''viewer'')))', t, t);
  END LOOP;
END
$$;

DROP POLICY IF EXISTS audit_log_select ON public.audit_log;
CREATE POLICY audit_log_select ON public.audit_log FOR SELECT TO authenticated
  USING (organization_id IN (SELECT public.app_my_org_ids('admin')));

DROP POLICY IF EXISTS memberships_select ON public.memberships;
CREATE POLICY memberships_select ON public.memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR organization_id IN (SELECT public.app_my_org_ids('viewer')));

DROP POLICY IF EXISTS organizations_select ON public.organizations;
CREATE POLICY organizations_select ON public.organizations FOR SELECT TO authenticated
  USING (id IN (SELECT public.app_my_org_ids('viewer')));

-- ---------------------------------------------------------------------------
-- 2. Signed-off jobs need an admin to delete
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS analysis_jobs_delete ON public.analysis_jobs;
CREATE POLICY analysis_jobs_delete ON public.analysis_jobs FOR DELETE TO authenticated
  USING (
    public.app_has_org_role(organization_id, 'admin')
    OR (status NOT IN ('reviewed', 'rejected') AND public.app_has_org_role(organization_id, 'analyst'))
  );

-- Editing a signed-off job (module / calibration) also needs an admin.
DROP POLICY IF EXISTS analysis_jobs_update ON public.analysis_jobs;
CREATE POLICY analysis_jobs_update ON public.analysis_jobs FOR UPDATE TO authenticated
  USING (
    public.app_has_org_role(organization_id, 'admin')
    OR (status NOT IN ('reviewed', 'rejected') AND public.app_has_org_role(organization_id, 'analyst'))
  )
  WITH CHECK (public.app_has_org_role(organization_id, 'analyst'));

-- ---------------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS analysis_jobs_sample_idx ON public.analysis_jobs (sample_id);
CREATE INDEX IF NOT EXISTS analysis_jobs_calibration_idx ON public.analysis_jobs (calibration_id)
  WHERE calibration_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS analysis_jobs_org_status_idx ON public.analysis_jobs (organization_id, status);
CREATE INDEX IF NOT EXISTS analysis_jobs_org_type_idx ON public.analysis_jobs (organization_id, analysis_type);
CREATE INDEX IF NOT EXISTS memberships_org_role_idx ON public.memberships (organization_id, role);

-- ---------------------------------------------------------------------------
-- 4. Timeouts for API roles (service_role keeps the server default for analysis writes)
-- ---------------------------------------------------------------------------
ALTER ROLE authenticated SET statement_timeout = '15s';
ALTER ROLE anon SET statement_timeout = '5s';

NOTIFY pgrst, 'reload schema';
