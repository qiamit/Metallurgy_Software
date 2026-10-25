import { FE_C, acm } from '@/features/phase-diagram/feC'

export const ELEMENTS = ['C', 'Mn', 'Si', 'Cr', 'Ni', 'Mo', 'V', 'W', 'Cu', 'B'] as const
export type Element = (typeof ELEMENTS)[number]
export type Composition = Record<Element, number>

export const EMPTY_COMPOSITION: Composition = { C: 0, Mn: 0, Si: 0, Cr: 0, Ni: 0, Mo: 0, V: 0, W: 0, Cu: 0, B: 0 }

const comp = (c: Partial<Composition>): Composition => ({ ...EMPTY_COMPOSITION, ...c })

/** Nominal mid-range compositions (wt %). */
export const STEEL_PRESETS: { grade: string; comp: Composition }[] = [
  { grade: 'AISI 1018', comp: comp({ C: 0.18, Mn: 0.75, Si: 0.2 }) },
  { grade: 'AISI 1020', comp: comp({ C: 0.2, Mn: 0.45, Si: 0.2 }) },
  { grade: 'AISI 1045', comp: comp({ C: 0.46, Mn: 0.75, Si: 0.25 }) },
  { grade: 'AISI 1060', comp: comp({ C: 0.6, Mn: 0.75, Si: 0.25 }) },
  { grade: 'AISI 1080', comp: comp({ C: 0.81, Mn: 0.75, Si: 0.25 }) },
  { grade: 'AISI 1095', comp: comp({ C: 0.96, Mn: 0.4, Si: 0.25 }) },
  { grade: 'AISI 4130', comp: comp({ C: 0.3, Mn: 0.5, Si: 0.25, Cr: 0.95, Mo: 0.2 }) },
  { grade: 'AISI 4140', comp: comp({ C: 0.4, Mn: 0.88, Si: 0.25, Cr: 0.95, Mo: 0.2 }) },
  { grade: 'AISI 4340', comp: comp({ C: 0.4, Mn: 0.7, Si: 0.25, Cr: 0.8, Ni: 1.83, Mo: 0.25 }) },
  { grade: 'AISI 5140', comp: comp({ C: 0.4, Mn: 0.8, Si: 0.25, Cr: 0.8 }) },
  { grade: 'AISI 52100', comp: comp({ C: 1.04, Mn: 0.35, Si: 0.25, Cr: 1.45 }) },
  { grade: 'AISI 8620', comp: comp({ C: 0.2, Mn: 0.8, Si: 0.25, Ni: 0.55, Cr: 0.5, Mo: 0.2 }) },
  { grade: 'EN8 (080M40)', comp: comp({ C: 0.4, Mn: 0.8, Si: 0.25 }) },
  { grade: 'EN19 (709M40)', comp: comp({ C: 0.4, Mn: 0.85, Si: 0.25, Cr: 1.05, Mo: 0.3 }) },
  { grade: 'EN24 (817M40)', comp: comp({ C: 0.4, Mn: 0.58, Si: 0.25, Cr: 1.2, Ni: 1.5, Mo: 0.28 }) },
  { grade: 'EN31', comp: comp({ C: 1.05, Mn: 0.5, Si: 0.25, Cr: 1.3 }) },
  { grade: 'C45 (1.0503)', comp: comp({ C: 0.45, Mn: 0.65, Si: 0.25 }) },
  { grade: '42CrMo4', comp: comp({ C: 0.42, Mn: 0.75, Si: 0.25, Cr: 1.05, Mo: 0.23 }) },
  { grade: '16MnCr5', comp: comp({ C: 0.16, Mn: 1.15, Si: 0.25, Cr: 0.95 }) },
  { grade: '20MnCr5', comp: comp({ C: 0.2, Mn: 1.25, Si: 0.25, Cr: 1.15 }) },
]

/** Andrews (1965) lower critical temperature, °C (As term omitted). */
export function andrewsAc1(x: Composition) {
  return 723 - 10.7 * x.Mn - 16.9 * x.Ni + 29.1 * x.Si + 16.9 * x.Cr + 6.38 * x.W
}

/** Andrews (1965) upper critical temperature, °C. */
export function andrewsAc3(x: Composition) {
  return 910 - 203 * Math.sqrt(Math.max(0, x.C)) - 15.2 * x.Ni + 44.7 * x.Si + 104 * x.V + 31.5 * x.Mo + 13.1 * x.W
}

/** Andrews linear martensite-start, °C. */
export function msAndrews(x: Composition) {
  return 539 - 423 * x.C - 30.4 * x.Mn - 17.7 * x.Ni - 12.1 * x.Cr - 7.5 * x.Mo
}

/** Approximate martensite-finish, °C. */
export function mfApprox(x: Composition) {
  return msAndrews(x) - 215
}

/** Steven & Haynes (1956) bainite-start, °C. */
export function bsStevenHaynes(x: Composition) {
  return 830 - 270 * x.C - 90 * x.Mn - 37 * x.Ni - 70 * x.Cr - 83 * x.Mo
}

/** IIW carbon equivalent. */
export function ceIIW(x: Composition) {
  return x.C + x.Mn / 6 + (x.Cr + x.Mo + x.V) / 5 + (x.Ni + x.Cu) / 15
}

export function weldability(ce: number): { label: string; tone: 'ok' | 'warn' | 'danger' } {
  if (ce <= 0.4) return { label: 'Good', tone: 'ok' }
  if (ce <= 0.6) return { label: 'Preheat', tone: 'warn' }
  return { label: 'Difficult', tone: 'danger' }
}

/** Ito–Bessyo Pcm. */
export function pcm(x: Composition) {
  return x.C + x.Si / 30 + (x.Mn + x.Cu + x.Cr) / 20 + x.Ni / 60 + x.Mo / 15 + x.V / 10 + 5 * x.B
}

/** Max as-quenched hardness of 100 % martensite (Just, plain-carbon basis), HRC; capped at 0.6 % C. */
export function maxMartensiteHRC(c: number) {
  const capped = c > 0.6
  return { hrc: 20 + 60 * Math.sqrt(Math.max(0, Math.min(0.6, c))), capped }
}

export type Range = [number, number]

/** Suggested temperatures from composition critical points (°C). */
export function suggestedTemps(x: Composition) {
  const ac1 = andrewsAc1(x)
  const ac3 = andrewsAc3(x)
  const hypo = x.C <= FE_C.eutectoidC
  const upper = hypo ? ac3 : Math.max(ac1, acm(x.C))
  const hardening: Range = hypo ? [ac3 + 30, ac3 + 50] : [ac1 + 30, ac1 + 50]
  return {
    hardening,
    normalising: [upper + 30, upper + 80] as Range,
    annealing: hardening,
  }
}
