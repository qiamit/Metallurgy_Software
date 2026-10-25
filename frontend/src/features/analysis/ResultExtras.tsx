import { carbonFromPearlite } from '@/features/phase-diagram/feC'
import type { AnalysisJob } from '@/types'

type JkRating = Record<'A' | 'B' | 'C' | 'D', { thin: number; heavy: number }>

/** Structured parts of a result that the plain key/value list cannot show. */
export function ResultExtras({ job }: { job: AnalysisJob }) {
  const r = (job.software_result ?? {}) as Record<string, unknown>

  if (job.analysis_type === 'inclusion' && r.jk_rating) {
    const jk = r.jk_rating as JkRating
    return (
      <div className="mt-4">
        <div className="text-xs text-[var(--muted)] mb-1">JK rating (worst field, ISO 4967 / ASTM E45 Method A)</div>
        <table className="w-full text-sm border border-[var(--line)]">
          <thead className="table-head">
            <tr>
              <th className="px-3 py-1.5 text-left">Series</th>
              {(['A', 'B', 'C', 'D'] as const).map((t) => (
                <th key={t} className="px-3 py-1.5 text-center">{t}</th>
              ))}
              <th className="px-3 py-1.5 text-center">DS</th>
            </tr>
          </thead>
          <tbody>
            {(['thin', 'heavy'] as const).map((s) => (
              <tr key={s} className="border-t border-[var(--line)]">
                <td className="px-3 py-1.5 capitalize">{s}</td>
                {(['A', 'B', 'C', 'D'] as const).map((t) => (
                  <td key={t} className="px-3 py-1.5 text-center font-mono">{jk[t][s]}</td>
                ))}
                <td className="px-3 py-1.5 text-center font-mono">{s === 'heavy' ? String(r.ds_rating ?? 0) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (job.analysis_type === 'micro' && typeof r.dark_phase_fraction === 'number') {
    const pearlite = (r.dark_phase_fraction as number) * 100
    return (
      <p className="mt-4 text-sm text-[var(--muted)]">
        If this is a slowly cooled ferrite–pearlite steel (dark phase = pearlite):{' '}
        <b className="text-[var(--ink)]">≈ {carbonFromPearlite(pearlite).toFixed(2)} % C</b> by the lever rule
        (Fe–C diagram).
      </p>
    )
  }
  return null
}
