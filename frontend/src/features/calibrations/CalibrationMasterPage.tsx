import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { hasRole } from '@/lib/roles'
import type { Calibration } from '@/types'
import {
  createCalibration,
  deleteCalibrations,
  fetchCalibrations,
  updateCalibration,
} from '@/features/calibrations/calibrationsApi'
import { CalibrationFields, CalibrationForm } from '@/features/calibrations/CalibrationForm'
import { CalibrationTable } from '@/features/calibrations/CalibrationTable'
import { CalibrationFooterBar } from '@/features/calibrations/CalibrationFooterBar'
import { EMPTY_CALIBRATION, type CalibrationFormValues } from '@/features/calibrations/types'

export function CalibrationMasterPage() {
  const { orgId, role } = useAuth()
  const canCreate = hasRole(role, 'analyst')
  const canDelete = hasRole(role, 'admin')
  const [rows, setRows] = useState<Calibration[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [form, setForm] = useState<CalibrationFormValues>(EMPTY_CALIBRATION)
  const [saveLoading, setSaveLoading] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<Calibration | null>(null)
  const [editError, setEditError] = useState('')
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    if (!orgId) return
    setListLoading(true)
    try {
      setRows(await fetchCalibrations(orgId))
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Failed to load' })
    } finally {
      setListLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    load()
  }, [load])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!orgId) return
    setSaveLoading(true)
    setMessage(null)
    try {
      await createCalibration(orgId, form)
      setMessage({ ok: true, text: 'Calibration saved.' })
      await load()
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Failed' })
    } finally {
      setSaveLoading(false)
    }
  }

  async function onEditSubmit(values: CalibrationFormValues) {
    if (!editing) return
    setSaveLoading(true)
    setEditError('')
    try {
      await updateCalibration(editing.id, values)
      setEditing(null)
      await load()
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaveLoading(false)
    }
  }

  async function onDeleteSelected() {
    if (!window.confirm(`Delete ${selectedIds.size} calibration(s)? Jobs keep their results but lose the link.`)) return
    setDeleting(true)
    try {
      await deleteCalibrations([...selectedIds])
      setSelectedIds(new Set())
      await load()
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : 'Delete failed' })
    } finally {
      setDeleting(false)
    }
  }

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="page-title">Calibration</h1>
      </div>

      {canCreate && (
        <form onSubmit={onCreate} className="card p-6 grid md:grid-cols-2 gap-4">
          <CalibrationFields value={form} onChange={setForm} />
          {message && (
            <p className={`text-sm md:col-span-2 ${message.ok ? 'text-[var(--ok)]' : 'text-[var(--danger)]'}`}>
              {message.text}
            </p>
          )}
          <div className="md:col-span-2">
            <button className="btn btn-primary" type="submit" disabled={saveLoading}>
              {saveLoading ? 'Saving…' : 'Save Calibration'}
            </button>
          </div>
        </form>
      )}

      <CalibrationTable
        rows={rows}
        loading={listLoading}
        selectedIds={selectedIds}
        canEdit={canCreate}
        onToggle={toggle}
        onToggleAll={() =>
          setSelectedIds((prev) => (rows.every((r) => prev.has(r.id)) ? new Set() : new Set(rows.map((r) => r.id))))
        }
        onEdit={(row) => {
          setEditError('')
          setEditing(row)
        }}
      />
      <CalibrationFooterBar
        selectedCount={selectedIds.size}
        canDelete={canDelete}
        deleting={deleting}
        onDelete={onDeleteSelected}
      />
      <CalibrationForm
        open={Boolean(editing)}
        initial={
          editing
            ? {
                name: editing.name,
                objective: editing.objective,
                um_per_px_x: editing.um_per_px_x,
                um_per_px_y: editing.um_per_px_y,
                unit: editing.unit,
                notes: editing.notes ?? '',
              }
            : null
        }
        saving={saveLoading}
        error={editError}
        onOpenChange={(open) => !open && setEditing(null)}
        onSubmit={onEditSubmit}
      />
    </div>
  )
}
