import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import {
  applyTheme,
  normalizeThemeId,
  persistCustomThemes,
  readCustomThemes,
  readStoredTheme,
  type AppThemeId,
  type CustomThemeDef,
} from '@/lib/appTheme'

type AppThemeContextValue = {
  theme: AppThemeId
  setTheme: (theme: AppThemeId) => void
  customThemes: CustomThemeDef[]
  saveCustomTheme: (def: CustomThemeDef) => void
  removeCustomTheme: (id: string) => void
}

const AppThemeContext = createContext<AppThemeContextValue | null>(null)

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppThemeId>(() => readStoredTheme())
  const [customThemes, setCustomThemes] = useState<CustomThemeDef[]>(() => readCustomThemes())

  const setTheme = useCallback((next: AppThemeId) => setThemeState(normalizeThemeId(next, customThemes)), [customThemes])

  const saveCustomTheme = useCallback(
    (def: CustomThemeDef) => {
      const next = [...customThemes.filter((t) => t.id !== def.id), def]
      persistCustomThemes(next)
      setCustomThemes(next)
      setThemeState(def.id)
    },
    [customThemes],
  )

  const removeCustomTheme = useCallback(
    (id: string) => {
      const next = customThemes.filter((t) => t.id !== id)
      persistCustomThemes(next)
      setCustomThemes(next)
      if (theme === id) setThemeState('light')
    },
    [customThemes, theme],
  )

  useLayoutEffect(() => applyTheme(theme, customThemes), [theme, customThemes])

  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system', customThemes)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme, customThemes])

  const value = useMemo(
    () => ({ theme, setTheme, customThemes, saveCustomTheme, removeCustomTheme }),
    [theme, setTheme, customThemes, saveCustomTheme, removeCustomTheme],
  )
  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppTheme() {
  const ctx = useContext(AppThemeContext)
  if (!ctx) throw new Error('useAppTheme must be used within AppThemeProvider')
  return ctx
}
