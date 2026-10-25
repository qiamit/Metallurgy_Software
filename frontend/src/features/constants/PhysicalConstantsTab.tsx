import { useMemo, useState } from 'react'
import { PHYSICAL_CONSTANTS } from '@/features/constants/constants'
import CopyButton from '@/features/constants/CopyButton'

export default function PhysicalConstantsTab() {
  const [query, setQuery] = useState('')
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return PHYSICAL_CONSTANTS
    return PHYSICAL_CONSTANTS.filter((c) =>
      [c.name, c.symbol, c.unit].some((s) => s.toLowerCase().includes(q)),
    )
  }, [query])

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <label className="field w-full max-w-sm">
          <span>Search</span>
          <input className="input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <span className="text-xs text-[var(--muted)]">CODATA 2018</span>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="text-left px-4 py-3">Quantity</th>
              <th className="text-left px-4 py-3">Symbol</th>
              <th className="text-right px-4 py-3">Value</th>
              <th className="text-left px-4 py-3">Unit</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.name} className="border-t border-[var(--line)]">
                <td className="px-4 py-2">{c.name}</td>
                <td className="px-4 py-2 font-serif italic">{c.symbol}</td>
                <td className="px-4 py-2 text-right font-mono whitespace-nowrap">
                  <span className="inline-flex items-center gap-1">
                    {c.value}
                    <CopyButton text={c.numeric} />
                  </span>
                </td>
                <td className="px-4 py-2 whitespace-nowrap">{c.unit}</td>
                <td className="px-4 py-2">{c.exact && <span className="badge badge-ok">exact</span>}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[var(--muted)]">
                  No match
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
