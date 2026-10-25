/** Composition and ASTM E112 grain-size relations. Pure functions. */

export type CompMode = 'wt-to-at' | 'at-to-wt'

export interface CompInput {
  symbol: string
  mass: number // g/mol
  amount: number // wt % or at %
}

export interface CompResult {
  symbol: string
  wt: number
  at: number
}

/** Parse "55.845" → 55.845; "[98]" or invalid → null. */
export function parseAtomicMass(mass: string): number | null {
  if (mass.trim().startsWith('[')) return null
  const n = Number(mass)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Convert a composition. The input amounts are normalised to 100.
 * at%ᵢ = (wᵢ/Mᵢ) / Σ(wⱼ/Mⱼ) · 100 ;  wt%ᵢ = (xᵢ·Mᵢ) / Σ(xⱼ·Mⱼ) · 100
 */
export function convertComposition(rows: CompInput[], mode: CompMode): CompResult[] {
  const valid = rows.filter((r) => r.mass > 0 && Number.isFinite(r.amount) && r.amount >= 0)
  const sumIn = valid.reduce((s, r) => s + r.amount, 0)
  if (sumIn <= 0) return []
  const weights = valid.map((r) => (mode === 'wt-to-at' ? r.amount / r.mass : r.amount * r.mass))
  const sumW = weights.reduce((s, w) => s + w, 0)
  return valid.map((r, i) => {
    const input = (r.amount / sumIn) * 100
    const output = (weights[i] / sumW) * 100
    return mode === 'wt-to-at'
      ? { symbol: r.symbol, wt: input, at: output }
      : { symbol: r.symbol, wt: output, at: input }
  })
}

export const PPM_PER_PERCENT = 10000

// ---------- ASTM E112-13 ----------

export type GrainInput = 'G' | 'l_mm' | 'l_um' | 'NA' | 'n' | 'd_um'

export interface GrainResult {
  G: number
  /** mean lineal intercept, mm */
  lMm: number
  /** grains per mm² at 1× */
  NA: number
  /** grains per in² at 100× */
  n: number
  /** average grain diameter, µm (1/√N_A) */
  dUm: number
}

const LOG2_10 = 3.321928
/** G from mean lineal intercept ℓ (mm). */
export const gFromIntercept = (lMm: number) => -6.643856 * Math.log10(lMm) - 3.288
/** G from grains/mm² at 1×. */
export const gFromNA = (na: number) => LOG2_10 * Math.log10(na) - 2.954

export function grainFromG(G: number): GrainResult {
  const n = 2 ** (G - 1)
  const NA = 15.5 * n
  const lMm = 10 ** (-(G + 3.288) / 6.643856)
  return { G, lMm, NA, n, dUm: 1000 / Math.sqrt(NA) }
}

export function grainFrom(kind: GrainInput, v: number): GrainResult | null {
  if (!Number.isFinite(v)) return null
  if (kind !== 'G' && v <= 0) return null
  switch (kind) {
    case 'G':
      return grainFromG(v)
    case 'l_mm':
      return { ...grainFromG(gFromIntercept(v)), lMm: v }
    case 'l_um':
      return { ...grainFromG(gFromIntercept(v / 1000)), lMm: v / 1000 }
    case 'NA':
      return { ...grainFromG(gFromNA(v)), NA: v }
    case 'n':
      return grainFromG(Math.log2(v) + 1)
    case 'd_um': {
      const na = 1e6 / (v * v)
      return { ...grainFromG(gFromNA(na)), NA: na, dUm: v }
    }
  }
}

/** E112 reference table rows: "00" is G = −1. */
export const GRAIN_TABLE: { label: string; r: GrainResult }[] = [-1, ...Array.from({ length: 15 }, (_, i) => i)].map(
  (G) => ({ label: G === -1 ? '00' : String(G), r: grainFromG(G) }),
)
