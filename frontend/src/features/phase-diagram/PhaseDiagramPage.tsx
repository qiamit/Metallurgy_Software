import { useMemo, useState } from 'react'
import { FE_C, a3, acm, carbonFromPearlite, leverRule, liquidus, phaseAt, solidus } from '@/features/phase-diagram/feC'

const W = 640
const H = 420
const C_MAX = FE_C.cementiteC
const T_MIN = 400
const T_MAX = 1600
const x = (c: number) => 50 + (c / C_MAX) * (W - 70)
const y = (t: number) => H - 30 - ((t - T_MIN) / (T_MAX - T_MIN)) * (H - 50)

function line(points: [number, number][]) {
  return points.map(([c, t], i) => `${i ? 'L' : 'M'}${x(c).toFixed(1)},${y(t).toFixed(1)}`).join(' ')
}

export default function PhaseDiagramPage() {
  const [c, setC] = useState(0.4)
  const [t, setT] = useState(850)
  const [pearlite, setPearlite] = useState(50)
  const field = useMemo(() => phaseAt(c, t), [c, t])
  const lever = useMemo(() => leverRule(c), [c])

  const lines = [
    line([[0, FE_C.a3Fe], [FE_C.eutectoidC, FE_C.eutectoidT]]), // A3
    line([[FE_C.alphaMaxC, FE_C.eutectoidT], [C_MAX, FE_C.eutectoidT]]), // A1
    line([[FE_C.eutectoidC, FE_C.eutectoidT], [FE_C.gammaMaxC, FE_C.eutecticT]]), // Acm
    line([[FE_C.gammaMaxC, FE_C.eutecticT], [C_MAX, FE_C.eutecticT]]), // eutectic
    line([[0, FE_C.meltFe], [FE_C.eutecticC, FE_C.eutecticT], [C_MAX, liquidus(C_MAX)]]), // liquidus
    line([[FE_C.peritecticC, FE_C.peritecticT], [FE_C.gammaMaxC, solidus(FE_C.gammaMaxC)]]), // solidus
    line([[0, FE_C.a3Fe], [FE_C.alphaMaxC, FE_C.eutectoidT]]), // α / α+γ
  ]

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="page-title">Fe–C Phase Diagram</h1>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="card p-4">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Iron carbon phase diagram">
            {[400, 600, 800, 1000, 1200, 1400, 1600].map((tt) => (
              <g key={tt}>
                <line x1={50} x2={W - 20} y1={y(tt)} y2={y(tt)} stroke="var(--line)" />
                <text x={44} y={y(tt) + 4} fontSize="10" textAnchor="end" fill="var(--muted)">{tt}</text>
              </g>
            ))}
            {[0, 1, 2, 3, 4, 5, 6].map((cc) => (
              <g key={cc}>
                <line x1={x(cc)} x2={x(cc)} y1={y(T_MIN)} y2={y(T_MAX)} stroke="var(--line)" />
                <text x={x(cc)} y={H - 14} fontSize="10" textAnchor="middle" fill="var(--muted)">{cc}</text>
              </g>
            ))}
            {lines.map((d, i) => <path key={i} d={d} fill="none" stroke="var(--steel)" strokeWidth={2} />)}
            <text x={x(0.25)} y={y(1000)} fontSize="11" fill="var(--ink)">γ</text>
            <text x={x(3.4)} y={y(1300)} fontSize="11" fill="var(--ink)">L + γ</text>
            <text x={x(1.5)} y={y(600)} fontSize="11" fill="var(--ink)">α + Fe₃C</text>
            <text x={x(4.6)} y={y(950)} fontSize="11" fill="var(--ink)">γ + Fe₃C (ledeburite)</text>
            <text x={x(3.5)} y={y(1550)} fontSize="11" fill="var(--ink)">Liquid</text>
            <text x={(W + 30) / 2} y={H - 1} fontSize="10" textAnchor="middle" fill="var(--muted)">Carbon, wt %</text>
            <circle cx={x(c)} cy={y(t)} r={6} fill="var(--danger)" stroke="white" strokeWidth={2} />
            <line x1={x(c)} x2={x(c)} y1={y(T_MIN)} y2={y(T_MAX)} stroke="var(--danger)" strokeDasharray="3 3" opacity={0.5} />
          </svg>
        </div>

        <div className="space-y-4">
          <div className="card p-4 space-y-3">
            <label className="block text-sm">
              <span className="label">Carbon: {c.toFixed(2)} wt %</span>
              <input type="range" min={0} max={C_MAX} step={0.01} value={c} onChange={(e) => setC(Number(e.target.value))} className="w-full" />
            </label>
            <label className="block text-sm">
              <span className="label">Temperature: {t} °C</span>
              <input type="range" min={T_MIN} max={T_MAX} step={1} value={t} onChange={(e) => setT(Number(e.target.value))} className="w-full" />
            </label>
            <div className="border-t border-[var(--line)] pt-3">
              <div className="text-xs text-[var(--muted)]">Phase field</div>
              <div className="font-semibold">{field.phases}</div>
              <div className="text-sm text-[var(--muted)]">{field.note}</div>
            </div>
            <div className="text-xs text-[var(--muted)] border-t border-[var(--line)] pt-3 space-y-1">
              <div>A₃ at {c.toFixed(2)} % C: {c <= FE_C.eutectoidC ? `${a3(c).toFixed(0)} °C` : '—'}</div>
              <div>A_cm: {c > FE_C.eutectoidC && c <= FE_C.gammaMaxC ? `${acm(c).toFixed(0)} °C` : '—'}</div>
              <div>A₁: {FE_C.eutectoidT} °C</div>
            </div>
          </div>

          <div className="card p-4 space-y-2">
            <div className="font-semibold text-sm">Slow-cooled microstructure (lever rule)</div>
            {lever ? (
              <ul className="text-sm space-y-1">
                <li>Pearlite: <b>{lever.pearlite.toFixed(1)} %</b></li>
                {lever.proeutectoidFerrite > 0 && <li>Proeutectoid ferrite: <b>{lever.proeutectoidFerrite.toFixed(1)} %</b></li>}
                {lever.proeutectoidCementite > 0 && <li>Proeutectoid cementite: <b>{lever.proeutectoidCementite.toFixed(1)} %</b></li>}
              </ul>
            ) : (
              <p className="text-sm text-[var(--muted)]">Cast iron range — steel lever rule does not apply.</p>
            )}
          </div>

          <div className="card p-4 space-y-2">
            <div className="font-semibold text-sm">Carbon estimate from pearlite</div>
            <label className="block text-sm">
              <span className="label">Pearlite area: {pearlite} %</span>
              <input type="range" min={0} max={100} step={1} value={pearlite} onChange={(e) => setPearlite(Number(e.target.value))} className="w-full" />
            </label>
            <p className="text-sm">
              ≈ <b>{carbonFromPearlite(pearlite).toFixed(2)} % C</b>{' '}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
