/** Pure hardness-test calculations (ISO 6506-1, ISO 6507-1, ISO 6508-1, ISO 4545 / ASTM E10, E18, E92). */

export const G = 9.80665 // N per kgf

const sq = (x: number) => x * x
const pos = (...xs: number[]) => xs.every((x) => Number.isFinite(x) && x > 0)

/** Mean of two readings; if only one is valid, it is used alone. */
export function mean2(a: number, b: number): number {
  const ok = [a, b].filter((x) => Number.isFinite(x) && x > 0)
  return ok.length ? ok.reduce((s, x) => s + x, 0) / ok.length : NaN
}

// ---- Vickers ----

export const VICKERS_FORCES_KGF = [0.01, 0.025, 0.05, 0.1, 0.2, 0.3, 0.5, 1, 2, 3, 5, 10, 20, 30, 50, 100]

export function vickersRange(kgf: number): 'Micro' | 'Low-force' | 'Macro' {
  if (kgf < 0.2) return 'Micro'
  if (kgf < 5) return 'Low-force'
  return 'Macro'
}

export type VickersResult = { hv: number; d: number; depth: number; asymmetry: number }

/** HV = 1.8544·F[kgf]/d² (d in mm, mean diagonal). */
export function vickers(kgf: number, d1mm: number, d2mm: number): VickersResult | null {
  const d = mean2(d1mm, d2mm)
  if (!pos(kgf, d)) return null
  const hv = (1.8544 * kgf) / sq(d)
  const asymmetry = pos(d1mm, d2mm) ? Math.abs(d1mm - d2mm) / d : 0
  return { hv, d, depth: d / 7, asymmetry }
}

/** Notation like "412 HV10" / "650 HV0.5". */
export function vickersNotation(hv: number, kgf: number) {
  return `${Math.round(hv)} HV${kgf}`
}

// ---- Brinell ----

export const BRINELL_BALLS_MM = [10, 5, 2.5, 1]
export const BRINELL_RATIOS = [30, 15, 10, 5, 2.5, 1]

/** Nominal test force in kgf for ball D and force-diameter ratio 0.102·F[N]/D² (≈ ratio·D² kgf). */
export function brinellForceKgf(D: number, ratio: number) {
  return ratio * sq(D)
}

export type BrinellResult = { hbw: number; d: number; depth: number; dOverD: number; valid: boolean }

/** HBW = 0.102·2F[N] / (π·D·(D − √(D² − d²))). */
export function brinell(D: number, kgf: number, d1: number, d2: number): BrinellResult | null {
  const d = mean2(d1, d2)
  if (!pos(D, kgf, d) || d >= D) return null
  const depth = (D - Math.sqrt(sq(D) - sq(d))) / 2
  const hbw = (0.102 * 2 * kgf * G) / (Math.PI * D * 2 * depth)
  const dOverD = d / D
  return { hbw, d, depth, dOverD, valid: dOverD >= 0.24 && dOverD <= 0.6 }
}

export function brinellNotation(hbw: number, D: number, kgf: number) {
  return `${Math.round(hbw)} HBW ${D}/${+kgf.toFixed(3)}`
}

// ---- Knoop ----

/** HK = 14.229·F[kgf]/L² (L long diagonal, mm). */
export function knoop(kgf: number, Lmm: number): number | null {
  if (!pos(kgf, Lmm)) return null
  return (14.229 * kgf) / sq(Lmm)
}

// ---- Rockwell ----

export type RockwellKind = 'diamond' | 'ball'
export type RockwellScale = {
  key: string
  indenter: string
  kind: RockwellKind
  superficial: boolean
  preKgf: number
  totalKgf: number
  use: string
}

export const ROCKWELL_SCALES: RockwellScale[] = [
  { key: 'A', indenter: 'Diamond cone', kind: 'diamond', superficial: false, preKgf: 10, totalKgf: 60, use: 'Cemented carbides, thin hard steel' },
  { key: 'B', indenter: '1/16" ball', kind: 'ball', superficial: false, preKgf: 10, totalKgf: 100, use: 'Soft steel, copper alloys, aluminium' },
  { key: 'C', indenter: 'Diamond cone', kind: 'diamond', superficial: false, preKgf: 10, totalKgf: 150, use: 'Hardened steel, deep case' },
  { key: 'D', indenter: 'Diamond cone', kind: 'diamond', superficial: false, preKgf: 10, totalKgf: 100, use: 'Thin steel, medium case' },
  { key: 'E', indenter: '1/8" ball', kind: 'ball', superficial: false, preKgf: 10, totalKgf: 100, use: 'Cast iron, aluminium, magnesium' },
  { key: 'F', indenter: '1/16" ball', kind: 'ball', superficial: false, preKgf: 10, totalKgf: 60, use: 'Annealed copper alloys, thin soft sheet' },
  { key: 'G', indenter: '1/16" ball', kind: 'ball', superficial: false, preKgf: 10, totalKgf: 150, use: 'Malleable iron, Cu-Ni-Zn' },
  { key: 'H', indenter: '1/8" ball', kind: 'ball', superficial: false, preKgf: 10, totalKgf: 60, use: 'Aluminium, zinc, lead' },
  { key: 'K', indenter: '1/8" ball', kind: 'ball', superficial: false, preKgf: 10, totalKgf: 150, use: 'Bearing metals, soft materials' },
  { key: '15N', indenter: 'Diamond cone', kind: 'diamond', superficial: true, preKgf: 3, totalKgf: 15, use: 'Thin hard sheet, shallow case' },
  { key: '30N', indenter: 'Diamond cone', kind: 'diamond', superficial: true, preKgf: 3, totalKgf: 30, use: 'Thin hard sheet, shallow case' },
  { key: '45N', indenter: 'Diamond cone', kind: 'diamond', superficial: true, preKgf: 3, totalKgf: 45, use: 'Thin hard sheet, shallow case' },
  { key: '15T', indenter: '1/16" ball', kind: 'ball', superficial: true, preKgf: 3, totalKgf: 15, use: 'Thin soft sheet' },
  { key: '30T', indenter: '1/16" ball', kind: 'ball', superficial: true, preKgf: 3, totalKgf: 30, use: 'Thin soft sheet' },
  { key: '45T', indenter: '1/16" ball', kind: 'ball', superficial: true, preKgf: 3, totalKgf: 45, use: 'Thin soft sheet' },
]

export type RockwellDepth = { depth: number; minThickness: number; factor: number }

/**
 * Permanent indentation depth from the reading: HR = N − h/S.
 * Regular diamond N=100, regular ball N=130, S=0.002 mm; superficial N=100, S=0.001 mm.
 * Minimum thickness 10·h (diamond) or 15·h (ball).
 */
export function rockwellDepth(scaleKey: string, hr: number): RockwellDepth | null {
  const s = ROCKWELL_SCALES.find((x) => x.key === scaleKey)
  if (!s || !Number.isFinite(hr)) return null
  const N = s.superficial || s.kind === 'diamond' ? 100 : 130
  const S = s.superficial ? 0.001 : 0.002
  const depth = (N - hr) * S
  if (depth <= 0) return null
  const factor = s.kind === 'diamond' ? 10 : 15
  return { depth, minThickness: factor * depth, factor }
}

// ---- Thickness & spacing ----

export type Spacing = { thickness: number; centre: number; edge: number }

/** ISO 6507-1: thickness ≥ 1.5d; centre ≥ 3d (steel, Cu) / 6d (light metals); edge ≥ 2.5d / 3d. */
export function vickersSpacing(d: number, light: boolean): Spacing | null {
  if (!pos(d)) return null
  return { thickness: 1.5 * d, centre: (light ? 6 : 3) * d, edge: (light ? 3 : 2.5) * d }
}

/** ISO 6506-1: thickness ≥ 8h; centre ≥ 3d; edge ≥ 2.5d. */
export function brinellSpacing(D: number, d: number): Spacing | null {
  if (!pos(D, d) || d >= D) return null
  const h = (D - Math.sqrt(sq(D) - sq(d))) / 2
  return { thickness: 8 * h, centre: 3 * d, edge: 2.5 * d }
}

// ---- Tensile ----

/** ASTM A370 rule of thumb for carbon / low-alloy steel (HB ≤ 400): Rm ≈ 500·HB psi ≈ 3.45·HB MPa. */
export function tensileFromHB(hb: number): number | null {
  if (!pos(hb)) return null
  return 3.45 * hb
}

/** Parse a list of numbers separated by newlines, commas, semicolons or spaces. */
export function parseNumberList(text: string): number[] {
  return text
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((x) => Number.isFinite(x))
}

/** Number from an input string; NaN when blank. */
export function num(raw: string): number {
  return raw.trim() === '' ? NaN : Number(raw)
}

export function fmt(v: number | null | undefined, digits = 1) {
  return v == null || !Number.isFinite(v) ? '—' : v.toFixed(digits)
}
