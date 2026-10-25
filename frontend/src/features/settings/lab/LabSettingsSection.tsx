import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { signedUrl } from '@/lib/storage'
import {
  ASSET_COLUMN,
  LAB_TEXT_FIELDS,
  fetchLabSettings,
  saveLabSettings,
  uploadBrandingAsset,
  type BrandingAsset,
  type LabSettings,
  type LabTextField,
} from '@/features/settings/labSettingsApi'

const LAB_ASSETS: [BrandingAsset, string][] = [
  ['logo', 'Company Logo'],
  ['header', 'Company Header'],
  ['footer', 'Company Footer'],
  ['watermark', 'Water Mark'],
]

type LabForm = Record<LabTextField, string>

function toForm(s: LabSettings): LabForm {
  return Object.fromEntries(LAB_TEXT_FIELDS.map((k) => [k, s[k] ?? ''])) as LabForm
}

export function LabSettingsSection() {
  const { orgId, refresh } = useAuth()
  const [settings, setSettings] = useState<LabSettings | null>(null)
  const [form, setForm] = useState<LabForm>(() => Object.fromEntries(LAB_TEXT_FIELDS.map((k) => [k, ''])) as LabForm)
  const [previews, setPreviews] = useState<Partial<Record<BrandingAsset, string>>>({})
  const [busy, setBusy] = useState(false)
  const [assetBusy, setAssetBusy] = useState<BrandingAsset | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const applySettings = useCallback(async (s: LabSettings) => {
    setSettings(s)
    const entries = await Promise.all(
      LAB_ASSETS.map(async ([asset]) => [asset, await signedUrl('lab-branding', s[ASSET_COLUMN[asset]] as string | null)]),
    )
    setPreviews(Object.fromEntries(entries))
  }, [])

  useEffect(() => {
    if (!orgId) return
    fetchLabSettings(orgId)
      .then(async (s) => {
        setForm(toForm(s))
        await applySettings(s)
      })
      .catch((e) => setMessage({ ok: false, text: e.message }))
  }, [orgId, applySettings])

  async function onSave(e: FormEvent) {
    e.preventDefault()
    if (!orgId) return
    setBusy(true)
    setMessage(null)
    try {
      await applySettings(await saveLabSettings(orgId, form))
      await refresh()
      setMessage({ ok: true, text: 'Laboratory settings saved.' })
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Save Failed' })
    } finally {
      setBusy(false)
    }
  }

  async function onUpload(asset: BrandingAsset, file: File | null) {
    if (!orgId || !file) return
    setAssetBusy(asset)
    setMessage(null)
    try {
      await applySettings(await uploadBrandingAsset(orgId, asset, file))
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Upload Failed' })
    } finally {
      setAssetBusy(null)
    }
  }

  const field = (key: LabTextField, label: string, type = 'text') => (
    <div key={key}>
      <label className="label" htmlFor={`lab-${key}`}>
        {label}
      </label>
      <input
        id={`lab-${key}`}
        className="input mt-1"
        type={type}
        required={key === 'company_name'}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </div>
  )

  return (
    <form onSubmit={onSave} className="card p-6 space-y-6">
      <div className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          {field('company_name', 'Company Name')}
          {field('gst_number', 'GST Number')}
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {field('contact_person_name', 'Contact Person Name')}
          {field('mobile_number', 'Mobile Number', 'tel')}
          {field('email_id', 'Email ID', 'email')}
        </div>
        {field('address', 'Address')}
        <div className="grid md:grid-cols-4 gap-4">
          {field('pin_code', 'PIN Code')}
          {field('city', 'City')}
          {field('state', 'State')}
          {field('country', 'Country')}
        </div>
      </div>

      <div className="border-t border-[var(--line)] pt-6">
        <h2 className="section-title">Branding Assets</h2>
        <p className="text-xs text-[var(--muted)] mb-4">Used on PDF reports and Ring Test certificates.</p>
        <div className="grid md:grid-cols-2 gap-4">
          {LAB_ASSETS.map(([asset, label]) => (
            <div key={asset} className="border border-[var(--line)] p-4 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="label">{label}</span>
                <label className="btn btn-ghost cursor-pointer inline-flex shrink-0">
                  {assetBusy === asset ? 'Uploading…' : 'Upload Image'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    aria-label={`Upload ${label}`}
                    disabled={assetBusy !== null}
                    onChange={(e) => onUpload(asset, e.target.files?.[0] || null)}
                  />
                </label>
              </div>
              {previews[asset] && (
                <img
                  src={previews[asset]}
                  alt={label}
                  className="max-h-24 border border-[var(--line)] object-contain bg-white w-full"
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {message && (
        <p className={`text-sm ${message.ok ? 'text-[var(--ok)]' : 'text-[var(--danger)]'}`}>{message.text}</p>
      )}
      <button className="btn btn-primary" type="submit" disabled={busy || !settings}>
        {busy ? 'Saving…' : 'Save Laboratory Settings'}
      </button>
    </form>
  )
}
