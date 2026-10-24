import { supabase } from '@/lib/supabaseClient'
import { objectDataUrl, uploadLabFile, removeLabFiles } from '@/lib/storage'

export type LabSettings = {
  organization_id: string
  company_name: string
  gst_number: string
  contact_person_name: string
  mobile_number: string
  email_id: string
  address: string
  pin_code: string
  city: string
  state: string
  country: string
  company_logo_path: string | null
  company_header_path: string | null
  company_footer_path: string | null
  watermark_path: string | null
}

export const LAB_TEXT_FIELDS = [
  'company_name',
  'gst_number',
  'contact_person_name',
  'mobile_number',
  'email_id',
  'address',
  'pin_code',
  'city',
  'state',
  'country',
] as const

export type LabTextField = (typeof LAB_TEXT_FIELDS)[number]

export type BrandingAsset = 'logo' | 'header' | 'footer' | 'watermark'

export const ASSET_COLUMN: Record<BrandingAsset, keyof LabSettings> = {
  logo: 'company_logo_path',
  header: 'company_header_path',
  footer: 'company_footer_path',
  watermark: 'watermark_path',
}

export async function fetchLabSettings(orgId: string): Promise<LabSettings> {
  const { data, error } = await supabase.from('lab_settings').select('*').eq('organization_id', orgId).single()
  if (error) throw new Error(error.message)
  return data as LabSettings
}

export async function saveLabSettings(orgId: string, values: Record<LabTextField, string>): Promise<LabSettings> {
  const payload = Object.fromEntries(LAB_TEXT_FIELDS.map((k) => [k, (values[k] ?? '').trim()]))
  const { error } = await supabase.from('lab_settings').update(payload).eq('organization_id', orgId)
  if (error) throw new Error(error.message)
  return fetchLabSettings(orgId)
}

export async function uploadBrandingAsset(orgId: string, asset: BrandingAsset, file: File): Promise<LabSettings> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file')
  const current = await fetchLabSettings(orgId)
  const path = await uploadLabFile('lab-branding', orgId, file, `${asset}-`)
  const column = ASSET_COLUMN[asset]
  const { error } = await supabase.from('lab_settings').update({ [column]: path }).eq('organization_id', orgId)
  if (error) {
    await removeLabFiles('lab-branding', [path])
    throw new Error(error.message)
  }
  await removeLabFiles('lab-branding', [current[column] as string | null])
  return fetchLabSettings(orgId)
}

export type LabBranding = {
  settings: LabSettings
  logo: string
  header: string
  footer: string
  watermark: string
}

/** Lab profile + branding images as data URLs, ready to inline into report HTML. */
export async function loadLabBranding(orgId: string): Promise<LabBranding> {
  const settings = await fetchLabSettings(orgId)
  const [logo, header, footer, watermark] = await Promise.all([
    objectDataUrl('lab-branding', settings.company_logo_path),
    objectDataUrl('lab-branding', settings.company_header_path),
    objectDataUrl('lab-branding', settings.company_footer_path),
    objectDataUrl('lab-branding', settings.watermark_path),
  ])
  return { settings, logo, header, footer, watermark }
}
