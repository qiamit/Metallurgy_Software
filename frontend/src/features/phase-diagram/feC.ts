/**
 * Fe–Fe₃C (metastable) diagram — key points as on the lab's Iron–Carbon/Cementite chart (Scan-0131).
 * Boundaries are drawn as straight segments between the invariant points (simplified diagram).
 */
export const FE_C = {
  meltFe: 1538,
  delta: 1394, // δ ⇄ γ in pure iron
  a3Fe: 912, // γ ⇄ α in pure iron
  eutectoidT: 727,
  eutectoidC: 0.77,
  alphaMaxC: 0.022,
  peritecticT: 1495,
  peritecticC: 0.17,
  eutecticT: 1148,
  eutecticC: 4.3,
  gammaMaxC: 2.11,
  cementiteC: 6.67,
}

const lerp = (x: number, x0: number, y0: number, x1: number, y1: number) => y0 + ((x - x0) * (y1 - y0)) / (x1 - x0)

export function a3(c: number) {
  return lerp(c, 0, FE_C.a3Fe, FE_C.eutectoidC, FE_C.eutectoidT)
}
export function acm(c: number) {
  return lerp(c, FE_C.eutectoidC, FE_C.eutectoidT, FE_C.gammaMaxC, FE_C.eutecticT)
}
export function liquidus(c: number) {
  return c <= FE_C.eutecticC
    ? lerp(c, 0, FE_C.meltFe, FE_C.eutecticC, FE_C.eutecticT)
    : lerp(c, FE_C.eutecticC, FE_C.eutecticT, FE_C.cementiteC, 1252)
}
export function solidus(c: number) {
  return lerp(c, FE_C.peritecticC, FE_C.peritecticT, FE_C.gammaMaxC, FE_C.eutecticT)
}

export type PhaseField = { phases: string; note: string }

export function phaseAt(c: number, t: number): PhaseField {
  const C = Math.max(0, Math.min(FE_C.cementiteC, c))
  if (t >= liquidus(C)) return { phases: 'Liquid', note: 'Fully molten.' }
  if (t >= FE_C.eutecticT) {
    if (C >= FE_C.eutecticC) return { phases: 'Liquid + Fe₃C', note: 'Primary cementite crystallising from the melt (hypereutectic).' }
    if (C <= FE_C.peritecticC && t >= FE_C.delta) return { phases: 'δ-ferrite (± γ / L)', note: 'High-temperature δ region near the peritectic.' }
    if (t >= solidus(C)) return { phases: 'Liquid + Austenite (γ)', note: 'Mushy zone: primary austenite dendrites in liquid.' }
    return { phases: 'Austenite (γ)', note: 'Single-phase austenite — hot working / solution range.' }
  }
  if (t > FE_C.eutectoidT) {
    if (C > FE_C.gammaMaxC) return { phases: 'Austenite + Fe₃C (ledeburite)', note: 'Cast iron range: eutectic ledeburite with austenite.' }
    if (C <= FE_C.eutectoidC) {
      if (t >= a3(C)) return { phases: 'Austenite (γ)', note: 'Above A₃ — normalising / hardening temperature range.' }
      if (C <= FE_C.alphaMaxC) return { phases: 'Ferrite (α) + Austenite (γ)', note: 'Intercritical (low carbon).' }
      return { phases: 'Ferrite (α) + Austenite (γ)', note: 'Intercritical range between A₁ and A₃.' }
    }
    if (t >= acm(C)) return { phases: 'Austenite (γ)', note: 'Above A_cm — full austenite.' }
    return { phases: 'Austenite (γ) + Fe₃C', note: 'Between A₁ and A_cm: proeutectoid cementite with austenite.' }
  }
  if (C <= FE_C.alphaMaxC) return { phases: 'Ferrite (α)', note: 'Nearly pure ferrite.' }
  if (C < FE_C.eutectoidC) return { phases: 'Ferrite (α) + Fe₃C', note: 'Hypoeutectoid steel: proeutectoid ferrite + pearlite (slow cooling).' }
  if (Math.abs(C - FE_C.eutectoidC) < 1e-9) return { phases: 'Ferrite (α) + Fe₃C', note: 'Eutectoid steel: fully pearlitic (slow cooling).' }
  if (C <= FE_C.gammaMaxC) return { phases: 'Ferrite (α) + Fe₃C', note: 'Hypereutectoid steel: pearlite + grain-boundary cementite.' }
  return { phases: 'Ferrite (α) + Fe₃C', note: 'White cast iron: transformed ledeburite + pearlite (metastable).' }
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

/** Inverse lever rule: approximate %C of a slowly cooled ferrite–pearlite steel from its pearlite area %. */
export function carbonFromPearlite(pearlitePercent: number) {
  const p = Math.max(0, Math.min(100, pearlitePercent)) / 100
  return FE_C.alphaMaxC + p * (FE_C.eutectoidC - FE_C.alphaMaxC)
}
