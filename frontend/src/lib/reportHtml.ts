import type { LabBranding } from '@/features/settings/labSettingsApi'

export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** A4 report page with the lab's header / logo / footer / watermark from Laboratory Setting. */
export function wrapLabReport(branding: LabBranding | null, title: string, body: string): string {
  const s = branding?.settings
  const address = s ? [s.address, s.city, s.state, s.pin_code, s.country].filter(Boolean).join(', ') : ''
  const contact = s ? [s.mobile_number, s.email_id].filter(Boolean).join(' · ') : ''
  const headerBlock = branding?.header
    ? `<img class="hdr-img" src="${branding.header}" alt="" />`
    : `<div class="hdr">
        ${branding?.logo ? `<img class="logo" src="${branding.logo}" alt="" />` : ''}
        <div>
          <div class="org">${esc(s?.company_name || 'Metallurgy Lab')}</div>
          ${address ? `<div class="sub">${esc(address)}</div>` : ''}
          ${contact ? `<div class="sub">${esc(contact)}</div>` : ''}
          ${s?.gst_number ? `<div class="sub">GST: ${esc(s.gst_number)}</div>` : ''}
        </div>
      </div>`
  return `<!doctype html><html><head><meta charset="utf-8" /><title>${esc(title)}</title>
<style>
  @page { size: A4; margin: 14mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; color: #2c3a42; font-size: 11px; line-height: 1.45; margin: 0; }
  .hdr { display: flex; gap: 12px; align-items: center; border-bottom: 2px solid #2f6f6a; padding-bottom: 8px; margin-bottom: 12px; }
  .hdr-img { width: 100%; max-height: 32mm; object-fit: contain; margin-bottom: 10px; }
  .logo { height: 48px; width: auto; }
  .org { font-size: 18px; font-weight: 700; color: #1f2a30; }
  .sub { color: #5b6b73; font-size: 10px; }
  h1 { font-size: 18px; color: #1f2a30; margin: 6px 0 4px; }
  h2 { font-size: 13px; color: #1f2a30; margin: 14px 0 6px; }
  table { border-collapse: collapse; width: 100%; }
  th { background: #2f6f6a; color: #fff; text-align: left; font-weight: 700; }
  th, td { border: 0.4px solid #c5d0d4; padding: 4px 6px; vertical-align: top; }
  tbody tr:nth-child(even) td { background: #f3f6f7; }
  .meta td { border: none; padding: 1px 0; background: none !important; }
  .imgs { display: flex; gap: 8px; }
  .imgs figure { flex: 1; margin: 0; }
  .imgs img { width: 100%; max-height: 70mm; object-fit: contain; border: 1px solid #c5d0d4; }
  figcaption { font-size: 9px; color: #5b6b73; text-align: center; }
  .disclaimer { font-style: italic; margin-top: 16px; }
  .pill { display: inline-block; padding: 2px 8px; font-weight: 700; color: #fff; }
  .pass { background: #15803d; } .fail { background: #b91c1c; } .neutral { background: #64748b; }
  .wm { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; z-index: -1; opacity: 0.08; }
  .wm img { width: 60%; }
  .ftr-img { width: 100%; max-height: 22mm; object-fit: contain; margin-top: 14px; }
</style></head><body>
${branding?.watermark ? `<div class="wm"><img src="${branding.watermark}" alt="" /></div>` : ''}
${headerBlock}
${body}
${branding?.footer ? `<img class="ftr-img" src="${branding.footer}" alt="" />` : ''}
</body></html>`
}
