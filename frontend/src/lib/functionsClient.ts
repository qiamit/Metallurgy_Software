import { supabase } from '@/lib/supabaseClient'

const apiUrl = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '')
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

/** POST to the Railway `functions` service through the API gateway (/functions/v1/<name>). */
export async function callFunction<T>(name: string, body: unknown, opts: { anonymous?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    'Content-Type': 'application/json',
  }
  if (!opts.anonymous) {
    const { data, error } = await supabase.auth.getSession()
    if (error && String(error.message).toLowerCase().includes('refresh token')) {
      await supabase.auth.signOut()
    }
    const token = data.session?.access_token
    if (!token) throw new Error('Your session has expired. Please sign in again.')
    headers['x-user-jwt'] = token
  }
  const res = await fetch(`${apiUrl}/functions/v1/${name}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body ?? {}),
  })
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data && (data as { error?: unknown }).error
        ? String((data as { error: unknown }).error)
        : `Request failed (${res.status})`
    throw new Error(message)
  }
  return data as T
}
