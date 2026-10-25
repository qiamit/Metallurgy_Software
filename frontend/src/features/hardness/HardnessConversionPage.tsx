import { useMemo, useState } from 'react'
import { INPUT_SCALES, KSI_TO_MPA, convertHardness, pickTable } from '@/features/hardness/e140'

function fmt(v: number | null, digits = 1) {
  return v == null ? '—' : v.toFixed(digits)
}

export default function HardnessConversionPage() {
  const [scaleKey, setScaleKey] = useState('HRC')
  const [raw, setRaw] = useState('40')
  const value = Number(raw)
  const table = pickTable(scaleKey, value)
  const conversion = useMemo(() => convertHardness(table, scaleKey, value), [table, scaleKey, value])

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="page-title">Hardness Conversion</h1>
        <p className="page-subtitle">
          Approximate conversions per ASTM E140 (from the lab&apos;s conversion chart). Values between table rows are
          interpolated linearly; nothing outside the table range is extrapolated.
        </p>
      </div>

      <div className="card p-6 grid md:grid-cols-3 gap-4 items-end">
        <div>
          <label className="text-xs text-[var(--muted)]" htmlFor="hc-scale">
            Measured Scale
          </label>
          <select id="hc-scale" className="input mt-1" value={scaleKey} onChange={(e) => setScaleKey(e.target.value)}>
            {INPUT_SCALES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.key} — {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-[var(--muted)]" htmlFor="hc-value">
            Value
          </label>
          <input
            id="hc-value"
            className="input mt-1"
            type="number"
            step="0.1"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
          />
        </div>
        <div className="text-sm text-[var(--muted)]">
          Table: <b className="text-[var(--ink)]">{table === 'hardened' ? 'Hardened steel & hard alloys' : 'Soft steel, cast iron & non-ferrous'}</b>
        </div>
      </div>

      {conversion ? (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="table-head">
              <tr>
                <th className="text-left px-4 py-3">Scale</th>
                <th className="text-left px-4 py-3">Description</th>
                <th className="text-right px-4 py-3">Value</th>
              </tr>
            </thead>
            <tbody>
              {conversion.values.map(({ scale, value: v }) => (
                <tr key={scale.key} className={`border-t border-[var(--line)] ${scale.key === scaleKey ? 'bg-[var(--accent-soft)]' : ''}`}>
                  <td className="px-4 py-2 font-medium">{scale.key}</td>
                  <td className="px-4 py-2 text-[var(--muted)]">{scale.label}</td>
                  <td className="px-4 py-2 text-right font-mono">
                    {scale.unit === 'ksi' && v != null ? `${fmt(v, 0)} ksi ≈ ${fmt(v * KSI_TO_MPA, 0)} MPa` : fmt(v, scale.key.startsWith('H') && !scale.key.startsWith('HR') ? 0 : 1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="card p-4 text-sm text-[var(--warn)]">
          {Number.isFinite(value) ? 'Value is outside the ASTM E140 table range for this scale.' : 'Enter a number.'}
        </p>
      )}

      <p className="text-xs text-[var(--muted)]">
        Conversions are approximate and material-dependent (ASTM E140). Report the measured scale as the result; use
        converted values for guidance only.
      </p>
    </div>
  )
}
