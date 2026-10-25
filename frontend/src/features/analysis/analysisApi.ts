import { supabase } from '@/lib/supabaseClient'
import { callFunction } from '@/lib/functionsClient'
import { removeLabFiles, uploadLabFile } from '@/lib/storage'
import type { AnalysisJob, AnalysisOptions, AnalysisType, DashboardStats } from '@/types'

const JOB_COLUMNS =
  'id, organization_id, sample_id, calibration_id, analysis_type, status, analysis_options, source_image_path, ' +
  'overlay_image_path, software_result, error_message, reviewed_by, review_notes, ' +
  'reviewed_at, created_at, completed_at'

export async function fetchDashboardStats(orgId: string): Promise<DashboardStats> {
  const { data, error } = await supabase.rpc('org_dashboard_stats', { p_org: orgId })
  if (error) throw new Error(error.message)
  return data as DashboardStats
}

export async function fetchJobs(orgId: string, limit = 500): Promise<AnalysisJob[]> {
  const { data, error } = await supabase
    .from('analysis_jobs')
    .select(JOB_COLUMNS)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as AnalysisJob[]
}

export async function fetchJob(id: string): Promise<AnalysisJob | null> {
  const { data, error } = await supabase.from('analysis_jobs').select(JOB_COLUMNS).eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as unknown as AnalysisJob) ?? null
}

/** Upload the image, create a pending job, then run the software analysis on the functions service. */
export async function createAndRunJob(params: {
  orgId: string
  sampleId: string
  analysisType: AnalysisType
  calibrationId: string | null
  analysisOptions?: AnalysisOptions
  image: Blob
}): Promise<AnalysisJob> {
  if (!params.image.size) throw new Error('Empty file')
  const { data: auth } = await supabase.auth.getUser()
  const path = await uploadLabFile('job-images', params.orgId, params.image)
  const { data, error } = await supabase
    .from('analysis_jobs')
    .insert({
      organization_id: params.orgId,
      sample_id: params.sampleId,
      calibration_id: params.calibrationId,
      analysis_type: params.analysisType,
      analysis_options: params.analysisOptions ?? {},
      source_image_path: path,
      created_by: auth.user?.id,
    })
    .select('id')
    .single()
  if (error) {
    await removeLabFiles('job-images', [path])
    throw new Error(error.message)
  }
  const { job } = await callFunction<{ job: AnalysisJob }>('analyze-job', { job_id: data.id })
  return job
}

/** Change module / calibration and re-run the software analysis. */
export async function updateJobAndRerun(
  jobId: string,
  fields: {
    analysis_type: AnalysisType
    calibration_id: string | null
    analysis_options?: AnalysisOptions
  },
): Promise<AnalysisJob> {
  const { error } = await supabase.from('analysis_jobs').update(fields).eq('id', jobId)
  if (error) throw new Error(error.message)
  const { job } = await callFunction<{ job: AnalysisJob }>('analyze-job', { job_id: jobId })
  return job
}

export async function reviewJob(jobId: string, approve: boolean, notes: string): Promise<void> {
  const { error } = await supabase.rpc('review_analysis_job', { p_job: jobId, p_approve: approve, p_notes: notes })
  if (error) throw new Error(error.message)
}

export async function deleteJobs(jobs: Pick<AnalysisJob, 'id' | 'source_image_path' | 'overlay_image_path'>[]) {
  if (!jobs.length) return
  const { error } = await supabase
    .from('analysis_jobs')
    .delete()
    .in(
      'id',
      jobs.map((j) => j.id),
    )
  if (error) throw new Error(error.message)
  // Files go with the job (the old API left them behind).
  await removeLabFiles('job-images', jobs.map((j) => j.source_image_path))
  await removeLabFiles('job-overlays', jobs.map((j) => j.overlay_image_path))
}
