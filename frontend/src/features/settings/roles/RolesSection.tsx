import { ROLE_DESCRIPTIONS } from '@/lib/roles'
import { ANALYSIS_LABELS, type AnalysisType } from '@/types'

const PERMISSIONS: [string, string][] = [
  ['Viewer', 'Dashboard, calibrations, samples, jobs, ring tests and PDF reports (read-only)'],
  ['Analyst', 'Capture & run analysis, create / edit calibrations and samples, re-run analysis, delete jobs and ring tests'],
  ['Reviewer', 'Everything an Analyst can do, plus approve / reject jobs'],
  ['Admin', 'Users, Laboratory Setting, audit log, delete calibrations and samples'],
  ['Owner', 'Everything, including granting the Owner role'],
]

export function RolesSection() {
  return (
    <section className="card p-6 space-y-4">
      <ul className="text-sm text-[var(--muted)] space-y-1.5">
        {ROLE_DESCRIPTIONS.map((r) => (
          <li key={r.role}>
            <b className="text-[var(--ink)]">{r.label}</b> — {r.text}
          </li>
        ))}
      </ul>
      <div className="border-t border-[var(--line)] pt-4">
        <h3 className="text-sm font-semibold mb-2">What Each Role Can Do</h3>
        <table className="w-full text-sm">
          <tbody>
            {PERMISSIONS.map(([role, text]) => (
              <tr key={role} className="border-t border-[var(--line)]">
                <td className="py-2 pr-4 font-medium w-28">{role}</td>
                <td className="py-2 text-[var(--muted)]">{text}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Each role includes everything below it. The database enforces these rules for every request.
        </p>
      </div>
      <div className="border-t border-[var(--line)] pt-4">
        <h3 className="text-sm font-semibold mb-2">Analysis Modules</h3>
        <ul className="text-sm text-[var(--muted)] space-y-1">
          {(Object.keys(ANALYSIS_LABELS) as AnalysisType[]).map((key) => (
            <li key={key}>{ANALYSIS_LABELS[key]}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}
