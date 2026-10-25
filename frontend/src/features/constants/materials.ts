/** Typical handbook values at ~20 °C. null = not listed. */
export interface MaterialRow {
  name: string
  density: number | null // g/cm³
  E: number | null // GPa
  G: number | null // GPa
  poisson: number | null
  expansion: number | null // 10⁻⁶/K
  conductivity: number | null // W/(m·K)
  specificHeat: number | null // J/(kg·K)
  melting: string | null // °C
  resistivity: number | null // µΩ·cm
}

export const MATERIALS: MaterialRow[] = [
  { name: 'Carbon steel (1020)', density: 7.87, E: 200, G: 80, poisson: 0.29, expansion: 11.7, conductivity: 51.9, specificHeat: 486, melting: '1420–1520', resistivity: 15.9 },
  { name: 'Low-alloy steel (4140)', density: 7.85, E: 205, G: 80, poisson: 0.29, expansion: 12.3, conductivity: 42.6, specificHeat: 473, melting: null, resistivity: 22 },
  { name: 'Stainless 304', density: 8.0, E: 193, G: 77, poisson: 0.29, expansion: 17.3, conductivity: 16.2, specificHeat: 500, melting: '1400–1455', resistivity: 72 },
  { name: 'Stainless 430', density: 7.75, E: 200, G: null, poisson: null, expansion: 10.4, conductivity: 26.1, specificHeat: 460, melting: '1425–1510', resistivity: 60 },
  { name: 'Grey cast iron', density: 7.15, E: 100, G: 40, poisson: 0.26, expansion: 10.8, conductivity: 46, specificHeat: 490, melting: '1150–1200', resistivity: null },
  { name: 'Ductile iron', density: 7.1, E: 169, G: 64, poisson: 0.29, expansion: null, conductivity: 36, specificHeat: null, melting: null, resistivity: null },
  { name: 'Aluminium (pure)', density: 2.7, E: 69, G: 26, poisson: 0.33, expansion: 23.6, conductivity: 237, specificHeat: 897, melting: '660.3', resistivity: 2.65 },
  { name: 'Aluminium 6061-T6', density: 2.7, E: 68.9, G: 26, poisson: 0.33, expansion: 23.6, conductivity: 167, specificHeat: 896, melting: '582–652', resistivity: 3.99 },
  { name: 'Copper (pure)', density: 8.96, E: 117, G: 44, poisson: 0.34, expansion: 16.5, conductivity: 401, specificHeat: 385, melting: '1084.6', resistivity: 1.68 },
  { name: 'Brass 70/30', density: 8.53, E: 110, G: 42, poisson: 0.375, expansion: 19.9, conductivity: 120, specificHeat: 375, melting: '915–955', resistivity: 6.2 },
  { name: 'Titanium CP (Gr 2)', density: 4.51, E: 105, G: 45, poisson: 0.37, expansion: 8.6, conductivity: 16.4, specificHeat: 523, melting: '1665', resistivity: 56 },
  { name: 'Ti-6Al-4V', density: 4.43, E: 114, G: 44, poisson: 0.34, expansion: 8.6, conductivity: 6.7, specificHeat: 526, melting: '1604–1660', resistivity: 178 },
  { name: 'Nickel (pure)', density: 8.9, E: 200, G: 76, poisson: 0.31, expansion: 13.4, conductivity: 90.9, specificHeat: 444, melting: '1455', resistivity: 6.9 },
  { name: 'Tungsten', density: 19.3, E: 411, G: 161, poisson: 0.28, expansion: 4.5, conductivity: 173, specificHeat: 132, melting: '3422', resistivity: 5.4 },
]

export interface FeConstant {
  name: string
  value: string
  note: string
}

export const FE_CONSTANTS: FeConstant[] = [
  { name: 'α-Fe lattice parameter (BCC)', value: '0.286 65 nm', note: '20 °C' },
  { name: 'γ-Fe lattice parameter (FCC)', value: '≈0.3647 nm', note: '≈912 °C' },
  { name: 'Burgers vector α-Fe, b = a√3/2', value: '0.248 nm', note: '⟨111⟩/2' },
  { name: 'Fe atomic mass', value: '55.845', note: 'g/mol' },
  { name: 'Fe density', value: '7.874', note: 'g/cm³' },
  { name: 'Fe melting point', value: '1538 °C', note: '' },
  { name: 'δ → γ (A4)', value: '1394 °C', note: 'pure Fe' },
  { name: 'γ → α (A3)', value: '912 °C', note: 'pure Fe' },
  { name: 'Curie temperature (A2)', value: '770 °C', note: '' },
  { name: 'Cementite Fe₃C', value: '6.67 wt % C', note: '' },
  { name: 'Eutectoid (A1)', value: '727 °C', note: '0.77 wt % C' },
  { name: 'Eutectic', value: '1148 °C', note: '4.30 wt % C' },
  { name: 'Max. C in γ-Fe', value: '2.11 wt %', note: '1148 °C' },
  { name: 'Max. C in α-Fe', value: '0.022 wt %', note: '727 °C' },
]
