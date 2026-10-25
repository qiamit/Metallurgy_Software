-- New analysis modules from the lab's chart set (ASTM A247 / ISO 945 / E2567):
-- nodularity (spheroidal graphite iron) and graphite_flake (grey iron flake size).
-- ADD VALUE is allowed in a transaction on PG 12+ as long as the value is not used in it.
ALTER TYPE public.analysis_type ADD VALUE IF NOT EXISTS 'nodularity';
ALTER TYPE public.analysis_type ADD VALUE IF NOT EXISTS 'graphite_flake';

NOTIFY pgrst, 'reload schema';
