import type { CalibrationInput } from '@/features/calibrations/calibrationsApi'

export type CalibrationFormValues = Omit<CalibrationInput, 'notes'> & { notes: string }

export const EMPTY_CALIBRATION: CalibrationFormValues = {
  name: '10X',
  objective: '10X',
  um_per_px_x: 0.65,
  um_per_px_y: 0.65,
  unit: 'um',
  notes: '',
}
