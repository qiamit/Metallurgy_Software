import { useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CompositionPanel } from '@/features/phase-diagram/CompositionPanel'
import { Diagram, type CompositionLines } from '@/features/phase-diagram/Diagram'
import { NumInput } from '@/features/phase-diagram/NumInput'
import { ReferenceTables } from '@/features/phase-diagram/ReferenceTables'
import {
  FE_C,
  a3,
  acm,
  approxHardness,
  carbonFromPearlite,
  leverRule,
  phaseAt,
  roomTempPhases,
  tieLine,
} from '@/features/phase-diagram/feC'
import { STEEL_PRESETS, andrewsAc1, andrewsAc3, type Composition } from '@/features/phase-diagram/steel'

const C_MAX = FE_C.cementiteC
const T_MIN = 400
const T_MAX = 1600
const TABS = [
  { key: 'diagram', label: 'Diagram' },
  { key: 'reference', label: 'Reference' },
] as const

const fmtC = (c: number) => (c < 0.1 ? c.toFixed(3) : c.toFixed(2))
const DEFAULT_PRESET = STEEL_PRESETS.find((p) => p.grade === 'AISI 1045') ?? STEEL_PRESETS[0]

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-t border-[var(--line)] py-1.5 text-sm">
      <span className="text-[var(--muted)]">{k}</span>
      <span className="font-semibold tabular-nums text-right">{v}</span>
    </div>
  )
}

export default function PhaseDiagramPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'reference' ? 'reference' : 'diagram'
  const [c, setC] = useState(DEFAULT_PRESET.comp.C)
  const [t, setT] = useState(850)
  const [pearlite, setPearlite] = useState(50)
  const [comp, setComp] = useState<Composition>({ ...DEFAULT_PRESET.comp })
  const [grade, setGrade] = useState(DEFAULT_PRESET.grade)

  const field = phaseAt(c, t)
  const tie = tieLine(c, t)
  const lever = leverRule(c)
  const rt = roomTempPhases(c)
  const hv = approxHardness(c)
  const compLines = useMemo<CompositionLines>(
    () => ({ ac1: andrewsAc1(comp), ac3: (cc: number) => andrewsAc3({ ...comp, C: cc }), c: comp.C }),
    [comp],
  )

  function setTab(k: string) {
    const next = new URLSearchParams(params)
    if (k === 'diagram') next.delete('tab')
    else next.set('tab', k)
    setParams(next, { replace: true })
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <h1 className="page-title">Fe–C Phase Diagram</h1>

      <div className="flex gap-1 border-b border-[var(--line)]">
        {TABS.map((tb) => (
          <button
            key={tb.key}
            type="button"
            onClick={() => setTab(tb.key)}
            className={`px-4 py-2 text-sm font-semibold -mb-px border-b-2 ${
              tab === tb.key ? 'border-[var(--accent)] text-[var(--ink)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'reference' ? (
        <ReferenceTables />
      ) : (
        <>
          <div className="grid xl:grid-cols-[1fr_320px] gap-6">
            <div className="card p-4">
              <Diagram
                c={c}
                t={t}
                composition={compLines}
                onSelect={(cc, tt) => {
                  setC(cc)
                  setT(tt)
                }}
              />
            </div>

            <div className="space-y-4">
              <div className="card p-4 space-y-3">
                <h2 className="section-title">Point</h2>
                <label className="field">
                  <span>Carbon, wt %</span>
                  <NumInput value={c} min={0} max={C_MAX} step={0.01} onChange={setC} />
                  <input type="range" min={0} max={C_MAX} step={0.01} value={c} onChange={(e) => setC(Number(e.target.value))} className="w-full" />
                </label>
                <label className="field">
                  <span>Temperature, °C</span>
                  <NumInput value={t} min={T_MIN} max={T_MAX} step={1} onChange={setT} />
                  <input type="range" min={T_MIN} max={T_MAX} step={1} value={t} onChange={(e) => setT(Number(e.target.value))} className="w-full" />
                </label>
                <div>
                  <div className="font-semibold">{field.phases}</div>
                  <div className="text-sm text-[var(--muted)]">{field.note}</div>
                </div>
                <div>
                  <Row k="A₁" v={`${FE_C.eutectoidT} °C`} />
                  <Row k="A₃" v={c <= FE_C.eutectoidC ? `${a3(c).toFixed(0)} °C` : '—'} />
                  <Row k="A_cm" v={c > FE_C.eutectoidC && c <= FE_C.gammaMaxC ? `${acm(c).toFixed(0)} °C` : '—'} />
                  <Row k="°F" v={`${((t * 9) / 5 + 32).toFixed(0)} °F`} />
                </div>
              </div>

              <div className="card p-4 space-y-2">
                <h2 className="section-title">Tie line · {t} °C</h2>
                {tie ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[var(--muted)] text-left">
                        <th className="font-normal py-1">Phase</th>
                        <th className="font-normal py-1 text-right">% C</th>
                        <th className="font-normal py-1 text-right">Mass %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[tie.left, tie.right].map((e) => (
                        <tr key={e.phase} className="border-t border-[var(--line)]">
                          <td className="py-1.5 font-semibold">{e.phase}</td>
                          <td className="py-1.5 text-right tabular-nums">{fmtC(e.c)}</td>
                          <td className="py-1.5 text-right tabular-nums font-semibold">{e.fraction.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <span className="badge badge-muted">Single phase</span>
                )}
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6 items-start">
            <CompositionPanel
              comp={comp}
              grade={grade}
              onChange={(next, g) => {
                setComp(next)
                setGrade(g)
                setC(next.C)
              }}
            />

            <div className="space-y-6">
              <div className="card p-4 space-y-2">
                <h2 className="section-title">Slow-cooled microstructure · {c.toFixed(2)} % C</h2>
                {lever ? (
                  <div>
                    <Row k="Pearlite" v={`${lever.pearlite.toFixed(1)} %`} />
                    {lever.proeutectoidFerrite > 0 && <Row k="Proeutectoid ferrite" v={`${lever.proeutectoidFerrite.toFixed(1)} %`} />}
                    {lever.proeutectoidCementite > 0 && <Row k="Proeutectoid cementite" v={`${lever.proeutectoidCementite.toFixed(1)} %`} />}
                    <Row k="Ferrite (total, RT)" v={`${rt.ferrite.toFixed(1)} %`} />
                    <Row k="Cementite (total, RT)" v={`${rt.cementite.toFixed(1)} %`} />
                    {hv && (
                      <>
                        <Row k="Hardness (approx.)" v={`${hv.low.toFixed(0)}–${hv.high.toFixed(0)} HV`} />
                        <Row k="UTS (approx., 3.3 × HV)" v={`${(hv.low * 3.3).toFixed(0)}–${(hv.high * 3.3).toFixed(0)} MPa`} />
                      </>
                    )}
                  </div>
                ) : (
                  <div>
                    <span className="badge badge-warn">Cast iron — steel lever rule n/a</span>
                    <Row k="Ferrite (total, RT)" v={`${rt.ferrite.toFixed(1)} %`} />
                    <Row k="Cementite (total, RT)" v={`${rt.cementite.toFixed(1)} %`} />
                  </div>
                )}
              </div>

              <div className="card p-4 space-y-2">
                <h2 className="section-title">Carbon from pearlite</h2>
                <label className="field">
                  <span>Pearlite area, %</span>
                  <NumInput value={pearlite} min={0} max={100} step={1} onChange={setPearlite} />
                  <input type="range" min={0} max={100} step={1} value={pearlite} onChange={(e) => setPearlite(Number(e.target.value))} className="w-full" />
                </label>
                <Row k="Carbon" v={`≈ ${carbonFromPearlite(pearlite).toFixed(2)} % C`} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
