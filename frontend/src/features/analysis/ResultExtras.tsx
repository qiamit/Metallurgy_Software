import type { AnalysisJob } from '@/types'

type JkRating = Record<'A' | 'B' | 'C' | 'D', { thin: number; heavy: number }>

/** JK rating table (worst field) for inclusion jobs. */
export function ResultExtras({ job }: { job: AnalysisJob }) {
  const r = (job.software_result ?? {}) as Record<string, unknown>

  if (job.analysis_type === 'inclusion' && r.jk_rating) {
    const jk = r.jk_rating as JkRating
    return (
      <div className="overflow-x-auto">
        <table className="table-grid w-full text-sm">
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

  return null
}
