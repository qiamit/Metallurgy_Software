import { carbonFromPearlite } from '@/features/phase-diagram/feC'
import type { AnalysisType } from '@/types'

/** One labelled value of a formatted result. */
export type ResultRow = { label: string; value: string; unit?: string }
export type LegendItem = { label: string; color: string }

export type FormattedResult = {
  standard: string
  method: string
  headline: ResultRow[]
  details: ResultRow[]
  warnings: string[]
  notes: string
  legend: LegendItem[]
}

type R = Record<string, unknown>
/** [key, label, unit?, digits? | formatter] */
type Field = [string, string, string?, (number | ((v: unknown, r: R) => string | null))?]

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const fixed = (v: unknown, d: number) => {
  const n = num(v)
  return n === null ? null : n.toFixed(d)
}
const pct = (d: number) => (v: unknown) => {
  const n = num(v)
  return n === null ? null : (n * 100).toFixed(d)
}
const yesNo = (v: unknown) => (typeof v === 'boolean' ? (v ? 'Yes' : 'No') : null)
const cap = (v: unknown) => (typeof v === 'string' && v ? v.charAt(0).toUpperCase() + v.slice(1) : null)

const GREEN = '#16a34a'
const AMBER = '#f59e0b'
const RED = '#dc2626'

type Spec = { headline: Field[]; details: Field[]; warnings?: string[]; legend?: LegendItem[] }

const SPECS: Record<AnalysisType, Spec> = {
  grain_size: {
    headline: [
      ['grain_size_number_G', 'ASTM Grain Size G', '', 1],
      ['mean_intercept_um', 'Mean Intercept', 'µm', 1],
      ['grains_per_mm2', 'Grains', '/mm²', 0],
      ['average_grain_diameter_um', 'Mean Diameter', 'µm', 1],
    ],
    details: [
      ['grain_size_number_G_planimetric', 'G (Planimetric)', '', 1],
      ['intercept_count', 'Intercepts Counted', '', 0],
      ['test_line_length_mm', 'Test Line Length', 'mm', 3],
      ['grain_count_estimate', 'Grains Detected', '', 0],
      ['duplex_coarse_area_percent', 'Coarse Grain Area', '%', 1],
      ['duplex_suspected', 'Duplex Suspected', '', yesNo],
      ['etch_mode', 'Etch Mode', '', cap],
      ['boundary_polarity', 'Boundaries', '', cap],
    ],
    warnings: ['resolution_warning', 'etch_mode_note'],
    legend: [
      { label: 'Grain Boundaries', color: GREEN },
      { label: 'Test Lines', color: AMBER },
      { label: 'Intercepts', color: RED },
    ],
  },
  inclusion: {
    headline: [
      ['worst_severity_index', 'Worst Severity Index', '', 1],
      ['ds_rating', 'DS Rating', '', 1],
      ['inclusion_count', 'Inclusions', '', 0],
    ],
    details: [
      ['fields_rated', 'Fields Rated', '', 0],
      ['field_area_mm2', 'Field Area', 'mm²', 3],
      ['rolling_direction_deg', 'Rolling Direction', '°', 1],
      ['type_counts', 'Count by Type', '', (v) => (v && typeof v === 'object' ? Object.entries(v as R).map(([k, n]) => `${k} ${n}`).join(' · ') : null)],
    ],
    legend: [
      { label: 'A Sulphide', color: '#ff0000' },
      { label: 'B Alumina', color: '#ffa500' },
      { label: 'C Silicate', color: '#e6c200' },
      { label: 'D Globular', color: '#00c800' },
      { label: 'DS', color: '#ff00ff' },
    ],
  },
  decarb: {
    headline: [
      ['total_decarb_depth_um', 'Total Decarburization', 'µm', 1],
      ['complete_decarb_depth_um', 'Complete Decarburization', 'µm', 1],
      ['decarb_detected', 'Decarburized Layer', '', yesNo],
    ],
    details: [
      ['decarb_depth_mm', 'Total Depth', 'mm', 3],
      ['surface_side', 'Surface Side', '', cap],
      ['surface_found_by', 'Surface Found By', '', cap],
    ],
    legend: [
      { label: 'Surface', color: GREEN },
      { label: 'Complete', color: AMBER },
      { label: 'Total', color: RED },
    ],
  },
  micro: {
    headline: [
      ['light_phase_fraction', 'Light Phase', '%', pct(1)],
      ['dark_phase_fraction', 'Dark Phase', '%', pct(1)],
      [
        'dark_phase_fraction',
        'Carbon (Lever Rule)',
        '% C',
        (v, r) => (r.light_phase_is_ferrite === false || num(v) === null ? null : `≈ ${carbonFromPearlite((v as number) * 100).toFixed(2)}`),
      ],
    ],
    details: [
      ['light_phase_is_ferrite', 'Light Phase Is Ferrite', '', yesNo],
      ['light_phase_texture_ratio', 'Texture Ratio', '', 2],
      ['field_area_um2', 'Field Area', 'µm²', 0],
    ],
    warnings: ['warning'],
  },
  macro: {
    headline: [
      ['stringer_count', 'Stringers', '', 0],
      ['total_length_mm', 'Total Length', 'mm', 2],
    ],
    details: [],
  },
  nodularity: {
    headline: [
      ['nodularity_percent', 'Nodularity', '%', 1],
      ['nodule_count_per_mm2', 'Nodule Count', '/mm²', 0],
      ['nodule_size_class_a247', 'Size Class (A247)', '', 0],
      ['graphite_area_percent', 'Graphite Area', '%', 1],
    ],
    details: [
      ['nodularity_incl_intermediate_percent', 'Nodularity incl. Intermediate', '%', 1],
      ['median_nodule_diameter_um', 'Median Nodule Diameter', 'µm', 1],
      ['particles_counted', 'Particles Counted', '', 0],
      ['nodules', 'Nodules', '', 0],
      ['field_area_mm2', 'Field Area', 'mm²', 3],
    ],
    legend: [
      { label: 'Nodular', color: GREEN },
      { label: 'Intermediate', color: AMBER },
      { label: 'Non-nodular', color: RED },
    ],
  },
  graphite_flake: {
    headline: [
      ['flake_size_class', 'Flake Size Class', '', 0],
      ['longest_flakes_mean_um', 'Longest 5 Mean', 'µm', 0],
      ['graphite_type_hint', 'Graphite Type (Hint)', '', (v) => (typeof v === 'string' ? v : null)],
      ['graphite_area_percent', 'Graphite Area', '%', 1],
    ],
    details: [
      ['flake_length_p95_um', 'Flake Length P95', 'µm', 0],
      ['median_flake_length_um', 'Median Flake Length', 'µm', 0],
      ['median_flake_spacing_um', 'Median Spacing', 'µm', 0],
      ['flake_count', 'Flakes Counted', '', 0],
    ],
    warnings: ['flake_size_class_note'],
    legend: [
      { label: 'Flakes', color: AMBER },
      { label: 'Longest 5', color: RED },
    ],
  },
}

const COMMON_DETAILS: Field[] = [
  ['um_per_px_x', 'Scale', 'µm/px', 4],
  ['image_width_px', 'Image Size', 'px', (v, r) => (num(v) !== null && num(r.image_height_px) !== null ? `${v} × ${r.image_height_px}` : null)],
]

function rows(fields: Field[], r: R): ResultRow[] {
  const out: ResultRow[] = []
  for (const [key, label, unit, fmt] of fields) {
    const v = r[key]
    if (v === undefined || v === null || v === '') continue
    let value: string | null
    if (typeof fmt === 'function') value = fmt(v, r)
    else if (typeof fmt === 'number') value = fixed(v, fmt) ?? (typeof v === 'string' ? v : null)
    else value = typeof v === 'object' ? null : String(v)
    if (value !== null) out.push({ label, value, unit: unit || undefined })
  }
  return out
}

/** Turn a raw software_result into labelled headline values, details, warnings and an overlay legend. */
export function formatResult(type: AnalysisType, raw: unknown): FormattedResult {
  const r = (raw && typeof raw === 'object' ? raw : {}) as R
  const spec = SPECS[type]
  const warnings = (spec.warnings ?? [])
    .map((k) => r[k])
    .filter((w): w is string => typeof w === 'string' && w.trim() !== '')
  // micro's warning is set only when the light phase is not ferrite
  return {
    standard: typeof r.standard === 'string' ? r.standard : '',
    method: typeof r.method === 'string' ? r.method : '',
    headline: rows(spec.headline, r),
    details: rows([...spec.details, ...COMMON_DETAILS], r),
    warnings: type === 'micro' && r.light_phase_is_ferrite !== false ? [] : warnings,
    notes: typeof r.notes === 'string' ? r.notes : '',
    legend: spec.legend ?? [],
  }
}

export const formatRowValue = (row: ResultRow) => (row.unit ? `${row.value} ${row.unit}` : row.value)
