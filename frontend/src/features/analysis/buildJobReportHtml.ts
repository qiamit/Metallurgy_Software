import { esc, wrapLabReport } from '@/lib/reportHtml'
import type { LabBranding } from '@/features/settings/labSettingsApi'
import { ANALYSIS_LABELS, type AnalysisJob } from '@/types'
import { formatStatus } from '@/lib/text'
import { formatResult, formatRowValue } from '@/features/analysis/resultFormat'

/** Lab-branded job report: images with legend, key results, details, warnings and review status. */
export function buildJobReportHtml(opts: {
  job: AnalysisJob
  sampleCode: string
  branding: LabBranding | null
  sourceDataUrl: string
  overlayDataUrl: string
  reviewerName: string
}): string {
  const { job } = opts
  const fr = formatResult(job.analysis_type, job.software_result)
  const kpis = fr.headline
    .map((h) => `<div class="kpi"><div class="k">${esc(h.label)}</div><div class="v">${esc(h.value)}${h.unit ? ` <small>${esc(h.unit)}</small>` : ''}</div></div>`)
    .join('')
  const details = fr.details.map((d) => `<tr><td style="width:50%">${esc(d.label)}</td><td>${esc(formatRowValue(d))}</td></tr>`).join('')
  const warnings = fr.warnings.map((w) => `<p class="warn">${esc(w)}</p>`).join('')
  const legend = fr.legend.length
    ? `<div class="legend">${fr.legend.map((l) => `<span><i style="background:${l.color}"></i>${esc(l.label)}</span>`).join('')}</div>`
    : ''
  const r = (job.software_result ?? {}) as Record<string, unknown>
  const jk = r.jk_rating as Record<'A' | 'B' | 'C' | 'D', { thin: number; heavy: number }> | undefined
  const jkTable =
    job.analysis_type === 'inclusion' && jk
      ? `<table class="c"><thead><tr><th>Series</th><th>A</th><th>B</th><th>C</th><th>D</th><th>DS</th></tr></thead><tbody>${(['thin', 'heavy'] as const)
          .map(
            (s) =>
              `<tr><td>${s === 'thin' ? 'Thin' : 'Heavy'}</td>${(['A', 'B', 'C', 'D'] as const).map((t) => `<td>${esc(jk[t][s])}</td>`).join('')}<td>${s === 'heavy' ? esc(r.ds_rating ?? 0) : '—'}</td></tr>`,
          )
          .join('')}</tbody></table>`
      : ''
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
          ${opts.overlayDataUrl ? `<figure><img src="${opts.overlayDataUrl}" alt="" /><figcaption>Software Overlay</figcaption>${legend}</figure>` : ''}
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
    <h2>Software Analysis${fr.standard ? ` <small>· ${esc(fr.standard)}</small>` : ''}</h2>
    <style>
      .kpis { display: flex; gap: 6px; margin-bottom: 8px; }
      .kpi { flex: 1; border: 1px solid #c5d0d4; padding: 5px 8px; }
      .kpi .k { font-size: 9px; color: #5b6b73; }
      .kpi .v { font-size: 15px; font-weight: 700; }
      .kpi small, h2 small { font-weight: 400; color: #5b6b73; }
      .warn { border-left: 3px solid #d97706; background: #fef3c7; padding: 4px 8px; margin: 6px 0; }
      .legend { display: flex; flex-wrap: wrap; gap: 4px 10px; font-size: 9px; margin-top: 3px; }
      .legend i { display: inline-block; width: 8px; height: 8px; margin-right: 3px; vertical-align: middle; }
      table.c td, table.c th { text-align: center; }
      table.c { margin-bottom: 8px; }
    </style>
    <div class="kpis">${kpis}</div>
    ${warnings}
    ${jkTable}
    <table><tbody>${details}</tbody></table>
    <p class="disclaimer">Software analysis per the cited standard; results require review by a qualified metallurgist.</p>`
  return wrapLabReport(opts.branding, `Report ${job.id}`, body)
}
