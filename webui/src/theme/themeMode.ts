import { useCallback, useState } from 'react'

/** What the viewer asked for -- not what is on screen. `system` defers to the
 * OS, which is what both `index.css`'s `prefers-color-scheme` block and
 * `useIsDarkMode` fall back to when no explicit choice is stored. */
export type ThemeMode = 'system' | 'light' | 'dark'

export const THEME_MODES: ThemeMode[] = ['system', 'light', 'dark']

// Same `ft.` namespace `useStickyState` writes under, so everything this panel
// remembers about a viewer sits in one prefix. Not routed through that hook:
// the mode has to be applied to <html> before React mounts (see main.tsx), or
// the first paint flashes the OS theme before switching.
const STORAGE_KEY = 'ft.themeMode'

export function readThemeMode(): ThemeMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return THEME_MODES.includes(raw as ThemeMode) ? (raw as ThemeMode) : 'system'
  } catch {
    // Storage blocked (private mode, site data off): follow the OS.
    return 'system'
  }
}

/** Writes the choice onto <html>, where the CSS is waiting for it:
 * `[data-theme='dark']` forces dark, `[data-theme='light']` opts out of the
 * `prefers-color-scheme` block, and no attribute at all means "follow the OS".
 * `useIsDarkMode` watches the same attribute so the ECharts canvases -- which
 * need literal colours, not custom properties -- flip with the chrome. */
export function applyThemeMode(mode: ThemeMode): void {
  const root = document.documentElement
  if (mode === 'system') delete root.dataset.theme
  else root.dataset.theme = mode
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // Unavailable storage costs the choice on the next reload, nothing more.
  }
}

export function useThemeMode(): [ThemeMode, (mode: ThemeMode) => void] {
  const [mode, setMode] = useState<ThemeMode>(readThemeMode)

  const choose = useCallback((next: ThemeMode) => {
    applyThemeMode(next)
    setMode(next)
  }, [])

  return [mode, choose]
}
