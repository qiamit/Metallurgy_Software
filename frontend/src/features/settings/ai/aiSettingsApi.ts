import { supabase } from '@/lib/supabaseClient'

export type AiProvider = 'deepseek' | 'openai'

export type AiSettings = {
  provider: AiProvider
  model: string
  has_api_key: boolean
  api_key_hint: string | null
  ring_ai_enabled: boolean
}

export const DEFAULT_MODEL: Record<AiProvider, string> = {
  deepseek: 'deepseek-v4-flash-vision-exp',
  openai: 'gpt-4o-mini',
}

export async function fetchAiSettings(orgId: string): Promise<AiSettings> {
  // api_key itself is not readable by the browser (column privilege); only the hint.
  const { data, error } = await supabase
    .from('ai_settings')
    .select('provider, model, has_api_key, api_key_hint, ring_ai_enabled')
    .eq('organization_id', orgId)
    .single()
  if (error) throw new Error(error.message)
  return data as AiSettings
}

export async function saveAiSettings(
  orgId: string,
  input: { provider: AiProvider; model: string; apiKey: string; clearKey: boolean; ringAiEnabled: boolean },
): Promise<AiSettings> {
  const payload: Record<string, unknown> = {
    provider: input.provider,
    model: input.model.trim() || DEFAULT_MODEL[input.provider],
    ring_ai_enabled: input.ringAiEnabled,
  }
  // Blank key keeps the saved one (same as the old API's merge rule).
  if (input.clearKey) payload.api_key = null
  else if (input.apiKey.trim()) payload.api_key = input.apiKey.trim()
  const { error } = await supabase.from('ai_settings').update(payload).eq('organization_id', orgId)
  if (error) throw new Error(error.message)
  return fetchAiSettings(orgId)
}
