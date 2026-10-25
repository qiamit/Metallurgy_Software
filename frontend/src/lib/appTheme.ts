/**
 * App-wide visual themes (Settings → Theme), same set as QIRLPL LIMS plus user custom themes.
 * Every theme is generated from an accent colour, a light / dark mode and a neutral tint, and written as CSS
 * variables on :root — both the app's own variables (--bg, --panel, --accent, …) and the --ui-* tokens used
 * by the Tailwind / shadcn components. Stored per browser.
 */

export const APP_THEME_STORAGE_KEY = 'ms.appTheme'
export const CUSTOM_THEMES_STORAGE_KEY = 'ms.customThemes'

export type ThemeMode = 'light' | 'dark'

type ThemeSpec = {
  label: string
  accent: string
  mode: ThemeMode
  /** Neutral (paper / sidebar) hue and saturation. */
  neutralHue: number
  neutralSat: number
}

export const BUILTIN_THEMES = {
  light: { label: 'Classic Amber', accent: '#b45309', mode: 'light', neutralHue: 30, neutralSat: 8 },
  dark: { label: 'Amber Night', accent: '#f59e0b', mode: 'dark', neutralHue: 30, neutralSat: 8 },
  ocean: { label: 'Ocean Blue', accent: '#1d4ed8', mode: 'light', neutralHue: 215, neutralSat: 16 },
  forest: { label: 'Forest Green', accent: '#15803d', mode: 'light', neutralHue: 140, neutralSat: 8 },
  steel: { label: 'Slate Steel', accent: '#475569', mode: 'light', neutralHue: 215, neutralSat: 14 },
  copper: { label: 'Copper Bronze', accent: '#9a3412', mode: 'light', neutralHue: 25, neutralSat: 12 },
  teal: { label: 'Industrial Teal', accent: '#0f766e', mode: 'light', neutralHue: 190, neutralSat: 12 },
  rose: { label: 'Soft Rose', accent: '#be123c', mode: 'light', neutralHue: 350, neutralSat: 8 },
} satisfies Record<string, ThemeSpec>

export type BuiltinThemeId = keyof typeof BUILTIN_THEMES
/** Builtin id, 'system' (Classic Amber / Amber Night by OS setting), or `custom_<slug>`. */
export type AppThemeId = BuiltinThemeId | 'system' | (string & {})

export type CustomThemeDef = { id: string; name: string; accent: string; mode: ThemeMode }

export const THEME_CHOICES: Array<{ value: AppThemeId; label: string }> = [
  { value: 'light', label: BUILTIN_THEMES.light.label },
  { value: 'dark', label: BUILTIN_THEMES.dark.label },
  { value: 'system', label: 'System Default' },
  ...(['ocean', 'forest', 'steel', 'copper', 'teal', 'rose'] as const).map((id) => ({
    value: id,
    label: BUILTIN_THEMES[id].label,
  })),
]

const isBuiltin = (v: string): v is BuiltinThemeId => Object.prototype.hasOwnProperty.call(BUILTIN_THEMES, v)
export const isCustomThemeId = (v: string) => v.startsWith('custom_')

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------
export function normalizeHex(value: string, fallback = '#b45309'): string {
  const raw = String(value ?? '').trim()
  const short = /^#([0-9a-f]{3})$/i.exec(raw)
  if (short) return `#${short[1].split('').map((c) => c + c).join('')}`.toLowerCase()
  return /^#[0-9a-f]{6}$/i.test(raw) ? raw.toLowerCase() : fallback
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const v = parseInt(normalizeHex(hex).slice(1), 16)
  const r = ((v >> 16) & 255) / 255
  const g = ((v >> 8) & 255) / 255
  const b = (v & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l: l * 100 }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: h * 60, s: s * 100, l: l * 100 }
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
/** "h s% l%" for hsl(var(--x)) tokens. */
const tok = (h: number, s: number, l: number) => `${Math.round(h)} ${clamp(Math.round(s), 0, 100)}% ${clamp(Math.round(l), 0, 100)}%`
const hsl = (h: number, s: number, l: number, a?: number) =>
  a === undefined ? `hsl(${tok(h, s, l).replace(/ /g, ', ')})` : `hsla(${tok(h, s, l).replace(/ /g, ', ')}, ${a})`

/** All CSS variables for one theme. */
export function buildThemeVars(accentHex: string, mode: ThemeMode, neutralHue: number, neutralSat: number) {
  const a = hexToHsl(accentHex)
  const h = a.h
  const s = clamp(a.s, mode === 'dark' ? 35 : 20, 90)
  const nh = neutralHue
  const ns = neutralSat
  const dark = mode === 'dark'
  // accent: buttons / links / focus. Slate-like (low saturation) accents keep their own lightness.
  const aL = dark ? clamp(Math.max(a.l, 50), 45, 62) : clamp(Math.min(a.l, 40), 28, 40)
  const n = (l: number, satMul = 1) => hsl(nh, ns * satMul, l)

  const v: Record<string, string> = {
    // surfaces
    '--bg': dark ? n(8) : n(96, 1.4),
    '--bg-subtle': dark ? n(11) : n(92, 1.2),
    '--panel': dark ? n(12) : n(99.5, 2),
    '--field': dark ? n(15) : n(98, 1.5),
    '--line': dark ? n(24) : n(84),
    '--line-strong': dark ? n(34) : n(64),
    '--ink': dark ? n(94, 1.5) : n(11),
    '--muted': dark ? n(66) : n(40),
    // sidebar: always dark, warm or cool by theme
    '--sidebar': dark ? n(6, 1.5) : n(11, 1.5),
    '--sidebar-elevated': dark ? n(9, 1.5) : n(15, 1.5),
    '--sidebar-hover': dark ? n(13, 1.5) : n(19, 1.5),
    '--sidebar-active': hsl(h, s * 0.6, dark ? 16 : 20),
    '--sidebar-border': dark ? n(16) : n(24),
    '--sidebar-accent-line': hsl(h, s, dark ? 55 : 52),
    '--sidebar-text': dark ? n(70) : n(74),
    '--sidebar-text-active': '#ffffff',
    // accent
    '--accent': hsl(h, s, aL),
    '--accent-hover': hsl(h, s, dark ? aL + 6 : aL - 6),
    '--accent-ink': hsl(h, s, dark ? 72 : clamp(aL - 4, 22, 36)),
    '--accent-soft': dark ? hsl(h, s * 0.5, 18) : hsl(h, s * 0.7, 94),
    '--accent-glow': hsl(h, s, aL, 0.18),
    '--accent-on': dark ? n(8) : '#ffffff',
    // status
    '--steel': dark ? '#93c5fd' : '#1e40af',
    '--steel-soft': dark ? '#172554' : '#dbeafe',
    '--warn': dark ? '#fbbf24' : '#b45309',
    '--danger': dark ? '#f87171' : '#b91c1c',
    '--ok': dark ? '#4ade80' : '#15803d',
    '--preview-bg': dark ? n(5) : n(9, 1.5),
    '--hero-grad': `linear-gradient(135deg, ${n(dark ? 6 : 10, 1.5)} 0%, ${hsl(h, s * 0.7, dark ? 16 : 22)} 55%, ${hsl(h, s, aL)} 100%)`,
    '--mesh-bg': dark ? n(8) : `linear-gradient(180deg, ${n(94, 1.6)} 0%, ${n(96, 1.4)} 40%, ${n(97, 1.2)} 100%)`,
    '--shadow-sm': dark ? '0 1px 2px rgba(0,0,0,0.4)' : '0 1px 2px rgba(28,25,23,0.06)',
    '--shadow-md': dark ? '0 4px 16px rgba(0,0,0,0.45)' : '0 4px 16px rgba(28,25,23,0.08)',
    '--shadow-lg': dark ? '0 12px 40px rgba(0,0,0,0.5)' : '0 12px 40px rgba(28,25,23,0.12)',
    // ring-test module keeps a dark workspace (image editor), tinted by the theme
    '--rt-bg': n(7, 1.5),
    '--rt-surface': n(10.5, 1.5),
    '--rt-surface-2': n(9, 1.5),
    '--rt-input': n(6, 1.5),
    '--rt-border': n(20, 1.2),
    '--rt-border-strong': n(27, 1.2),
    '--rt-fg': n(92),
    '--rt-muted': n(66),
    '--rt-subtle': n(48),
    '--rt-primary': hsl(h, s, dark ? aL : clamp(aL + 8, 36, 48)),
    '--rt-primary-hover': hsl(h, s, dark ? aL + 6 : clamp(aL + 2, 30, 42)),
    '--rt-primary-soft': hsl(h, s * 0.5, 18),
    '--rt-accent': hsl(h, s, 66),
    // --ui-* tokens (Tailwind / shadcn components)
    '--ui-background': dark ? tok(nh, ns, 8) : tok(nh, ns * 1.4, 96),
    '--ui-foreground': dark ? tok(nh, ns * 1.5, 94) : tok(nh, ns, 11),
    '--ui-card': dark ? tok(nh, ns, 12) : tok(nh, ns * 2, 99.5),
    '--ui-card-foreground': dark ? tok(nh, ns * 1.5, 94) : tok(nh, ns, 11),
    '--ui-popover': dark ? tok(nh, ns, 12) : tok(0, 0, 100),
    '--ui-popover-foreground': dark ? tok(nh, ns * 1.5, 94) : tok(nh, ns, 11),
    '--ui-primary': tok(h, s, aL),
    '--ui-primary-foreground': dark ? tok(nh, ns, 8) : tok(0, 0, 100),
    '--ui-secondary': dark ? tok(nh, ns, 18) : tok(nh, ns * 1.2, 92),
    '--ui-secondary-foreground': dark ? tok(nh, ns, 90) : tok(nh, ns, 20),
    '--ui-muted': dark ? tok(nh, ns, 16) : tok(nh, ns * 1.2, 93),
    '--ui-muted-foreground': dark ? tok(nh, ns, 66) : tok(nh, ns, 40),
    '--ui-accent': dark ? tok(h, s * 0.5, 18) : tok(h, s * 0.7, 94),
    '--ui-accent-foreground': dark ? tok(h, s, 80) : tok(h, s, clamp(aL - 6, 20, 34)),
    '--ui-border': dark ? tok(nh, ns, 24) : tok(nh, ns, 84),
    '--ui-input': dark ? tok(nh, ns, 28) : tok(nh, ns, 76),
    '--ui-ring': tok(h, s, dark ? aL : aL + 8),
    '--ui-sidebar': dark ? tok(nh, ns * 1.5, 6) : tok(nh, ns * 1.5, 11),
    '--ui-sidebar-foreground': tok(nh, ns, 74),
    '--ui-sidebar-border': dark ? tok(nh, ns, 16) : tok(nh, ns, 24),
    '--ui-sidebar-accent': tok(h, s, dark ? 55 : 46),
    '--ui-sidebar-accent-foreground': tok(0, 0, 100),
    '--ui-sidebar-muted': dark ? tok(nh, ns, 12) : tok(nh, ns, 16),
    '--ui-sidebar-ring': tok(h, s, 50),
  }
  return v
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------
export function readCustomThemes(): CustomThemeDef[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CUSTOM_THEMES_STORAGE_KEY) || '[]') as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((row) => {
      const r = row as Partial<CustomThemeDef>
      const id = String(r?.id ?? '')
      const name = String(r?.name ?? '').trim().slice(0, 40)
      if (!isCustomThemeId(id) || !name) return []
      return [{ id, name, accent: normalizeHex(String(r.accent)), mode: r.mode === 'dark' ? 'dark' : 'light' } as CustomThemeDef]
    })
  } catch {
    return []
  }
}

export function persistCustomThemes(themes: CustomThemeDef[]) {
  try {
    localStorage.setItem(CUSTOM_THEMES_STORAGE_KEY, JSON.stringify(themes))
  } catch {
    /* storage unavailable */
  }
}

export function makeCustomThemeId(name: string) {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || 'theme'
  return `custom_${slug}_${Math.random().toString(36).slice(2, 7)}`
}

export function normalizeThemeId(value: string | null | undefined, customs = readCustomThemes()): AppThemeId {
  const raw = String(value ?? '').trim()
  if (raw === 'system' || isBuiltin(raw)) return raw
  if (isCustomThemeId(raw) && customs.some((c) => c.id === raw)) return raw
  return 'light'
}

export function readStoredTheme(): AppThemeId {
  try {
    return normalizeThemeId(localStorage.getItem(APP_THEME_STORAGE_KEY))
  } catch {
    return 'light'
  }
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------
const STYLE_ID = 'ms-theme-vars'

/** The spec a theme preference resolves to right now. */
export function resolveTheme(pref: AppThemeId, customs = readCustomThemes()): ThemeSpec & { id: string } {
  if (pref === 'system') {
    const darkOs = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
    return { id: darkOs ? 'dark' : 'light', ...BUILTIN_THEMES[darkOs ? 'dark' : 'light'] }
  }
  if (isBuiltin(pref)) return { id: pref, ...BUILTIN_THEMES[pref] }
  const c = customs.find((t) => t.id === pref)
  if (c) return { id: c.id, label: c.name, accent: c.accent, mode: c.mode, neutralHue: hexToHsl(c.accent).h, neutralSat: 6 }
  return { id: 'light', ...BUILTIN_THEMES.light }
}

/** Write the theme's variables on <html>. Safe to call before React mounts. */
export function applyTheme(pref: AppThemeId, customs = readCustomThemes()) {
  if (typeof document === 'undefined') return
  const spec = resolveTheme(pref, customs)
  const vars = buildThemeVars(spec.accent, spec.mode, spec.neutralHue, spec.neutralSat)
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = STYLE_ID
    document.head.appendChild(style)
  }
  style.textContent = `:root {\n  color-scheme: ${spec.mode};\n${Object.entries(vars)
    .map(([k, val]) => `  ${k}: ${val};`)
    .join('\n')}\n}`
  const root = document.documentElement
  root.classList.toggle('dark', spec.mode === 'dark')
  root.setAttribute('data-app-theme', spec.id)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', vars['--sidebar'])
  try {
    localStorage.setItem(APP_THEME_STORAGE_KEY, pref)
  } catch {
    /* storage unavailable */
  }
}

/** Small preview colours for the theme picker. */
export function themeSwatch(pref: AppThemeId, customs = readCustomThemes()) {
  const spec = resolveTheme(pref, customs)
  const v = buildThemeVars(spec.accent, spec.mode, spec.neutralHue, spec.neutralSat)
  return { sidebar: v['--sidebar'], bg: v['--bg'], panel: v['--panel'], accent: v['--accent'], line: v['--line'], ink: v['--ink'] }
}
