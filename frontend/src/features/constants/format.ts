/** Format a number with significant digits; scientific notation for very large or small values. */
export function formatSig(value: number, sig = 6): string {
  if (!Number.isFinite(value)) return '—'
  if (value === 0) return '0'
  const abs = Math.abs(value)
  if (abs >= 1e7 || abs < 1e-4) {
    const [mant, exp] = value.toExponential(sig - 1).split('e')
    const m = mant.includes('.') ? mant.replace(/0+$/, '').replace(/\.$/, '') : mant
    const e = Number(exp)
    return `${m}e${e}`
  }
  const s = value.toPrecision(sig)
  if (s.includes('e')) return String(Number(s))
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s
}

/** Parse a user-entered number; accepts commas as decimal separators and spaces as digit groups. */
export function parseNum(raw: string): number {
  const t = raw.trim().replace(/\s+/g, '').replace(',', '.')
  if (t === '') return NaN
  return Number(t)
}
