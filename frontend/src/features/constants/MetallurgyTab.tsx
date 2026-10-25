import { useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { ELEMENTS } from '@/features/periodic-table/elementsData'
import {
  GRAIN_TABLE,
  PPM_PER_PERCENT,
  convertComposition,
  grainFrom,
  parseAtomicMass,
  type CompMode,
  type GrainInput,
} from '@/features/constants/metallurgy'
import { formatSig, parseNum } from '@/features/constants/format'

const MASSES = ELEMENTS.flatMap((el) => {
  const m = parseAtomicMass(el.mass)
  return m == null ? [] : [{ symbol: el.symbol, name: el.name, mass: m }]
})
const MASS_BY_SYMBOL = new Map(MASSES.map((e) => [e.symbol, e.mass]))

interface Row {
  id: number
  symbol: string
  amount: string
}

let nextId = 10

function CompositionCard() {
  const [mode, setMode] = useState<CompMode>('wt-to-at')
  const [rows, setRows] = useState<Row[]>([
    { id: 1, symbol: 'Fe', amount: '' },
    { id: 2, symbol: 'Cr', amount: '18' },
    { id: 3, symbol: 'Ni', amount: '8' },
  ])
  const [balanceId, setBalanceId] = useState<number | null>(1)

  const others = rows.filter((r) => r.id !== balanceId)
  const othersSum = others.reduce((s, r) => s + (Number.isFinite(parseNum(r.amount)) ? parseNum(r.amount) : 0), 0)
  const balance = 100 - othersSum

  const results = useMemo(() => {
    const inputs = rows.map((r) => ({
      symbol: r.symbol,
      mass: MASS_BY_SYMBOL.get(r.symbol) ?? 0,
      amount: r.id === balanceId ? balance : parseNum(r.amount),
    }))
    return convertComposition(inputs, mode)
  }, [rows, balanceId, balance, mode])

  const total = rows.reduce((s, r) => {
    const v = r.id === balanceId ? balance : parseNum(r.amount)
    return s + (Number.isFinite(v) ? v : 0)
  }, 0)

  const update = (id: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const inUnit = mode === 'wt-to-at' ? 'wt %' : 'at %'

  return (
    <div className="card p-4">
      <h2 className="section-title">wt % ↔ at %</h2>
      <div className="flex gap-0 mb-4">
        {(['wt-to-at', 'at-to-wt'] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={`btn ${mode === m ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setMode(m)}
          >
            {m === 'wt-to-at' ? 'wt % → at %' : 'at % → wt %'}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <table className="table-grid w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="text-left px-3 py-2">Element</th>
              <th className="text-center px-3 py-2">{inUnit}</th>
              <th className="px-3 py-2">Bal.</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-[var(--line)]">
                <td className="px-3 py-1.5">
                  <select
                    className="input"
                    aria-label="Element"
                    value={r.symbol}
                    onChange={(e) => update(r.id, { symbol: e.target.value })}
                  >
                    {MASSES.map((e) => (
                      <option key={e.symbol} value={e.symbol}>
                        {e.symbol} — {e.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-1.5">
                  {r.id === balanceId ? (
                    <div className="input flex items-center justify-end font-mono text-[var(--muted)]">
                      {formatSig(balance, 5)}
                    </div>
                  ) : (
                    <input
                      className="input text-center font-mono"
                      inputMode="decimal"
                      aria-label={`${r.symbol} amount`}
                      value={r.amount}
                      onChange={(e) => update(r.id, { amount: e.target.value })}
                    />
                  )}
                </td>
                <td className="px-3 py-1.5 text-center">
                  <input
                    type="radio"
                    name="balance"
                    aria-label={`${r.symbol} balance`}
                    checked={r.id === balanceId}
                    onChange={() => setBalanceId(r.id)}
                    onClick={() => r.id === balanceId && setBalanceId(null)}
                  />
                </td>
                <td className="px-1">
                  <button
                    type="button"
                    aria-label="Remove"
                    className="inline-flex h-7 w-7 items-center justify-center text-[var(--muted)] hover:text-[var(--danger)]"
                    onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}
                  >
                    <X size={14} />
                  </button>
                </td>
              </tr>
            ))}
            <tr className="border-t border-[var(--line)]">
              <td className="px-3 py-2">
                <button
                  type="button"
                  className="btn btn-ghost h-8"
                  onClick={() => setRows((rs) => [...rs, { id: nextId++, symbol: 'C', amount: '' }])}
                >
                  <Plus size={14} /> Add
                </button>
              </td>
              <td className={`px-3 py-2 text-center font-mono ${Math.abs(total - 100) > 1e-6 ? 'text-[var(--warn)]' : 'text-[var(--muted)]'}`}>
                Σ {formatSig(total, 6)}
              </td>
              <td colSpan={2} />
            </tr>
          </tbody>
        </table>

        <table className="table-grid w-full text-sm self-start">
          <thead className="table-head">
            <tr>
              <th className="text-left px-3 py-2">Element</th>
              <th className="text-center px-3 py-2">wt %</th>
              <th className="text-center px-3 py-2">at %</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={`${r.symbol}-${i}`} className="border-t border-[var(--line)]">
                <td className="px-3 py-2 font-medium">{r.symbol}</td>
                <td className="px-3 py-2 text-center font-mono">{r.wt.toFixed(3)}</td>
                <td className="px-3 py-2 text-center font-mono">{r.at.toFixed(3)}</td>
              </tr>
            ))}
            {results.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-center text-[var(--muted)]">
                  —
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PpmCard() {
  const [ppm, setPpm] = useState('500')
  const [pct, setPct] = useState('0.05')

  return (
    <div className="card p-4">
      <h2 className="section-title">ppm ↔ wt %</h2>
      <div className="form-grid">
        <label className="field">
          <span>ppm</span>
          <input
            className="input font-mono"
            inputMode="decimal"
            value={ppm}
            onChange={(e) => {
              setPpm(e.target.value)
              const v = parseNum(e.target.value)
              setPct(Number.isFinite(v) ? formatSig(v / PPM_PER_PERCENT, 8) : '')
            }}
          />
        </label>
        <label className="field">
          <span>wt %</span>
          <input
            className="input font-mono"
            inputMode="decimal"
            value={pct}
            onChange={(e) => {
              setPct(e.target.value)
              const v = parseNum(e.target.value)
              setPpm(Number.isFinite(v) ? formatSig(v * PPM_PER_PERCENT, 8) : '')
            }}
          />
        </label>
      </div>
    </div>
  )
}

const GRAIN_INPUTS: { id: GrainInput; label: string }[] = [
  { id: 'G', label: 'ASTM G' },
  { id: 'l_um', label: 'Mean intercept ℓ (µm)' },
  { id: 'l_mm', label: 'Mean intercept ℓ (mm)' },
  { id: 'NA', label: 'N_A (grains/mm² at 1×)' },
  { id: 'n', label: 'n (grains/in² at 100×)' },
  { id: 'd_um', label: 'Mean diameter d (µm)' },
]

function GrainSizeCard() {
  const [kind, setKind] = useState<GrainInput>('G')
  const [raw, setRaw] = useState('8')
  const r = grainFrom(kind, parseNum(raw))

  const out: { label: string; value: string }[] = r
    ? [
        { label: 'G', value: r.G.toFixed(2) },
        { label: 'ℓ (µm)', value: formatSig(r.lMm * 1000, 4) },
        { label: 'ℓ (mm)', value: formatSig(r.lMm, 4) },
        { label: 'N_A (/mm²)', value: formatSig(r.NA, 4) },
        { label: 'n (/in² at 100×)', value: formatSig(r.n, 4) },
        { label: 'd (µm)', value: formatSig(r.dUm, 4) },
      ]
    : []

  return (
    <div className="card p-4">
      <h2 className="section-title">Grain Size · ASTM E112</h2>
      <div className="form-grid">
        <label className="field">
          <span>Input</span>
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value as GrainInput)}>
            {GRAIN_INPUTS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Value</span>
          <input className="input font-mono" inputMode="decimal" value={raw} onChange={(e) => setRaw(e.target.value)} />
        </label>
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-[var(--line)] border border-[var(--line)]">
        {(r ? out : GRAIN_INPUTS.map((g) => ({ label: g.label, value: '—' }))).map((o) => (
          <div key={o.label} className="bg-[var(--panel)] px-3 py-2">
            <div className="text-xs text-[var(--muted)]">{o.label}</div>
            <div className="font-mono text-base">{o.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="table-grid w-full text-sm max-w-2xl">
          <thead className="table-head">
            <tr>
              <th className="text-left px-3 py-2">G</th>
              <th className="text-center px-3 py-2 normal-case">n /in² at 100×</th>
              <th className="text-center px-3 py-2 normal-case">N_A /mm²</th>
              <th className="text-center px-3 py-2 normal-case">ℓ µm</th>
              <th className="text-center px-3 py-2 normal-case">d µm</th>
            </tr>
          </thead>
          <tbody>
            {GRAIN_TABLE.map(({ label, r: g }) => (
              <tr
                key={label}
                className={`border-t border-[var(--line)] ${r && Math.round(r.G) === g.G ? 'bg-[var(--accent-soft)]' : ''}`}
              >
                <td className="px-3 py-1.5 font-mono">{label}</td>
                <td className="px-3 py-1.5 text-center font-mono">{formatSig(g.n, 4)}</td>
                <td className="px-3 py-1.5 text-center font-mono">{formatSig(g.NA, 4)}</td>
                <td className="px-3 py-1.5 text-center font-mono">{formatSig(g.lMm * 1000, 3)}</td>
                <td className="px-3 py-1.5 text-center font-mono">{formatSig(g.dUm, 3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function MetallurgyTab() {
  return (
    <div className="space-y-6">
      <CompositionCard />
      <div className="grid xl:grid-cols-[20rem_1fr] gap-6 items-start">
        <PpmCard />
        <GrainSizeCard />
      </div>
    </div>
  )
}
