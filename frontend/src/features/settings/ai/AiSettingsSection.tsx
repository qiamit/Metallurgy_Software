import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  DEFAULT_MODEL,
  fetchAiSettings,
  saveAiSettings,
  type AiProvider,
  type AiSettings,
} from '@/features/settings/ai/aiSettingsApi'

export function AiSettingsSection() {
  const { orgId } = useAuth()
  const [settings, setSettings] = useState<AiSettings | null>(null)
  const [form, setForm] = useState({
    provider: 'deepseek' as AiProvider,
    model: DEFAULT_MODEL.deepseek,
    apiKey: '',
    clearKey: false,
    ringAiEnabled: false,
  })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  function apply(s: AiSettings) {
    setSettings(s)
    setForm({ provider: s.provider, model: s.model, apiKey: '', clearKey: false, ringAiEnabled: s.ring_ai_enabled })
  }

  useEffect(() => {
    if (!orgId) return
    fetchAiSettings(orgId)
      .then(apply)
      .catch((e) => setMessage({ ok: false, text: e.message }))
  }, [orgId])

  async function onSave(e: FormEvent) {
    e.preventDefault()
    if (!orgId) return
    setBusy(true)
    setMessage(null)
    try {
      apply(await saveAiSettings(orgId, form))
      setMessage({ ok: true, text: 'AI settings saved.' })
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Save Failed' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSave} className="card p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="font-semibold">AI Setting</h2>
        <span className={`badge ${settings?.has_api_key ? 'badge-ok' : 'badge-warn'}`}>
          {settings?.has_api_key ? 'API Key Configured' : 'Not Configured'}
        </span>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-[var(--muted)]" htmlFor="ai-provider">
            AI Provider
          </label>
          <select
            id="ai-provider"
            className="input mt-1"
            value={form.provider}
            onChange={(e) => {
              const provider = e.target.value as AiProvider
              setForm({ ...form, provider, model: DEFAULT_MODEL[provider] })
            }}
          >
            <option value="deepseek">DeepSeek</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-[var(--muted)]" htmlFor="ai-model">
            Model
          </label>
          <input id="ai-model" className="input mt-1" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-[var(--muted)]" htmlFor="ai-key">
            API Key
          </label>
          <input
            id="ai-key"
            className="input mt-1"
            type="password"
            value={form.apiKey}
            onChange={(e) => setForm({ ...form, apiKey: e.target.value, clearKey: false })}
            placeholder={
              settings?.api_key_hint
                ? `Saved Key ${settings.api_key_hint} — Enter New Key to Replace`
                : form.provider === 'openai'
                  ? 'Paste Your OpenAI API Key'
                  : 'Paste Your DeepSeek API Key'
            }
            autoComplete="off"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
        <input
          type="checkbox"
          checked={form.clearKey}
          onChange={(e) => setForm({ ...form, clearKey: e.target.checked, apiKey: '' })}
        />
        Remove Saved API Key
      </label>
      <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
        <input
          type="checkbox"
          checked={form.ringAiEnabled}
          onChange={(e) => setForm({ ...form, ringAiEnabled: e.target.checked })}
        />
        Enable AI Ring Analysis in Ring Test (uses the vision model above)
      </label>
      <p className="text-xs text-[var(--muted)]">
        The key is stored on the server and is never sent back to the browser — only the last 4 characters are shown.
      </p>
      {message && (
        <p className={`text-sm ${message.ok ? 'text-[var(--ok)]' : 'text-[var(--danger)]'}`}>{message.text}</p>
      )}
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? 'Saving…' : 'Save AI Settings'}
      </button>
    </form>
  )
}
