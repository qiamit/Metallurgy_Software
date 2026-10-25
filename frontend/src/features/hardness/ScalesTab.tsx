import { G, ROCKWELL_SCALES, VICKERS_FORCES_KGF, vickersRange } from '@/features/hardness/calc'
import { BRINELL_RATIO_GUIDE } from '@/features/hardness/references'
import { CardHead } from '@/features/hardness/ui'

const th = 'text-left px-3 py-2'
const td = 'px-3 py-1.5'

export function ScalesTab() {
  return (
    <div className="space-y-6">
      <section className="card p-5">
        <CardHead title="Rockwell scales" badge="ISO 6508-1 · ASTM E18" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="table-head">
              <tr>
                <th className={th}>Scale</th>
                <th className={th}>Indenter</th>
                <th className={`${th} text-right normal-case`}>Preliminary kgf</th>
                <th className={`${th} text-right normal-case`}>Total kgf</th>
                <th className={th}>Typical use</th>
              </tr>
            </thead>
            <tbody>
              {ROCKWELL_SCALES.map((s, i) => (
                <tr
                  key={s.key}
                  className={`border-t ${s.superficial && !ROCKWELL_SCALES[i - 1]?.superficial ? 'border-[var(--line-strong)]' : 'border-[var(--line)]'}`}
                >
                  <td className={`${td} font-medium`}>
                    HR{s.key}
                    {s.superficial && <span className="badge badge-muted ml-2">Superficial</span>}
                  </td>
                  <td className={td}>{s.indenter}</td>
                  <td className={`${td} text-right font-mono`}>{s.preKgf}</td>
                  <td className={`${td} text-right font-mono`}>{s.totalKgf}</td>
                  <td className={`${td} text-[var(--muted)]`}>{s.use}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <CardHead title="Vickers forces" badge="ISO 6507-1" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-head">
                <tr>
                  <th className={th}>Symbol</th>
                  <th className={`${th} text-right`}>F (N)</th>
                  <th className={`${th} text-right normal-case`}>F (kgf)</th>
                  <th className={th}>Range</th>
                </tr>
              </thead>
              <tbody>
                {VICKERS_FORCES_KGF.map((f) => (
                  <tr key={f} className="border-t border-[var(--line)]">
                    <td className={`${td} font-medium`}>HV{f}</td>
                    <td className={`${td} text-right font-mono`}>{+(f * G).toPrecision(4)}</td>
                    <td className={`${td} text-right font-mono`}>{f}</td>
                    <td className={`${td} text-[var(--muted)]`}>{vickersRange(f)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card p-5 self-start">
          <CardHead title="Brinell force-diameter ratio" badge="ISO 6506-1" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-head">
                <tr>
                  <th className={th}>Material</th>
                  <th className={th}>Hardness</th>
                  <th className={`${th} text-right normal-case`}>0.102·F/D²</th>
                </tr>
              </thead>
              <tbody>
                {BRINELL_RATIO_GUIDE.map((r) => (
                  <tr key={r.material + r.range} className="border-t border-[var(--line)]">
                    <td className={td}>{r.material}</td>
                    <td className={`${td} text-[var(--muted)]`}>{r.range}</td>
                    <td className={`${td} text-right font-mono`}>{r.ratios}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
