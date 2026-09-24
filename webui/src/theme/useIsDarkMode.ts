import { useEffect, useState } from 'react'

/** Is the panel dark *right now* -- resolving the viewer's explicit choice
 * first, and the OS only when there is none.
 *
 * Two signals, because there are two ways the scheme can change: the theme
 * switch in the top bar writes `data-theme` onto <html> (see
 * theme/themeMode.ts), and with no such attribute the OS's
 * `prefers-color-scheme` decides. The CSS resolves that same pair in
 * `index.css`; this hook exists so the ECharts option-builders, which need
 * literal hex colours rather than CSS custom properties, resolve it
 * identically and never end up painting a light chart onto a dark panel.
 */
function resolve(): boolean {
  if (typeof window === 'undefined') return false
  const chosen = document.documentElement.dataset.theme
  if (chosen === 'dark') return true
  if (chosen === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function useIsDarkMode(): boolean {
  const [dark, setDark] = useState(resolve)

  useEffect(() => {
    const update = () => setDark(resolve())

    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    mql.addEventListener('change', update)

    // The attribute is written imperatively, so there is no React state to
    // subscribe to -- the DOM itself is the source of truth, and this is how
    // a chart hears about a flip that happened outside its own tree.
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    // The attribute may have been set between the initial state and this
    // effect running (main.tsx applies it before mount, StrictMode re-runs
    // effects), so re-read once rather than trusting the first resolve.
    update()

    return () => {
      mql.removeEventListener('change', update)
      observer.disconnect()
    }
  }, [])

  return dark
}
