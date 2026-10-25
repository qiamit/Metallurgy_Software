/**
 * Fe–Fe₃C (metastable) diagram — key points as on the lab's Iron–Carbon/Cementite chart (Scan-0131).
 * Boundaries are straight segments between the invariant points, except A₃ (quadratic through
 * 912 °C @0, ~800 °C @0.40, 727 °C @0.77) and the α solvus (Arrhenius fit 0.022 % @727 → 0.008 % @400 °C).
 */
export const FE_C = {
  meltFe: 1538,
  delta: 1394, // δ ⇄ γ in pure iron (A₄)
  a3Fe: 912, // γ ⇄ α in pure iron
  curie: 770, // A₂, ferrite Curie point
  eutectoidT: 727,
  eutectoidC: 0.77,
  alphaMaxC: 0.022,
  peritecticT: 1495,
  peritecticC: 0.17,
  deltaMaxC: 0.09,
  peritecticLiquidC: 0.53,
  eutecticT: 1148,
  eutecticC: 4.3,
  gammaMaxC: 2.11,
  cementiteC: 6.67,
  cementiteLiquidusT: 1252,
}

const lerp = (x: number, x0: number, y0: number, x1: number, y1: number) => y0 + ((x - x0) * (y1 - y0)) / (x1 - x0)

// A₃ = 912 − A3_A·C + A3_Q·C²
const A3_A = 322.96
const A3_Q = 107.41

export function a3(c: number) {
  return FE_C.a3Fe - A3_A * c + A3_Q * c * c
}
export function acm(c: number) {
  return lerp(c, FE_C.eutectoidC, FE_C.eutectoidT, FE_C.gammaMaxC, FE_C.eutecticT)
}
export function liquidus(c: number) {
  if (c <= FE_C.peritecticLiquidC) return lerp(c, 0, FE_C.meltFe, FE_C.peritecticLiquidC, FE_C.peritecticT)
  if (c <= FE_C.eutecticC) return lerp(c, FE_C.peritecticLiquidC, FE_C.peritecticT, FE_C.eutecticC, FE_C.eutecticT)
  return lerp(c, FE_C.eutecticC, FE_C.eutecticT, FE_C.cementiteC, FE_C.cementiteLiquidusT)
}
/** γ solidus (0.17 % @1495 → 2.11 % @1148 °C). */
export function solidus(c: number) {
  return lerp(c, FE_C.peritecticC, FE_C.peritecticT, FE_C.gammaMaxC, FE_C.eutecticT)
}

const ALPHA_Q = Math.log(0.022 / 0.008) / (1 / 673.15 - 1 / 1000.15)

/** Composition (wt % C) of each phase boundary at temperature t (°C). */
export const boundaryC = {
  deltaSolidus: (t: number) => lerp(t, FE_C.meltFe, 0, FE_C.peritecticT, FE_C.deltaMaxC),
  deltaSolvus: (t: number) => lerp(t, FE_C.delta, 0, FE_C.peritecticT, FE_C.deltaMaxC),
  gammaDelta: (t: number) => lerp(t, FE_C.delta, 0, FE_C.peritecticT, FE_C.peritecticC),
  liquidus: (t: number) =>
    t >= FE_C.peritecticT
      ? lerp(t, FE_C.meltFe, 0, FE_C.peritecticT, FE_C.peritecticLiquidC)
      : lerp(t, FE_C.peritecticT, FE_C.peritecticLiquidC, FE_C.eutecticT, FE_C.eutecticC),
  liquidusHyper: (t: number) => lerp(t, FE_C.eutecticT, FE_C.eutecticC, FE_C.cementiteLiquidusT, FE_C.cementiteC),
  gammaSolidus: (t: number) => lerp(t, FE_C.peritecticT, FE_C.peritecticC, FE_C.eutecticT, FE_C.gammaMaxC),
  a3: (t: number) => {
    const d = A3_A * A3_A - 4 * A3_Q * (FE_C.a3Fe - t)
    return (A3_A - Math.sqrt(Math.max(0, d))) / (2 * A3_Q)
  },
  alphaGamma: (t: number) => lerp(t, FE_C.a3Fe, 0, FE_C.eutectoidT, FE_C.alphaMaxC),
  acm: (t: number) => lerp(t, FE_C.eutectoidT, FE_C.eutectoidC, FE_C.eutecticT, FE_C.gammaMaxC),
  alphaSolvus: (t: number) => FE_C.alphaMaxC * Math.exp(-ALPHA_Q * (1 / (t + 273.15) - 1 / 1000.15)),
}

export type FieldKey = 'L' | 'L+δ' | 'δ' | 'δ+γ' | 'L+γ' | 'γ' | 'L+Fe3C' | 'α+γ' | 'γ+Fe3C' | 'α' | 'α+Fe3C'

export const FIELD_NAME: Record<FieldKey, string> = {
  L: 'Liquid',
  'L+δ': 'Liquid + δ-ferrite',
  δ: 'δ-ferrite',
  'δ+γ': 'δ-ferrite + Austenite',
  'L+γ': 'Liquid + Austenite (γ)',
  γ: 'Austenite (γ)',
  'L+Fe3C': 'Liquid + Fe₃C',
  'α+γ': 'Ferrite (α) + Austenite (γ)',
  'γ+Fe3C': 'Austenite (γ) + Fe₃C',
  α: 'Ferrite (α)',
  'α+Fe3C': 'Ferrite (α) + Fe₃C',
}

export function phaseField(c: number, t: number): FieldKey {
  const C = Math.max(0, Math.min(FE_C.cementiteC, c))
  if (t >= liquidus(C)) return 'L'
  if (t >= FE_C.peritecticT) return C <= boundaryC.deltaSolidus(t) ? 'δ' : 'L+δ'
  if (t >= FE_C.delta) {
    if (C <= boundaryC.deltaSolvus(t)) return 'δ'
    if (C <= boundaryC.gammaDelta(t)) return 'δ+γ'
    return C <= boundaryC.gammaSolidus(t) ? 'γ' : 'L+γ'
  }
  if (t >= FE_C.eutecticT) {
    if (C <= boundaryC.gammaSolidus(t)) return 'γ'
    return C < FE_C.eutecticC ? 'L+γ' : 'L+Fe3C'
  }
  if (t >= FE_C.eutectoidT) {
    if (t < FE_C.a3Fe) {
      if (C <= boundaryC.alphaGamma(t)) return 'α'
      if (C < boundaryC.a3(t)) return 'α+γ'
    }
    return C <= boundaryC.acm(t) ? 'γ' : 'γ+Fe3C'
  }
  return C <= boundaryC.alphaSolvus(t) ? 'α' : 'α+Fe3C'
}

export type PhaseField = { phases: string; note: string; field: FieldKey }

export function phaseAt(c: number, t: number): PhaseField {
  const field = phaseField(c, t)
  const C = Math.max(0, Math.min(FE_C.cementiteC, c))
  const notes: Record<FieldKey, string> = {
    L: 'Fully molten.',
    'L+δ': 'Primary δ-ferrite in liquid.',
    δ: 'High-temperature BCC ferrite.',
    'δ+γ': 'Below the peritectic.',
    'L+γ': 'Mushy zone: austenite dendrites in liquid.',
    γ: t >= FE_C.eutecticT ? 'Single-phase austenite.' : 'Above A₃ / A_cm — austenitising range.',
    'L+Fe3C': 'Primary cementite from the melt (hypereutectic).',
    'α+γ': 'Intercritical range (A₁–A₃).',
    'γ+Fe3C': C > FE_C.gammaMaxC ? 'Cast iron: ledeburite + austenite.' : 'Between A₁ and A_cm.',
    α: 'Nearly pure ferrite.',
    'α+Fe3C':
      C < FE_C.eutectoidC - 0.005
        ? 'Hypoeutectoid: ferrite + pearlite.'
        : C <= FE_C.eutectoidC + 0.005
          ? 'Eutectoid: fully pearlitic.'
          : C <= FE_C.gammaMaxC
            ? 'Hypereutectoid: pearlite + cementite.'
            : 'White cast iron (metastable).',
  }
  return { phases: FIELD_NAME[field], note: notes[field], field }
}

export type TieEnd = { phase: string; c: number; fraction: number }
export type TieLine = { t: number; left: TieEnd; right: TieEnd }

/** Tie line and lever-rule mass fractions (%) in a two-phase field; null in a single-phase field. */
export function tieLine(c: number, t: number): TieLine | null {
  const C = Math.max(0, Math.min(FE_C.cementiteC, c))
  const k = FE_C.cementiteC
  const ends: Partial<Record<FieldKey, [string, number, string, number]>> = {
    'L+δ': ['δ', boundaryC.deltaSolidus(t), 'L', boundaryC.liquidus(t)],
    'δ+γ': ['δ', boundaryC.deltaSolvus(t), 'γ', boundaryC.gammaDelta(t)],
    'L+γ': ['γ', boundaryC.gammaSolidus(t), 'L', boundaryC.liquidus(t)],
    'L+Fe3C': ['L', boundaryC.liquidusHyper(t), 'Fe₃C', k],
    'α+γ': ['α', boundaryC.alphaGamma(t), 'γ', boundaryC.a3(t)],
    'γ+Fe3C': ['γ', boundaryC.acm(t), 'Fe₃C', k],
    'α+Fe3C': ['α', boundaryC.alphaSolvus(t), 'Fe₃C', k],
  }
  const e = ends[phaseField(C, t)]
  if (!e) return null
  const [lp, lc, rp, rc] = e
  const fr = Math.max(0, Math.min(1, (C - lc) / (rc - lc))) * 100
  return { t, left: { phase: lp, c: lc, fraction: 100 - fr }, right: { phase: rp, c: rc, fraction: fr } }
}

export type DiagramLine = { id: string; pts: [number, number][]; dashed?: boolean }

function sample(f: (c: number) => number, c0: number, c1: number, n = 40): [number, number][] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const c = c0 + ((c1 - c0) * i) / n
    return [c, f(c)] as [number, number]
  })
}

/** All boundary lines of the diagram as (C, T) polylines. */
export function diagramLines(): DiagramLine[] {
  const F = FE_C
  const solvus: [number, number][] = Array.from({ length: 41 }, (_, i) => {
    const t = F.eutectoidT - ((F.eutectoidT - 400) * i) / 40
    return [boundaryC.alphaSolvus(t), t]
  })
  return [
    { id: 'liquidus', pts: [[0, F.meltFe], [F.peritecticLiquidC, F.peritecticT], [F.eutecticC, F.eutecticT], [F.cementiteC, F.cementiteLiquidusT]] },
    { id: 'delta-solidus', pts: [[0, F.meltFe], [F.deltaMaxC, F.peritecticT]] },
    { id: 'peritectic', pts: [[F.deltaMaxC, F.peritecticT], [F.peritecticLiquidC, F.peritecticT]] },
    { id: 'delta-solvus', pts: [[0, F.delta], [F.deltaMaxC, F.peritecticT]] },
    { id: 'gamma-delta', pts: [[0, F.delta], [F.peritecticC, F.peritecticT]] },
    { id: 'solidus', pts: [[F.peritecticC, F.peritecticT], [F.gammaMaxC, F.eutecticT]] },
    { id: 'eutectic', pts: [[F.gammaMaxC, F.eutecticT], [F.cementiteC, F.eutecticT]] },
    { id: 'a3', pts: sample(a3, 0, F.eutectoidC) },
    { id: 'alpha-gamma', pts: [[0, F.a3Fe], [F.alphaMaxC, F.eutectoidT]] },
    { id: 'a1', pts: [[F.alphaMaxC, F.eutectoidT], [F.cementiteC, F.eutectoidT]] },
    { id: 'acm', pts: [[F.eutectoidC, F.eutectoidT], [F.gammaMaxC, F.eutecticT]] },
    { id: 'alpha-solvus', pts: solvus },
    { id: 'a2', pts: [[0, F.curie], [boundaryC.a3(F.curie), F.curie]], dashed: true },
  ]
}

/** Upper critical temperature: A₃ (hypoeutectoid) or A_cm (hypereutectoid). */
export function upperCritical(c: number) {
  return c <= FE_C.eutectoidC ? a3(c) : acm(c)
}

export type HtKey = 'anneal' | 'normalise' | 'harden' | 'spheroidise' | 'stress' | 'process' | 'hotwork'

export type HtProcess = {
  key: HtKey
  name: string
  cMin: number
  cMax: number
  range: (c: number) => [number, number]
}

const A1 = FE_C.eutectoidT
/** Heat-treatment temperature windows (°C) as functions of carbon (plain Fe–C). */
export const HT_PROCESSES: HtProcess[] = [
  { key: 'anneal', name: 'Full annealing', cMin: 0, cMax: FE_C.gammaMaxC, range: (c) => (c <= FE_C.eutectoidC ? [a3(c) + 30, a3(c) + 50] : [A1 + 30, A1 + 50]) },
  { key: 'normalise', name: 'Normalising', cMin: 0, cMax: 1.5, range: (c) => [upperCritical(c) + 30, upperCritical(c) + 80] },
  { key: 'harden', name: 'Hardening', cMin: 0, cMax: FE_C.gammaMaxC, range: (c) => (c <= FE_C.eutectoidC ? [a3(c) + 30, a3(c) + 50] : [A1 + 30, A1 + 50]) },
  { key: 'spheroidise', name: 'Spheroidising', cMin: 0.6, cMax: FE_C.gammaMaxC, range: () => [680, 720] },
  { key: 'stress', name: 'Stress relieving', cMin: 0, cMax: FE_C.gammaMaxC, range: () => [550, 650] },
  { key: 'process', name: 'Process annealing', cMin: 0, cMax: FE_C.gammaMaxC, range: () => [550, 700] },
  {
    key: 'hotwork',
    name: 'Hot working / forging',
    cMin: 0,
    cMax: FE_C.gammaMaxC,
    range: (c) => [Math.max(900, upperCritical(c) + 50), Math.min(1250, solidus(Math.max(c, FE_C.peritecticC)) - 100)],
  },
]

/** Band polygon samples [C, Tlow, Thigh] where the window is valid (Thigh > Tlow). */
export function htBand(p: HtProcess, n = 120): [number, number, number][] {
  const cs = Array.from({ length: n + 1 }, (_, i) => p.cMin + ((p.cMax - p.cMin) * i) / n)
  if (FE_C.eutectoidC > p.cMin && FE_C.eutectoidC < p.cMax) cs.push(FE_C.eutectoidC)
  return cs
    .sort((a, b) => a - b)
    .map((c) => [c, ...p.range(c)] as [number, number, number])
    .filter(([, lo, hi]) => hi > lo)
}

/** Room-temperature microconstituents after slow (equilibrium) cooling, by the lever rule. */
export function leverRule(c: number) {
  const { alphaMaxC: a, eutectoidC: e, cementiteC: k, gammaMaxC: g } = FE_C
  if (c <= a) return { pearlite: 0, proeutectoidFerrite: 100, proeutectoidCementite: 0 }
  if (c <= e) {
    const p = ((c - a) / (e - a)) * 100
    return { pearlite: p, proeutectoidFerrite: 100 - p, proeutectoidCementite: 0 }
  }
  if (c <= g) {
    const p = ((k - c) / (k - e)) * 100
    return { pearlite: p, proeutectoidFerrite: 0, proeutectoidCementite: 100 - p }
  }
  return null // cast iron: ledeburitic, lever rule for steels does not apply
}

/** Total phase fractions (wt %) at room temperature: ferrite vs cementite (α solubility ≈ 0). */
export function roomTempPhases(c: number) {
  const C = Math.max(0, Math.min(FE_C.cementiteC, c))
  const cementite = (C / FE_C.cementiteC) * 100
  return { ferrite: 100 - cementite, cementite }
}

/** Approximate slow-cooled hardness (HV) by rule of mixtures: ferrite ~80, pearlite ~200–250, cementite ~800. */
export function approxHardness(c: number) {
  const l = leverRule(c)
  if (!l) return null
  const mix = (pHv: number) => (l.proeutectoidFerrite * 80 + l.pearlite * pHv + l.proeutectoidCementite * 800) / 100
  return { low: mix(200), high: mix(250) }
}

/** Inverse lever rule: approximate %C of a slowly cooled ferrite–pearlite steel from its pearlite area %. */
export function carbonFromPearlite(pearlitePercent: number) {
  const p = Math.max(0, Math.min(100, pearlitePercent)) / 100
  return FE_C.alphaMaxC + p * (FE_C.eutectoidC - FE_C.alphaMaxC)
}
