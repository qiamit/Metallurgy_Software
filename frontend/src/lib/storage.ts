import { supabase } from '@/lib/supabaseClient'

export type BucketId = 'job-images' | 'job-overlays' | 'lab-branding' | 'ring-test-images'

const EXT_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/tiff': 'tif',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg',
}

/** Upload into "<orgId>/<uuid>.<ext>" and return the object path (stored in the table row). */
export async function uploadLabFile(bucket: BucketId, orgId: string, file: Blob, prefix = ''): Promise<string> {
  const type = file.type || 'application/octet-stream'
  const ext = EXT_BY_TYPE[type] ?? 'bin'
  const path = `${orgId}/${prefix}${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false, contentType: type })
  if (error) throw new Error(error.message)
  return path
}

export async function signedUrl(bucket: BucketId, path: string | null | undefined, seconds = 3600): Promise<string> {
  if (!path) return ''
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, seconds)
  if (error) return ''
  return data.signedUrl
}

export async function removeLabFiles(bucket: BucketId, paths: (string | null | undefined)[]): Promise<void> {
  const list = paths.filter((p): p is string => Boolean(p))
  if (!list.length) return
  await supabase.storage.from(bucket).remove(list)
}

/** Data URL of a stored object (used to inline images into PDF HTML). */
export async function objectDataUrl(bucket: BucketId, path: string | null | undefined): Promise<string> {
  if (!path) return ''
  const { data, error } = await supabase.storage.from(bucket).download(path)
  if (error || !data) return ''
  return await new Promise<string>((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => resolve('')
    reader.readAsDataURL(data)
  })
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl)
  if (!match) throw new Error('Invalid image data')
  const bin = atob(match[2])
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: match[1] })
}
