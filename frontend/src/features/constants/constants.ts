/** CODATA 2018 recommended values of the fundamental physical constants. */
export interface PhysicalConstant {
  name: string
  symbol: string
  /** Display value (digit groups separated by thin spaces). */
  value: string
  /** Machine-readable value, used for copying. */
  numeric: string
  unit: string
  exact: boolean
}

/** exact: true = defined exactly; 'trunc' = exact by definition but shown truncated (irrational / long). */
function c(name: string, symbol: string, numeric: string, unit: string, exact: boolean | 'trunc' = false): PhysicalConstant {
  const trunc = exact === 'trunc'
  const value = groupDigits(numeric, trunc)
  return { name, symbol, value, numeric, unit, exact: exact !== false }
}

/** "6.62607015e-34" → "6.626 070 15 × 10⁻³⁴" */
function groupDigits(numeric: string, ellipsis = false): string {
  const [mant, exp] = numeric.split('e')
  const [int, frac] = mant.split('.')
  const intG = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  const fracG = frac ? '.' + frac.replace(/(\d{3})(?=\d)/g, '$1 ') : ''
  const sup: Record<string, string> = {
    '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  }
  const expS = exp ? ` × 10${String(Number(exp)).split('').map((ch) => sup[ch] ?? ch).join('')}` : ''
  return intG + fracG + (ellipsis ? '…' : '') + expS
}

export const PHYSICAL_CONSTANTS: PhysicalConstant[] = [
  c('Speed of light in vacuum', 'c', '299792458', 'm/s', true),
  c('Planck constant', 'h', '6.62607015e-34', 'J·s', true),
  c('Reduced Planck constant', 'ħ', '1.054571817e-34', 'J·s', 'trunc'),
  c('Elementary charge', 'e', '1.602176634e-19', 'C', true),
  c('Boltzmann constant', 'k', '1.380649e-23', 'J/K', true),
  c('Boltzmann constant (eV)', 'k', '8.617333262e-5', 'eV/K', 'trunc'),
  c('Avogadro constant', 'N_A', '6.02214076e23', '1/mol', true),
  c('Molar gas constant', 'R', '8.314462618', 'J/(mol·K)', 'trunc'),
  c('Faraday constant', 'F', '96485.33212', 'C/mol', 'trunc'),
  c('Stefan–Boltzmann constant', 'σ', '5.670374419e-8', 'W/(m²·K⁴)', 'trunc'),
  c('Newtonian constant of gravitation', 'G', '6.67430e-11', 'm³/(kg·s²)'),
  c('Standard acceleration of gravity', 'g_n', '9.80665', 'm/s²', true),
  c('Electron mass', 'm_e', '9.1093837015e-31', 'kg'),
  c('Proton mass', 'm_p', '1.67262192369e-27', 'kg'),
  c('Neutron mass', 'm_n', '1.67492749804e-27', 'kg'),
  c('Atomic mass constant', 'u', '1.66053906660e-27', 'kg'),
  c('Vacuum electric permittivity', 'ε₀', '8.8541878128e-12', 'F/m'),
  c('Vacuum magnetic permeability', 'μ₀', '1.25663706212e-6', 'N/A²'),
  c('Bohr radius', 'a₀', '5.29177210903e-11', 'm'),
  c('Rydberg constant', 'R∞', '10973731.568160', '1/m'),
  c('Fine-structure constant', 'α', '7.2973525693e-3', '—'),
  c('Wien displacement constant', 'b', '2.897771955e-3', 'm·K', 'trunc'),
  c('Electron volt', 'eV', '1.602176634e-19', 'J', true),
  c('Standard atmosphere', 'atm', '101325', 'Pa', true),
  c('Molar volume of ideal gas (273.15 K, 101.325 kPa)', 'V_m', '22.41396954e-3', 'm³/mol', 'trunc'),
  c('Bohr magneton', 'μ_B', '9.2740100783e-24', 'J/T'),
  c('Loschmidt constant (273.15 K, 101.325 kPa)', 'n₀', '2.686780111e25', '1/m³', 'trunc'),
  c('First radiation constant', 'c₁', '3.741771852e-16', 'W·m²', 'trunc'),
  c('Second radiation constant', 'c₂', '1.438776877e-2', 'm·K', 'trunc'),
]
