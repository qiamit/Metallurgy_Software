import type { ReactNode } from 'react'
import { NumInput } from '@/features/phase-diagram/NumInput'
import {
  ELEMENTS,
  STEEL_PRESETS,
  andrewsAc1,
  andrewsAc3,
  bsStevenHaynes,
  ceIIW,
  maxMartensiteHRC,
  mfApprox,
  msAndrews,
  pcm,
  suggestedTemps,
  weldability,
  type Composition,
  type Range,
} from '@/features/phase-diagram/steel'

type Props = {
  comp: Composition
  grade: string
  onChange: (comp: Composition, grade: string) => void
}

const deg = (v: number) => `${v.toFixed(0)} °C`
const rng = ([a, b]: Range) => `${a.toFixed(0)}–${b.toFixed(0)} °C`

export function CompositionPanel({ comp, grade, onChange }: Props) {
  const ce = ceIIW(comp)
  const weld = weldability(ce)
  const hrc = maxMartensiteHRC(comp.C)
  const temps = suggestedTemps(comp)

  const rows: { name: string; value: string; ref: string; extra?: ReactNode }[] = [
    { name: 'Ac₁', value: deg(andrewsAc1(comp)), ref: 'Andrews 1965' },
    { name: 'Ac₃', value: deg(andrewsAc3(comp)), ref: 'Andrews 1965' },
    { name: 'Ms', value: deg(msAndrews(comp)), ref: 'Andrews linear' },
    { name: 'Mf', value: `≈ ${deg(mfApprox(comp))}`, ref: 'Ms − 215' },
    { name: 'Bs', value: deg(bsStevenHaynes(comp)), ref: 'Steven & Haynes 1956' },
    {
      name: 'CE',
      value: ce.toFixed(2),
      ref: 'IIW',
      extra: <span className={`badge badge-${weld.tone}`}>{weld.label}</span>,
    },
    { name: 'Pcm', value: pcm(comp).toFixed(3), ref: 'Ito–Bessyo' },
    {
      name: 'Max HRC (100 % M)',
      value: `≈ ${hrc.hrc.toFixed(0)} HRC`,
      ref: 'Just',
      extra: hrc.capped ? <span className="badge badge-warn">C &gt; 0.6 capped</span> : undefined,
    },
    { name: 'Hardening', value: rng(temps.hardening), ref: comp.C <= 0.77 ? 'Ac₃ + 30…50' : 'Ac₁ + 30…50' },
    { name: 'Normalising', value: rng(temps.normalising), ref: comp.C <= 0.77 ? 'Ac₃ + 30…80' : 'A_cm + 30…80' },
    { name: 'Full annealing', value: rng(temps.annealing), ref: comp.C <= 0.77 ? 'Ac₃ + 30…50' : 'Ac₁ + 30…50' },
  ]

  return (
    <div className="card p-4 space-y-4">
      <h2 className="section-title">Steel composition</h2>
      <label className="field">
        <span>Grade</span>
        <select
          className="input"
          value={grade}
          onChange={(e) => {
            const p = STEEL_PRESETS.find((s) => s.grade === e.target.value)
            if (p) onChange({ ...p.comp }, p.grade)
            else onChange(comp, '')
          }}
        >
          <option value="">Custom</option>
          {STEEL_PRESETS.map((p) => (
            <option key={p.grade} value={p.grade}>{p.grade}</option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-5 gap-2">
        {ELEMENTS.map((el) => (
          <label key={el} className="field">
            <span>{el}</span>
            <NumInput
              value={comp[el]}
              min={0}
              max={el === 'C' ? 2.11 : 30}
              step={el === 'B' ? 0.0005 : 0.01}
              ariaLabel={`${el} wt %`}
              onChange={(v) => onChange({ ...comp, [el]: v }, '')}
            />
          </label>
        ))}
      </div>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-t border-[var(--line)]">
              <td className="py-1.5 pr-2 text-[var(--muted)]">{r.name}</td>
              <td className="py-1.5 pr-2 font-semibold tabular-nums">
                {r.value} {r.extra}
              </td>
              <td className="py-1.5 text-right">
                <span className="badge badge-muted">{r.ref}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
