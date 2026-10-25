import { E140_HARDENED } from '@/features/hardness/e140Hardened'
import { E140_SOFT } from '@/features/hardness/e140Soft'

export type Scale = {
  key: string
  label: string
  unit?: string
}

export const HARDENED_SCALES: Scale[] = [
  { key: 'HRC', label: 'Rockwell C' },
  { key: 'HRA', label: 'Rockwell A' },
  { key: 'HRD', label: 'Rockwell D' },
  { key: 'HR15N', label: 'Superficial 15N' },
  { key: 'HR30N', label: 'Superficial 30N' },
  { key: 'HR45N', label: 'Superficial 45N' },
  { key: 'HRG', label: 'Rockwell G' },
  { key: 'HV', label: 'Vickers HV 10' },
  { key: 'HK', label: 'Knoop HK (≥ 500 g)' },
  { key: 'HBW', label: 'Brinell HBW 3000 kg' },
  { key: 'TS', label: 'Tensile strength (approx.)', unit: 'ksi' },
]

export const SOFT_SCALES: Scale[] = [
  { key: 'HRB', label: 'Rockwell B' },
  { key: 'HRF', label: 'Rockwell F' },
  { key: 'HRG', label: 'Rockwell G' },
  { key: 'HR15T', label: 'Superficial 15T' },
  { key: 'HR30T', label: 'Superficial 30T' },
  { key: 'HR45T', label: 'Superficial 45T' },
  { key: 'HRE', label: 'Rockwell E' },
  { key: 'HRH', label: 'Rockwell H' },
  { key: 'HRK', label: 'Rockwell K' },
  { key: 'HRA', label: 'Rockwell A' },
  { key: 'HK', label: 'Knoop HK (≥ 500 g)' },
  { key: 'HBS500', label: 'Brinell 500 kg (10 mm ball)' },
  { key: 'HV', label: 'Brinell 3000 kg ≈ Vickers HV 10' },
  { key: 'TS', label: 'Tensile strength (approx.)', unit: 'ksi' },
]

export type TableId = 'hardened' | 'soft'

const TABLES: Record<TableId, { scales: Scale[]; rows: (number | null)[][] }> = {
  hardened: { scales: HARDENED_SCALES, rows: E140_HARDENED as (number | null)[][] },
  soft: { scales: SOFT_SCALES, rows: E140_SOFT as (number | null)[][] },
}

export const KSI_TO_MPA = 6.894757

export type Conversion = {
  table: TableId
  values: { scale: Scale; value: number | null }[]
  exactRow: boolean
}

/**
 * Linear interpolation between the two neighbouring table rows that bracket `value` on `scaleKey`.
 * Returns null outside the table range — ASTM E140 gives no values there, and we do not extrapolate.
 */
export function convertHardness(table: TableId, scaleKey: string, value: number): Conversion | null {
  const t = TABLES[table]
  const col = t.scales.findIndex((s) => s.key === scaleKey)
  if (col < 0 || !Number.isFinite(value)) return null
  const rows = t.rows.filter((r) => r[col] != null)
  for (let i = 0; i < rows.length - 1; i += 1) {
    const hi = rows[i][col] as number
    const lo = rows[i + 1][col] as number
    if (value <= hi && value >= lo) {
      const f = hi === lo ? 0 : (hi - value) / (hi - lo)
      return {
        table,
        exactRow: f === 0 || f === 1,
        values: t.scales.map((scale, j) => {
          const a = rows[i][j]
          const b = rows[i + 1][j]
          if (a == null || b == null) return { scale, value: f === 0 ? a : f === 1 ? b : null }
          return { scale, value: a + (b - a) * f }
        }),
      }
    }
  }
  return null
}

/** Which table to use for a scale/value: the Rockwell C family is hardened, B family soft; HV/HB by range. */
export function pickTable(scaleKey: string, value: number): TableId {
  if (['HRC', 'HRD', 'HR15N', 'HR30N', 'HR45N', 'HBW'].includes(scaleKey)) return 'hardened'
  if (['HRB', 'HRF', 'HR15T', 'HR30T', 'HR45T', 'HRE', 'HRH', 'HRK', 'HBS500'].includes(scaleKey)) return 'soft'
  if (scaleKey === 'HV') return value >= 240 ? 'hardened' : 'soft'
  if (scaleKey === 'HK') return value >= 251 ? 'hardened' : 'soft'
  if (scaleKey === 'HRA') return value >= 61.5 ? 'hardened' : 'soft'
  if (scaleKey === 'HRG') return value >= 82.5 ? 'hardened' : 'soft'
  if (scaleKey === 'TS') return value >= 116 ? 'hardened' : 'soft'
  return 'hardened'
}

export const INPUT_SCALES: Scale[] = [
  ...HARDENED_SCALES.filter((s) => s.key !== 'TS'),
  ...SOFT_SCALES.filter((s) => !['HRA', 'HRG', 'HK', 'HV', 'TS'].includes(s.key)),
]

export const TABLE_LABELS: Record<TableId, string> = {
  hardened: 'Hardened steel',
  soft: 'Soft steel & non-ferrous',
}

export function getTable(id: TableId) {
  return TABLES[id]
}

/** Index of the table row whose `scaleKey` value is closest to `value`, or -1 if the scale is not in the table. */
export function nearestRowIndex(table: TableId, scaleKey: string, value: number): number {
  const t = TABLES[table]
  const col = t.scales.findIndex((s) => s.key === scaleKey)
  if (col < 0 || !Number.isFinite(value)) return -1
  let best = -1
  let bestDiff = Infinity
  t.rows.forEach((r, i) => {
    const v = r[col]
    if (v == null) return
    const diff = Math.abs(v - value)
    if (diff < bestDiff) {
      bestDiff = diff
      best = i
    }
  })
  return best
}

export type TableChoice = 'auto' | TableId

export function resolveTable(choice: TableChoice, scaleKey: string, value: number): TableId {
  return choice === 'auto' ? pickTable(scaleKey, value) : choice
}
