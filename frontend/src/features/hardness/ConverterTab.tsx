import { useMemo, useState } from 'react'
import { Copy } from 'lucide-react'
import {
  INPUT_SCALES,
  KSI_TO_MPA,
  TABLE_LABELS,
  convertHardness,
  getTable,
  resolveTable,
  type Conversion,
  type TableChoice,
} from '@/features/hardness/e140'
import { fmt, num, parseNumberList } from '@/features/hardness/calc'

export type ConverterState = {
  scaleKey: string
  raw: string
  choice: TableChoice
}

const digitsFor = (key: string) => (key.startsWith('HR') ? 1 : 0)

/** Main batch columns: [label, key in hardened table, key in soft table]. HB 3000 kg ≈ HV in the soft table. */
const BATCH_COLS: { label: string; hardened?: string; soft?: string }[] = [
  { label: 'HRC', hardened: 'HRC' },
  { label: 'HRB', soft: 'HRB' },
  { label: 'HV', hardened: 'HV', soft: 'HV' },
  { label: 'HBW', hardened: 'HBW', soft: 'HV' },
  { label: 'TS MPa', hardened: 'TS', soft: 'TS' },
]

function batchCell(conv: Conversion | null, key: string | undefined): number | null {
  if (!conv || !key) return null
  const v = conv.values.find((x) => x.scale.key === key)?.value ?? null
  return v == null ? null : key === 'TS' ? v * KSI_TO_MPA : v
}

function ScaleSelect({ value, onChange, id }: { value: string; onChange: (v: string) => void; id?: string }) {
  return (
    <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      {INPUT_SCALES.map((s) => (
        <option key={s.key} value={s.key}>
          {s.key} — {s.label}
        </option>
      ))}
    </select>
  )
}

function TableSelect({ value, onChange }: { value: TableChoice; onChange: (v: TableChoice) => void }) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value as TableChoice)}>
      <option value="auto">Auto</option>
      <option value="hardened">{TABLE_LABELS.hardened}</option>
      <option value="soft">{TABLE_LABELS.soft}</option>
    </select>
  )
}

export function ConverterTab({ state, onChange }: { state: ConverterState; onChange: (s: ConverterState) => void }) {
  const { scaleKey, raw, choice } = state
  const value = num(raw)
  const table = resolveTable(choice, scaleKey, value)
  const conversion = useMemo(() => convertHardness(table, scaleKey, value), [table, scaleKey, value])
  const inTable = getTable(table).scales.some((s) => s.key === scaleKey)

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <h2 className="section-title">Convert</h2>
        <div className="form-grid">
          <label className="field">
            <span>Scale</span>
            <ScaleSelect value={scaleKey} onChange={(v) => onChange({ ...state, scaleKey: v })} />
          </label>
          <label className="field">
            <span>Value</span>
            <input className="input" type="number" step="0.1" value={raw} onChange={(e) => onChange({ ...state, raw: e.target.value })} />
          </label>
          <label className="field">
            <span>Table</span>
            <TableSelect value={choice} onChange={(v) => onChange({ ...state, choice: v })} />
          </label>
        </div>
      </section>

      {conversion ? (
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-[var(--line)] text-sm">
            <span className="font-medium">{TABLE_LABELS[table]}</span>
            <span className={`badge ${conversion.exactRow ? 'badge-ok' : 'badge-muted'}`}>{conversion.exactRow ? 'Table row' : 'Interpolated'}</span>
            <span className="badge badge-muted ml-auto">ASTM E140</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-head">
                <tr>
                  <th className="text-left px-4 py-2.5">Scale</th>
                  <th className="text-left px-4 py-2.5">Description</th>
                  <th className="text-right px-4 py-2.5">Value</th>
                </tr>
              </thead>
              <tbody>
                {conversion.values.flatMap(({ scale, value: v }) => {
                  const rows = [
                    { key: scale.key, label: scale.label, text: scale.key === 'TS' ? (v == null ? '—' : `${fmt(v, 0)} ksi`) : fmt(v, digitsFor(scale.key)) },
                  ]
                  if (scale.key === 'TS') rows.push({ key: 'TS-MPa', label: 'Tensile strength (approx.)', text: v == null ? '—' : `${fmt(v * KSI_TO_MPA, 0)} MPa` })
                  return rows.map((r) => (
                    <tr key={r.key} className={`border-t border-[var(--line)] ${r.key === scaleKey ? 'bg-[var(--accent-soft)]' : ''}`}>
                      <td className="px-4 py-2 font-medium">{r.key === 'TS-MPa' ? 'TS' : r.key}</td>
                      <td className="px-4 py-2 text-[var(--muted)]">{r.label}</td>
                      <td className="px-4 py-2 text-right font-mono">{r.text}</td>
                    </tr>
                  ))
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <p className="card p-4 text-sm text-[var(--warn)]">
          {!Number.isFinite(value)
            ? 'Enter a number.'
            : !inTable
              ? `${scaleKey} is not in the ${TABLE_LABELS[table].toLowerCase()} table.`
              : 'Outside the ASTM E140 range for this scale.'}
        </p>
      )}

      <BatchCard initialScale={scaleKey} />
    </div>
  )
}

function BatchCard({ initialScale }: { initialScale: string }) {
  const [scaleKey, setScaleKey] = useState(initialScale)
  const [choice, setChoice] = useState<TableChoice>('auto')
  const [text, setText] = useState('')
  const [copied, setCopied] = useState(false)

  const values = useMemo(() => parseNumberList(text), [text])
  const rows = useMemo(
    () =>
      values.map((v) => {
        const table = resolveTable(choice, scaleKey, v)
        return { input: v, table, conv: convertHardness(table, scaleKey, v) }
      }),
    [values, choice, scaleKey],
  )
  const cols = BATCH_COLS.filter((c) => rows.some((r) => r.conv && c[r.table]))

  function cells(r: (typeof rows)[number]) {
    return cols.map((c) => batchCell(r.conv, c[r.table]))
  }

  async function copyCsv() {
    const header = [scaleKey, 'Table', ...cols.map((c) => c.label)].join(',')
    const lines = rows.map((r) =>
      [r.input, r.conv ? TABLE_LABELS[r.table] : 'out of range', ...cells(r).map((v, i) => (v == null ? '' : v.toFixed(cols[i].label.startsWith('HR') ? 1 : 0)))].join(','),
    )
    try {
      await navigator.clipboard.writeText([header, ...lines].join('\n'))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="card p-5">
      <h2 className="section-title">Batch</h2>
      <div className="grid gap-4 md:grid-cols-[18rem_1fr]">
        <div className="space-y-3">
          <label className="field">
            <span>Scale</span>
            <ScaleSelect value={scaleKey} onChange={setScaleKey} />
          </label>
          <label className="field">
            <span>Table</span>
            <TableSelect value={choice} onChange={setChoice} />
          </label>
          <label className="field">
            <span>Values</span>
            <textarea className="input font-mono min-h-[9rem]" value={text} onChange={(e) => setText(e.target.value)} placeholder={'45\n48.5\n52'} />
          </label>
          <button type="button" className="btn btn-ghost w-full" disabled={!rows.length} onClick={copyCsv}>
            <Copy size={14} /> {copied ? 'Copied' : 'Copy CSV'}
          </button>
        </div>
        <div className="overflow-x-auto border border-[var(--line)] self-start">
          <table className="w-full text-sm">
            <thead className="table-head">
              <tr>
                <th className="text-left px-3 py-2">{scaleKey}</th>
                {cols.map((c) => (
                  <th key={c.label} className="text-right px-3 py-2">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td className="px-3 py-3 text-[var(--muted)]" colSpan={cols.length + 1}>
                    No values
                  </td>
                </tr>
              )}
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-[var(--line)]">
                  <td className="px-3 py-1.5 font-mono">{r.input}</td>
                  {r.conv ? (
                    cells(r).map((v, j) => (
                      <td key={cols[j].label} className="px-3 py-1.5 text-right font-mono">
                        {fmt(v, cols[j].label.startsWith('HR') ? 1 : 0)}
                      </td>
                    ))
                  ) : (
                    <td className="px-3 py-1.5 text-[var(--warn)]" colSpan={Math.max(cols.length, 1)}>
                      Out of range
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
