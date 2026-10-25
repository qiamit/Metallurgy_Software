import { useEffect, useState, type FormEvent } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EMPTY_CALIBRATION, type CalibrationFormValues } from '@/features/calibrations/types'

const FIELDS = [
  ['name', 'Name'],
  ['objective', 'Objective'],
  ['um_per_px_x', 'µm per px (X)'],
  ['um_per_px_y', 'µm per px (Y)'],
  ['unit', 'Unit'],
  ['notes', 'Notes'],
] as const

export function CalibrationFields({
  value,
  onChange,
}: {
  value: CalibrationFormValues
  onChange: (next: CalibrationFormValues) => void
}) {
  return (
    <>
      {FIELDS.map(([key, label]) => (
        <div key={key}>
          <label className="label" htmlFor={`cal-${key}`}>
            {label}
          </label>
          <input
            id={`cal-${key}`}
            className="input mt-1"
            type={key.startsWith('um_') ? 'number' : 'text'}
            step="any"
            min={key.startsWith('um_') ? 0 : undefined}
            value={String(value[key])}
            onChange={(e) =>
              onChange({ ...value, [key]: key.startsWith('um_') ? Number(e.target.value) : e.target.value })
            }
            required={key !== 'notes'}
          />
        </div>
      ))}
    </>
  )
}

export function CalibrationForm({
  open,
  initial,
  saving,
  error,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  initial: CalibrationFormValues | null
  saving: boolean
  error: string
  onOpenChange: (open: boolean) => void
  onSubmit: (values: CalibrationFormValues) => void
}) {
  const [values, setValues] = useState<CalibrationFormValues>(initial ?? EMPTY_CALIBRATION)
  useEffect(() => {
    if (open) setValues(initial ?? EMPTY_CALIBRATION)
  }, [open, initial])

  function submit(e: FormEvent) {
    e.preventDefault()
    onSubmit(values)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit Calibration</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid md:grid-cols-2 gap-4">
          <CalibrationFields value={values} onChange={setValues} />
          {error && <p className="text-sm text-[var(--danger)] md:col-span-2">{error}</p>}
          <DialogFooter className="md:col-span-2">
            <button type="button" className="btn btn-ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Calibration'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
