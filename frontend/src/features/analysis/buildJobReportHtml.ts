import { esc, wrapLabReport } from '@/lib/reportHtml'
import type { LabBranding } from '@/features/settings/labSettingsApi'
import { ANALYSIS_LABELS, type AnalysisJob } from '@/types'
import { formatStatus } from '@/lib/text'

/** Same content as the old reportlab PDF, plus lab branding, images and review status. */
export function buildJobReportHtml(opts: {
  job: AnalysisJob
  sampleCode: string
  branding: LabBranding | null
  sourceDataUrl: string
  overlayDataUrl: string
  reviewerName: string
}): string {
  const { job } = opts
  const rows = Object.entries(job.software_result ?? {})
    .filter(([, v]) => typeof v === 'string' || typeof v === 'number')
    .map(([k, v]) => `<tr><td style="width:50%">${esc(k)}</td><td>${esc(v)}</td></tr>`)
    .join('')
  const reviewed =
    job.status === 'reviewed' || job.status === 'rejected'
      ? `<tr><td><b>Review:</b></td><td>${esc(formatStatus(job.status))}${opts.reviewerName ? ` by ${esc(opts.reviewerName)}` : ''}${
          job.reviewed_at ? ` on ${esc(new Date(job.reviewed_at).toLocaleString())}` : ''
        }${job.review_notes ? ` — ${esc(job.review_notes)}` : ''}</td></tr>`
      : ''
  const images =
    opts.sourceDataUrl || opts.overlayDataUrl
      ? `<div class="imgs">
          ${opts.sourceDataUrl ? `<figure><img src="${opts.sourceDataUrl}" alt="" /><figcaption>Source Image</figcaption></figure>` : ''}
          ${opts.overlayDataUrl ? `<figure><img src="${opts.overlayDataUrl}" alt="" /><figcaption>Software Overlay</figcaption></figure>` : ''}
        </div>`
      : ''
  const generated = new Date().toISOString().slice(0, 16).replace('T', ' ')
  const body = `
    <h1>Metallurgy Analysis Report</h1>
    <table class="meta">
      <tr><td style="width:90px"><b>Sample:</b></td><td>${esc(opts.sampleCode)}</td></tr>
      <tr><td><b>Analysis:</b></td><td>${esc(ANALYSIS_LABELS[job.analysis_type])}</td></tr>
      <tr><td><b>Status:</b></td><td>${esc(formatStatus(job.status))}</td></tr>
      ${reviewed}
      <tr><td><b>Generated:</b></td><td>${esc(generated)} UTC</td></tr>
    </table>
    ${images}
    <h2>Software Analysis</h2>
    <table><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="disclaimer">Software analysis per the cited standard; results require review by a qualified metallurgist.</p>`
  return wrapLabReport(opts.branding, `Report ${job.id}`, body)
}
