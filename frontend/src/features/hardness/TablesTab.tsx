import { useEffect, useRef } from 'react'
import { TABLE_LABELS, getTable, nearestRowIndex, type TableId } from '@/features/hardness/e140'
import { fmt } from '@/features/hardness/calc'

export function TablesTab({
  table,
  onTable,
  scaleKey,
  value,
}: {
  table: TableId
  onTable: (t: TableId) => void
  scaleKey: string
  value: number
}) {
  const t = getTable(table)
  const hit = nearestRowIndex(table, scaleKey, value)
  const col = t.scales.findIndex((s) => s.key === scaleKey)
  const rowRef = useRef<HTMLTableRowElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const row = rowRef.current
    const box = boxRef.current
    if (row && box) box.scrollTop = Math.max(0, row.offsetTop - box.clientHeight / 2)
  }, [table, hit])

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <label className="field w-64">
          <span>Table</span>
          <select className="input" value={table} onChange={(e) => onTable(e.target.value as TableId)}>
            <option value="hardened">{TABLE_LABELS.hardened}</option>
            <option value="soft">{TABLE_LABELS.soft}</option>
          </select>
        </label>
        <span className="badge badge-muted mb-2">ASTM E140</span>
        {hit >= 0 && (
          <span className="badge badge-ok mb-2">
            Nearest {scaleKey} {fmt(value, 1)}
          </span>
        )}
      </div>
      <div ref={boxRef} className="overflow-auto max-h-[70vh] border border-[var(--line)]">
        <table className="w-full text-sm whitespace-nowrap">
          <thead className="table-head sticky top-0 z-10">
            <tr>
              {t.scales.map((s, j) => (
                <th key={s.key} className={`px-3 py-2 text-right ${j === col ? 'underline underline-offset-4' : ''}`} title={s.label}>
                  {s.key === 'TS' ? 'TS ksi' : table === 'soft' && s.key === 'HV' ? 'HB3000/HV' : s.key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {t.rows.map((r, i) => (
              <tr
                key={i}
                ref={i === hit ? rowRef : undefined}
                className={`border-t border-[var(--line)] ${i === hit ? 'bg-[var(--accent-soft)] font-semibold' : ''}`}
              >
                {r.map((v, j) => (
                  <td key={j} className={`px-3 py-1 text-right font-mono ${j === col ? 'text-[var(--accent-ink)]' : ''}`}>
                    {v == null ? <span className="text-[var(--muted)]">—</span> : v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
