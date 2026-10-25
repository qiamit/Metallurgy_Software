import { useState } from 'react'
import { Check, Trash2 } from 'lucide-react'
import { useAppTheme } from '@/hooks/useAppTheme'
import { makeCustomThemeId, normalizeHex, THEME_CHOICES, themeSwatch, type AppThemeId, type ThemeMode } from '@/lib/appTheme'

function ThemeCard({ id, label, active, onPick, onDelete }: {
  id: AppThemeId
  label: string
  active: boolean
  onPick: () => void
  onDelete?: () => void
}) {
  const sw = themeSwatch(id)
  return (
    <div
      className={`card p-0 overflow-hidden ${active ? 'ring-2 ring-[var(--accent)]' : ''}`}
      style={{ borderColor: active ? 'var(--accent)' : undefined }}
    >
      <button type="button" onClick={onPick} className="block w-full text-left" aria-pressed={active}>
        <div className="flex h-16" aria-hidden>
          <div className="w-1/4" style={{ background: sw.sidebar }} />
          <div className="flex-1 p-2 space-y-1.5" style={{ background: sw.bg }}>
            <div className="h-2 w-2/3" style={{ background: sw.ink, opacity: 0.7 }} />
            <div className="h-5 border" style={{ background: sw.panel, borderColor: sw.line }} />
            <div className="h-2 w-1/3" style={{ background: sw.accent }} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] px-3 py-2">
          <span className="text-sm font-medium truncate">{label}</span>
          {active && <Check size={16} className="text-[var(--accent)] shrink-0" />}
        </div>
      </button>
      {onDelete && (
        <button type="button" className="w-full border-t border-[var(--line)] px-3 py-1.5 text-xs text-[var(--danger)] inline-flex items-center gap-1" onClick={onDelete}>
          <Trash2 size={12} /> Delete
        </button>
      )}
    </div>
  )
}

export function ThemeSection() {
  const { theme, setTheme, customThemes, saveCustomTheme, removeCustomTheme } = useAppTheme()
  const [name, setName] = useState('')
  const [accent, setAccent] = useState('#0f766e')
  const [mode, setMode] = useState<ThemeMode>('light')

  function addCustom(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    saveCustomTheme({ id: makeCustomThemeId(name), name: name.trim().slice(0, 40), accent: normalizeHex(accent), mode })
    setName('')
  }

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <h2 className="section-title">Themes</h2>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {THEME_CHOICES.map((t) => (
            <ThemeCard key={t.value} id={t.value} label={t.label} active={theme === t.value} onPick={() => setTheme(t.value)} />
          ))}
          {customThemes.map((t) => (
            <ThemeCard
              key={t.id}
              id={t.id}
              label={t.name}
              active={theme === t.id}
              onPick={() => setTheme(t.id)}
              onDelete={() => removeCustomTheme(t.id)}
            />
          ))}
        </div>
      </section>

      <form className="card p-5" onSubmit={addCustom}>
        <h2 className="section-title">Custom Theme</h2>
        <div className="form-grid">
          <label className="field">
            <span>Name</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required />
          </label>
          <label className="field">
            <span>Accent Colour</span>
            <input className="input h-[var(--control-h)] p-1" type="color" value={accent} onChange={(e) => setAccent(e.target.value)} />
          </label>
          <label className="field">
            <span>Mode</span>
            <select className="input" value={mode} onChange={(e) => setMode(e.target.value as ThemeMode)}>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary">Save Theme</button>
        </div>
      </form>
    </div>
  )
}
