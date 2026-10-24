import { supabase } from '@/lib/supabaseClient'
import type { Calibration } from '@/types'

export type CalibrationInput = {
  name: string
  objective: string
  um_per_px_x: number
  um_per_px_y: number
  unit: string
  notes?: string | null
}

const COLUMNS = 'id, organization_id, name, objective, um_per_px_x, um_per_px_y, unit, notes, created_at'

export async function fetchCalibrations(orgId: string): Promise<Calibration[]> {
  const { data, error } = await supabase
    .from('calibrations')
    .select(COLUMNS)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Calibration[]
}

export async function createCalibration(orgId: string, input: CalibrationInput): Promise<Calibration> {
  const { data: auth } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('calibrations')
    .insert({ ...input, notes: input.notes || null, organization_id: orgId, created_by: auth.user?.id })
    .select(COLUMNS)
    .single()
  if (error) throw new Error(error.message)
  return data as Calibration
}

export async function updateCalibration(id: string, input: CalibrationInput): Promise<void> {
  const { error } = await supabase
    .from('calibrations')
    .update({ ...input, notes: input.notes || null })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteCalibrations(ids: string[]): Promise<void> {
  if (!ids.length) return
  const { error } = await supabase.from('calibrations').delete().in('id', ids)
  if (error) throw new Error(error.message)
}
