import { Link } from 'react-router-dom'
import { CircleDot, Droplets, Hexagon, Layers, Microscope, ScanSearch, Spline, Waves, type LucideIcon } from 'lucide-react'
import { ANALYSIS_LABELS, type AnalysisType } from '@/types'

type Module = { key: AnalysisType | 'ring_test'; label: string; standard: string; icon: LucideIcon; to: string }

const ANALYSIS_MODULES: Module[] = [
  { key: 'grain_size', label: ANALYSIS_LABELS.grain_size, standard: 'ASTM E112 · ISO 643', icon: Hexagon, to: '/app/capture?type=grain_size' },
  { key: 'inclusion', label: ANALYSIS_LABELS.inclusion, standard: 'ISO 4967 · ASTM E45', icon: Spline, to: '/app/capture?type=inclusion' },
  { key: 'decarb', label: ANALYSIS_LABELS.decarb, standard: 'ISO 3887', icon: Layers, to: '/app/capture?type=decarb' },
  { key: 'micro', label: ANALYSIS_LABELS.micro, standard: 'Phase fractions', icon: Microscope, to: '/app/capture?type=micro' },
  { key: 'macro', label: ANALYSIS_LABELS.macro, standard: 'IS 10138', icon: ScanSearch, to: '/app/capture?type=macro' },
  { key: 'nodularity', label: ANALYSIS_LABELS.nodularity, standard: 'ISO 945-4 · E2567', icon: Droplets, to: '/app/capture?type=nodularity' },
  { key: 'graphite_flake', label: ANALYSIS_LABELS.graphite_flake, standard: 'ASTM A247', icon: Waves, to: '/app/capture?type=graphite_flake' },
  { key: 'ring_test', label: 'Ring Test (TMT Rebar)', standard: 'IS 1786', icon: CircleDot, to: '/app/ring-test' },
]

/** Analysis module cards: icon, name, standard, job count — click starts that analysis. */
export function ModuleGrid({ counts }: { counts?: Partial<Record<string, number>> }) {
  return (
    <div className="grid gap-3 grid-cols-1 min-[480px]:grid-cols-2 xl:grid-cols-4">
      {ANALYSIS_MODULES.map((m) => {
        const Icon = m.icon
        const n = m.key === 'ring_test' ? undefined : counts?.[m.key]
        return (
          <Link
            key={m.key}
            to={m.to}
            className="card group flex items-center gap-3 p-4 transition-colors hover:border-[var(--accent)]"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center bg-[var(--accent-soft)] text-[var(--accent-ink)] transition-colors group-hover:bg-[var(--accent)] group-hover:text-[var(--accent-on)]">
              <Icon size={20} strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-[var(--ink)]">{m.label}</span>
              <span className="block truncate text-xs text-[var(--muted)]">{m.standard}</span>
            </span>
            {n !== undefined && (
              <span className="shrink-0 text-right">
                <span className="block text-lg font-semibold leading-none text-[var(--ink)]">{n}</span>
                <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Jobs</span>
              </span>
            )}
          </Link>
        )
      })}
    </div>
  )
}
