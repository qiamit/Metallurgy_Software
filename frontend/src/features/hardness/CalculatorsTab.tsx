import { useState } from 'react'
import {
  BRINELL_BALLS_MM,
  BRINELL_RATIOS,
  G,
  ROCKWELL_SCALES,
  VICKERS_FORCES_KGF,
  brinell,
  brinellForceKgf,
  brinellNotation,
  brinellSpacing,
  fmt,
  knoop,
  num,
  rockwellDepth,
  tensileFromHB,
  vickers,
  vickersNotation,
  vickersSpacing,
} from '@/features/hardness/calc'
import { KSI_TO_MPA, convertHardness, pickTable } from '@/features/hardness/e140'
import { CardHead, ResultList } from '@/features/hardness/ui'

type LenUnit = 'um' | 'mm'
const toMm = (v: number, u: LenUnit) => (u === 'um' ? v / 1000 : v)

function UnitSelect({ value, onChange }: { value: LenUnit; onChange: (u: LenUnit) => void }) {
  return (
    <label className="field">
      <span>Unit</span>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value as LenUnit)}>
        <option value="um">µm</option>
        <option value="mm">mm</option>
      </select>
    </label>
  )
}

function NumField({ label, value, onChange, step = 'any' }: { label: string; value: string; onChange: (v: string) => void; step?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input className="input" type="number" min="0" step={step} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

const calcGrid = 'grid gap-3 grid-cols-2'

function VickersCard() {
  const [kgf, setKgf] = useState(10)
  const [unit, setUnit] = useState<LenUnit>('um')
  const [d1, setD1] = useState('200')
  const [d2, setD2] = useState('200')
  const r = vickers(kgf, toMm(num(d1), unit), toMm(num(d2), unit))
  const sp = r ? vickersSpacing(r.d, false) : null
  const spLight = r ? vickersSpacing(r.d, true) : null

  return (
    <section className="card p-5">
      <CardHead title="Vickers" badge="ISO 6507-1 · ASTM E92" />
      <div className={calcGrid}>
        <label className="field">
          <span>Force</span>
          <select className="input" value={kgf} onChange={(e) => setKgf(Number(e.target.value))}>
            {VICKERS_FORCES_KGF.map((f) => (
              <option key={f} value={f}>
                HV{f} · {f} kgf
              </option>
            ))}
          </select>
        </label>
        <UnitSelect value={unit} onChange={setUnit} />
        <NumField label="d1" value={d1} onChange={setD1} />
        <NumField label="d2" value={d2} onChange={setD2} />
      </div>
      {r && (
        <ResultList
          items={[
            { label: 'Hardness', value: vickersNotation(r.hv, kgf), tone: 'main' },
            { label: 'HV', value: fmt(r.hv, 1) },
            { label: 'Mean d', value: `${fmt(r.d * 1000, 1)} µm` },
            { label: 'Depth ≈ d/7', value: `${fmt((r.d / 7) * 1000, 1)} µm` },
            {
              label: 'd1/d2 difference',
              value: `${fmt(r.asymmetry * 100, 1)} %${r.asymmetry > 0.05 ? ' > 5 %' : ''}`,
              tone: r.asymmetry > 0.05 ? 'warn' : undefined,
            },
            ...(sp && spLight
              ? [
                  { label: 'Min thickness (1.5d)', value: `${fmt(sp.thickness, 3)} mm` },
                  { label: 'Centre spacing steel/Cu · light', value: `${fmt(sp.centre, 3)} · ${fmt(spLight.centre, 3)} mm` },
                  { label: 'Edge distance steel/Cu · light', value: `${fmt(sp.edge, 3)} · ${fmt(spLight.edge, 3)} mm` },
                ]
              : []),
          ]}
        />
      )}
    </section>
  )
}

function BrinellCard() {
  const [D, setD] = useState(10)
  const [ratio, setRatio] = useState(30)
  const [d1, setD1] = useState('4.00')
  const [d2, setD2] = useState('4.00')
  const kgf = brinellForceKgf(D, ratio)
  const r = brinell(D, kgf, num(d1), num(d2))
  const sp = r ? brinellSpacing(D, r.d) : null

  return (
    <section className="card p-5">
      <CardHead title="Brinell" badge="ISO 6506-1 · ASTM E10" />
      <div className={calcGrid}>
        <label className="field">
          <span>Ball D</span>
          <select className="input" value={D} onChange={(e) => setD(Number(e.target.value))}>
            {BRINELL_BALLS_MM.map((b) => (
              <option key={b} value={b}>
                {b} mm
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Force (ratio)</span>
          <select className="input" value={ratio} onChange={(e) => setRatio(Number(e.target.value))}>
            {BRINELL_RATIOS.map((q) => (
              <option key={q} value={q}>
                {+brinellForceKgf(D, q).toFixed(3)} kgf ({q})
              </option>
            ))}
          </select>
        </label>
        <NumField label="d1 mm" value={d1} onChange={setD1} />
        <NumField label="d2 mm" value={d2} onChange={setD2} />
      </div>
      {r && (
        <ResultList
          items={[
            { label: 'Hardness', value: brinellNotation(r.hbw, D, kgf), tone: 'main' },
            { label: 'HBW', value: fmt(r.hbw, 1) },
            { label: 'Force', value: `${fmt((kgf * G) / 1000, 3)} kN` },
            { label: 'Mean d', value: `${fmt(r.d, 3)} mm` },
            {
              label: 'd/D (0.24–0.6)',
              value: `${fmt(r.dOverD, 3)}${r.valid ? '' : ' invalid'}`,
              tone: r.valid ? undefined : 'warn',
            },
            { label: 'Depth h', value: `${fmt(r.depth, 3)} mm` },
            ...(sp
              ? [
                  { label: 'Min thickness (8h)', value: `${fmt(sp.thickness, 2)} mm` },
                  { label: 'Centre spacing (3d)', value: `${fmt(sp.centre, 2)} mm` },
                  { label: 'Edge distance (2.5d)', value: `${fmt(sp.edge, 2)} mm` },
                ]
              : []),
          ]}
        />
      )}
    </section>
  )
}

function KnoopCard() {
  const [force, setForce] = useState('500')
  const [fUnit, setFUnit] = useState<'gf' | 'kgf'>('gf')
  const [L, setL] = useState('100')
  const kgf = fUnit === 'gf' ? num(force) / 1000 : num(force)
  const hk = knoop(kgf, num(L) / 1000)

  return (
    <section className="card p-5">
      <CardHead title="Knoop" badge="ISO 4545 · ASTM E92" />
      <div className={calcGrid}>
        <NumField label="Force" value={force} onChange={setForce} />
        <label className="field">
          <span>Unit</span>
          <select className="input" value={fUnit} onChange={(e) => setFUnit(e.target.value as 'gf' | 'kgf')}>
            <option value="gf">gf</option>
            <option value="kgf">kgf</option>
          </select>
        </label>
        <NumField label="L µm" value={L} onChange={setL} />
      </div>
      {hk != null && (
        <ResultList
          items={[
            { label: 'Hardness', value: `${Math.round(hk)} HK${+kgf.toFixed(3)}`, tone: 'main' },
            { label: 'HK', value: fmt(hk, 1) },
          ]}
        />
      )}
    </section>
  )
}

function RockwellCard() {
  const [scale, setScale] = useState('C')
  const [hr, setHr] = useState('60')
  const r = rockwellDepth(scale, num(hr))

  return (
    <section className="card p-5">
      <CardHead title="Rockwell depth" badge="ISO 6508-1" />
      <div className={calcGrid}>
        <label className="field">
          <span>Scale</span>
          <select className="input" value={scale} onChange={(e) => setScale(e.target.value)}>
            {ROCKWELL_SCALES.map((s) => (
              <option key={s.key} value={s.key}>
                HR{s.key}
              </option>
            ))}
          </select>
        </label>
        <NumField label="Reading" value={hr} onChange={setHr} step="0.1" />
      </div>
      {r && (
        <ResultList
          items={[
            { label: 'Depth h', value: `${fmt(r.depth * 1000, 0)} µm`, tone: 'main' },
            { label: `Min thickness (${r.factor}h)`, value: `${fmt(r.minThickness, 2)} mm` },
          ]}
        />
      )}
    </section>
  )
}

function TensileCard() {
  const [scale, setScale] = useState<'HV' | 'HBW'>('HBW')
  const [raw, setRaw] = useState('229')
  const v = num(raw)
  const conv = Number.isFinite(v) ? convertHardness(pickTable(scale, v), scale, v) : null
  const pick = (key: string) => conv?.values.find((x) => x.scale.key === key)?.value ?? null
  const tsKsi = pick('TS')
  // In the soft table the 3000 kg Brinell column is the HV column (HB ≈ HV there).
  const hb = scale === 'HBW' ? v : conv ? (conv.table === 'soft' ? pick('HV') : pick('HBW')) : null
  const approx = hb != null && hb <= 400 ? tensileFromHB(hb) : null

  return (
    <section className="card p-5">
      <CardHead title="Tensile strength" badge="Steel" />
      <div className={calcGrid}>
        <label className="field">
          <span>Scale</span>
          <select className="input" value={scale} onChange={(e) => setScale(e.target.value as 'HV' | 'HBW')}>
            <option value="HBW">HBW</option>
            <option value="HV">HV</option>
          </select>
        </label>
        <NumField label="Value" value={raw} onChange={setRaw} />
      </div>
      {Number.isFinite(v) && v > 0 && (
        <ResultList
          items={[
            { label: 'E140', value: tsKsi == null ? 'out of range' : `${fmt(tsKsi * KSI_TO_MPA, 0)} MPa`, tone: tsKsi == null ? 'warn' : 'main' },
            ...(scale === 'HV' ? [{ label: 'HB (E140)', value: fmt(hb, 0) }] : []),
            {
              label: '3.45·HB approx.',
              value: approx == null ? (hb != null && hb > 400 ? 'HB > 400' : '—') : `${fmt(approx, 0)} MPa`,
            },
          ]}
        />
      )}
    </section>
  )
}

export function CalculatorsTab() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <VickersCard />
      <BrinellCard />
      <KnoopCard />
      <RockwellCard />
      <TensileCard />
    </div>
  )
}
