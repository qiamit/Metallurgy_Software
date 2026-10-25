/** Unit definitions. Linear units carry an exact factor to the SI coherent unit of their category. */

export interface LinearUnit {
  id: string
  label: string
  /** Multiply a value in this unit by `factor` to get the SI value. */
  factor: number
}

export interface UnitCategory {
  id: string
  label: string
  units: LinearUnit[]
  /** Non-linear categories (temperature) use toSI/fromSI. */
  toSI?: (unitId: string, v: number) => number
  fromSI?: (unitId: string, v: number) => number
}

// Exact base definitions
const INCH = 0.0254
const FOOT = 0.3048
const POUND = 0.45359237
const G_N = 9.80665
const LBF = 4.4482216152605
const PSI = 6894.757293168
const CAL_IT = 4.1868
const BTU_IT = 1055.05585262
const HP = 550 * FOOT * LBF // 745.699 871 582 270 22 W
const PS = 735.49875
const ATM = 101325

const u = (id: string, factor: number, label = id): LinearUnit => ({ id, label, factor })

const temperatureToK: Record<string, (v: number) => number> = {
  '°C': (v) => v + 273.15,
  K: (v) => v,
  '°F': (v) => ((v - 32) * 5) / 9 + 273.15,
  '°R': (v) => (v * 5) / 9,
}
const temperatureFromK: Record<string, (v: number) => number> = {
  '°C': (k) => k - 273.15,
  K: (k) => k,
  '°F': (k) => ((k - 273.15) * 9) / 5 + 32,
  '°R': (k) => (k * 9) / 5,
}

export const UNIT_CATEGORIES: UnitCategory[] = [
  {
    id: 'length',
    label: 'Length',
    units: [
      u('m', 1), u('mm', 1e-3), u('µm', 1e-6), u('nm', 1e-9), u('Å', 1e-10), u('cm', 1e-2), u('km', 1e3),
      u('in', INCH), u('ft', FOOT), u('yd', 3 * FOOT), u('mil', INCH / 1000, 'mil (thou)'), u('mile', 5280 * FOOT),
    ],
  },
  {
    id: 'area',
    label: 'Area',
    units: [u('m²', 1), u('mm²', 1e-6), u('cm²', 1e-4), u('in²', INCH * INCH), u('ft²', FOOT * FOOT)],
  },
  {
    id: 'volume',
    label: 'Volume',
    units: [
      u('m³', 1), u('L', 1e-3), u('mL', 1e-6, 'mL (cm³)'), u('in³', INCH ** 3), u('ft³', FOOT ** 3),
      u('US gal', 231 * INCH ** 3), u('imp gal', 4.54609e-3),
    ],
  },
  {
    id: 'mass',
    label: 'Mass',
    units: [
      u('kg', 1), u('g', 1e-3), u('mg', 1e-6), u('t', 1000, 't (tonne)'), u('lb', POUND), u('oz', POUND / 16),
      u('short ton', 2000 * POUND),
    ],
  },
  {
    id: 'force',
    label: 'Force',
    units: [
      u('N', 1), u('kN', 1e3), u('MN', 1e6), u('kgf', G_N), u('gf', G_N / 1000), u('lbf', LBF), u('kip', 1000 * LBF),
      u('dyn', 1e-5),
    ],
  },
  {
    id: 'stress',
    label: 'Stress / pressure',
    units: [
      u('Pa', 1), u('kPa', 1e3), u('MPa', 1e6), u('GPa', 1e9), u('N/mm²', 1e6), u('kgf/mm²', G_N * 1e6),
      u('kgf/cm²', G_N * 1e4), u('psi', PSI), u('ksi', PSI * 1000), u('bar', 1e5), u('mbar', 100), u('atm', ATM),
      u('Torr', ATM / 760, 'Torr (mmHg)'), u('inHg', 3386.389),
    ],
  },
  {
    id: 'energy',
    label: 'Energy / impact',
    units: [
      u('J', 1), u('kJ', 1e3), u('MJ', 1e6), u('kWh', 3.6e6), u('cal', CAL_IT, 'cal (IT)'), u('kcal', CAL_IT * 1000),
      u('eV', 1.602176634e-19), u('BTU', BTU_IT, 'BTU (IT)'), u('ft·lbf', FOOT * LBF), u('kgf·m', G_N), u('erg', 1e-7),
    ],
  },
  {
    id: 'power',
    label: 'Power',
    units: [
      u('W', 1), u('kW', 1e3), u('MW', 1e6), u('hp', HP, 'hp (mechanical)'), u('PS', PS, 'PS (metric hp)'),
      u('BTU/h', BTU_IT / 3600),
    ],
  },
  {
    id: 'torque',
    label: 'Torque',
    units: [u('N·m', 1), u('kgf·m', G_N), u('lbf·ft', LBF * FOOT), u('lbf·in', LBF * INCH)],
  },
  {
    id: 'temperature',
    label: 'Temperature',
    units: [u('°C', 1), u('K', 1), u('°F', 1), u('°R', 1)],
    toSI: (id, v) => temperatureToK[id](v),
    fromSI: (id, k) => temperatureFromK[id](k),
  },
  {
    id: 'density',
    label: 'Density',
    units: [u('kg/m³', 1), u('g/cm³', 1000), u('lb/in³', POUND / INCH ** 3), u('lb/ft³', POUND / FOOT ** 3)],
  },
  {
    id: 'toughness',
    label: 'Fracture toughness',
    // SI coherent: MPa·√m
    units: [u('MPa·√m', 1), u('ksi·√in', (PSI * 1000 * Math.sqrt(INCH)) / 1e6), u('N/mm^1.5', Math.sqrt(1e-3))],
  },
  {
    id: 'conductivity',
    label: 'Thermal conductivity',
    units: [
      u('W/(m·K)', 1), u('BTU/(h·ft·°F)', (BTU_IT / 3600 / FOOT) * 1.8), u('cal/(s·cm·°C)', CAL_IT * 100),
    ],
  },
  {
    id: 'specificHeat',
    label: 'Specific heat',
    units: [
      u('J/(kg·K)', 1), u('kJ/(kg·K)', 1000), u('BTU/(lb·°F)', (BTU_IT / POUND) * 1.8), u('cal/(g·°C)', CAL_IT * 1000),
    ],
  },
  {
    id: 'velocity',
    label: 'Velocity',
    units: [
      u('m/s', 1), u('mm/s', 1e-3), u('m/min', 1 / 60), u('km/h', 1 / 3.6), u('ft/s', FOOT), u('ft/min', FOOT / 60),
      u('in/min', INCH / 60), u('mph', (5280 * FOOT) / 3600),
    ],
  },
  {
    id: 'angle',
    label: 'Angle',
    units: [u('rad', 1), u('°', Math.PI / 180), u('gon', Math.PI / 200), u('′', Math.PI / 10800, 'arcmin'), u('″', Math.PI / 648000, 'arcsec')],
  },
  {
    id: 'time',
    label: 'Time',
    units: [u('s', 1), u('ms', 1e-3), u('min', 60), u('h', 3600), u('day', 86400)],
  },
]

export const CATEGORY_BY_ID = new Map(UNIT_CATEGORIES.map((cat) => [cat.id, cat]))

export function toSI(cat: UnitCategory, unitId: string, v: number): number {
  if (cat.toSI) return cat.toSI(unitId, v)
  const unit = cat.units.find((x) => x.id === unitId)
  return unit ? v * unit.factor : NaN
}

export function fromSI(cat: UnitCategory, unitId: string, si: number): number {
  if (cat.fromSI) return cat.fromSI(unitId, si)
  const unit = cat.units.find((x) => x.id === unitId)
  return unit ? si / unit.factor : NaN
}

export function convert(cat: UnitCategory, from: string, to: string, v: number): number {
  return fromSI(cat, to, toSI(cat, from, v))
}
