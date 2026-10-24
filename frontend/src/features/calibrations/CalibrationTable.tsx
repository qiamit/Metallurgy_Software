import { Pencil } from 'lucide-react'
import type { Calibration } from '@/types'

export function CalibrationTable({
  rows,
  loading,
  selectedIds,
  canEdit,
  onToggle,
  onToggleAll,
  onEdit,
}: {
  rows: Calibration[]
  loading: boolean
  selectedIds: Set<string>
  canEdit: boolean
  onToggle: (id: string) => void
  onToggleAll: () => void
  onEdit: (row: Calibration) => void
}) {
  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id))
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="table-head">
          <tr>
            {canEdit && (
              <th className="w-10 px-4 py-3">
                <input type="checkbox" aria-label="Select all calibrations" checked={allSelected} onChange={onToggleAll} />
              </th>
            )}
            <th className="text-left px-4 py-3">Name</th>
            <th className="text-left px-4 py-3">Objective</th>
            <th className="text-left px-4 py-3">X µm/px</th>
            <th className="text-left px-4 py-3">Y µm/px</th>
            <th className="text-left px-4 py-3">Unit</th>
            <th className="text-left px-4 py-3">Notes</th>
            {canEdit && <th className="px-4 py-3 text-right">Action</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="border-t border-[var(--line)]">
              {canEdit && (
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label={`Select ${c.name}`}
                    checked={selectedIds.has(c.id)}
                    onChange={() => onToggle(c.id)}
                  />
                </td>
              )}
              <td className="px-4 py-3">{c.name}</td>
              <td className="px-4 py-3">{c.objective}</td>
              <td className="px-4 py-3">{c.um_per_px_x}</td>
              <td className="px-4 py-3">{c.um_per_px_y}</td>
              <td className="px-4 py-3">{c.unit}</td>
              <td className="px-4 py-3 text-[var(--muted)]">{c.notes || '—'}</td>
              {canEdit && (
                <td className="px-4 py-3 text-right">
                  <button type="button" className="btn btn-ghost py-1 px-2" aria-label={`Edit ${c.name}`} onClick={() => onEdit(c)}>
                    <Pencil size={14} />
                  </button>
                </td>
              )}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td className="px-4 py-6 text-[var(--muted)]" colSpan={canEdit ? 8 : 6}>
                {loading ? 'Loading…' : 'No Calibrations Yet.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
