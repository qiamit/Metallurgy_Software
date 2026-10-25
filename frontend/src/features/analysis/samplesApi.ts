import { supabase } from '@/lib/supabaseClient'
import type { Sample } from '@/types'

export type SampleInput = {
  sample_code: string
  material?: string | null
  description?: string | null
}

const COLUMNS = 'id, organization_id, sample_code, material, description, created_at'

export async function fetchSamples(orgId: string): Promise<Sample[]> {
  const { data, error } = await supabase
    .from('samples')
    .select(COLUMNS)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Sample[]
}

export async function createSample(orgId: string, input: SampleInput): Promise<Sample> {
  const { data: auth } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('samples')
    .insert({
      organization_id: orgId,
      sample_code: input.sample_code.trim(),
      material: input.material?.trim() || null,
      description: input.description?.trim() || null,
      created_by: auth.user?.id,
    })
    .select(COLUMNS)
    .single()
  if (error) throw new Error(error.message)
  return data as Sample
}

export async function updateSample(id: string, input: SampleInput): Promise<void> {
  const { error } = await supabase
    .from('samples')
    .update({
      sample_code: input.sample_code.trim(),
      material: input.material?.trim() || null,
      description: input.description?.trim() || null,
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteSamples(ids: string[]): Promise<void> {
  if (!ids.length) return
  const { error } = await supabase.from('samples').delete().in('id', ids)
  if (error) throw new Error(error.message)
}
