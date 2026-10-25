import { useState } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { CATEGORY_BY_ID, UNIT_CATEGORIES, convert } from '@/features/constants/units'
import { formatSig, parseNum } from '@/features/constants/format'
import CopyButton from '@/features/constants/CopyButton'

export default function UnitConverterTab() {
  const [catId, setCatId] = useState('stress')
  const [raw, setRaw] = useState('1')
  const [from, setFrom] = useState('ksi')
  const [to, setTo] = useState('MPa')
  const [sig, setSig] = useState(6)

  const cat = CATEGORY_BY_ID.get(catId) ?? UNIT_CATEGORIES[0]
  const value = parseNum(raw)
  const valid = Number.isFinite(value)
  const pair = valid ? convert(cat, from, to, value) : NaN

  function changeCategory(id: string) {
    const next = CATEGORY_BY_ID.get(id)
    if (!next) return
    setCatId(id)
    setFrom(next.units[0].id)
    setTo(next.units[1]?.id ?? next.units[0].id)
  }

  return (
    <div className="space-y-6">
      <div className="card p-4">
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="field">
            <span>Quantity</span>
            <select className="input" value={catId} onChange={(e) => changeCategory(e.target.value)}>
              {UNIT_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Value</span>
            <input className="input font-mono" inputMode="decimal" value={raw} onChange={(e) => setRaw(e.target.value)} />
          </label>
          <label className="field">
            <span>From</span>
            <select className="input" value={from} onChange={(e) => setFrom(e.target.value)}>
              {cat.units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Significant Digits</span>
            <select className="input" value={sig} onChange={(e) => setSig(Number(e.target.value))}>
              {[3, 4, 5, 6, 8, 10, 12].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 pt-4 border-t border-[var(--line)] flex flex-wrap items-end gap-3">
          <div className="text-sm font-mono">
            {valid ? formatSig(value, sig) : '—'} {from}
          </div>
          <button
            type="button"
            className="btn btn-ghost h-8 px-2"
            title="Swap"
            aria-label="Swap units"
            onClick={() => {
              setFrom(to)
              setTo(from)
            }}
          >
            <ArrowLeftRight size={14} />
          </button>
          <label className="field w-40">
            <span>To</span>
            <select className="input" value={to} onChange={(e) => setTo(e.target.value)}>
              {cat.units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-1 text-lg font-mono font-semibold text-[var(--accent)]">
            = {formatSig(pair, sig)} {to}
            {valid && <CopyButton text={formatSig(pair, sig)} />}
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto max-w-2xl">
        <table className="table-grid w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="text-left px-4 py-3">Unit</th>
              <th className="text-center px-4 py-3">Value</th>
              <th className="px-2 py-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {cat.units.map((u) => {
              const v = valid ? convert(cat, from, u.id, value) : NaN
              const s = formatSig(v, sig)
              return (
                <tr
                  key={u.id}
                  className={`border-t border-[var(--line)] ${u.id === from ? 'bg-[var(--accent-soft)]' : ''}`}
                >
                  <td className="px-4 py-2">{u.label}</td>
                  <td className="px-4 py-2 text-center font-mono">{s}</td>
                  <td className="px-2 py-1">{valid && <CopyButton text={s} />}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
