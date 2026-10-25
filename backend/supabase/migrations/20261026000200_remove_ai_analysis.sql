-- Remove AI analysis from the product: the vision-LLM cross-check on analysis jobs and Ring Test AI.
-- Deletes the labs' stored AI provider settings / API keys and the stored AI results of past jobs.

-- New labs no longer get an ai_settings row.
CREATE OR REPLACE FUNCTION public.handle_new_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.lab_settings (organization_id, company_name) VALUES (NEW.id, NEW.name)
  ON CONFLICT DO NOTHING;
  INSERT INTO public.ring_test_settings (organization_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_organization() FROM PUBLIC, anon, authenticated;

-- The insert policy referenced the AI result columns.
DROP POLICY IF EXISTS analysis_jobs_insert ON public.analysis_jobs;
CREATE POLICY analysis_jobs_insert ON public.analysis_jobs FOR INSERT TO authenticated
  WITH CHECK (
    public.app_has_org_role(organization_id, 'analyst')
    AND created_by = auth.uid()
    AND status = 'pending'
    AND software_result IS NULL
    AND overlay_image_path IS NULL AND reviewed_by IS NULL
  );

ALTER TABLE public.analysis_jobs
  DROP COLUMN IF EXISTS run_ai,
  DROP COLUMN IF EXISTS ai_result,
  DROP COLUMN IF EXISTS comparison;

DROP TABLE IF EXISTS public.ai_settings CASCADE;

NOTIFY pgrst, 'reload schema';
