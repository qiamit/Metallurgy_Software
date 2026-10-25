-- Per-job analysis options chosen by the lab (e.g. grain-size etch type: line / contrast).
-- Small, flat JSON object; the functions service only reads known keys and ignores the rest.
ALTER TABLE public.analysis_jobs
  ADD COLUMN IF NOT EXISTS analysis_options jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'analysis_jobs_options_check') THEN
    ALTER TABLE public.analysis_jobs
      ADD CONSTRAINT analysis_jobs_options_check
      CHECK (jsonb_typeof(analysis_options) = 'object' AND pg_column_size(analysis_options) <= 1024);
  END IF;
END $$;

GRANT UPDATE (analysis_options) ON public.analysis_jobs TO authenticated;

NOTIFY pgrst, 'reload schema';
