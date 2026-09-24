import { render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { ThemeToggle } from '../components/ThemeToggle'
import { readThemeMode } from './themeMode'
import { useIsDarkMode } from './useIsDarkMode'

afterEach(() => {
  delete document.documentElement.dataset.theme
})

describe('the theme switch', () => {
  it('writes the choice onto <html>, remembers it, and takes the charts with it', async () => {
    // The chrome follows `data-theme` through CSS, but the ECharts canvases
    // cannot: they are handed literal hex colours, chosen by `useIsDarkMode`.
    // If the two resolved the theme differently, a chosen dark panel would
    // hold a light chart -- so they are asserted together here.
    const user = userEvent.setup()
    const { result } = renderHook(() => useIsDarkMode())
    render(<ThemeToggle />)

    expect(result.current).toBe(false)

    await user.click(screen.getByTitle('Dark theme'))

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(readThemeMode()).toBe('dark')
    expect(result.current).toBe(true)
  })

  it('drops the attribute again on "follow system", rather than pinning the OS theme of the moment', async () => {
    // `data-theme="light"` and no attribute at all look identical while the OS
    // is light -- and stay identical afterwards, which is the bug: the panel
    // would keep the scheme that happened to be in force when the viewer
    // asked to follow along.
    const user = userEvent.setup()
    render(<ThemeToggle />)

    await user.click(screen.getByTitle('Dark theme'))
    await user.click(screen.getByTitle('Follow system theme'))

    expect(document.documentElement.dataset.theme).toBeUndefined()
    expect(readThemeMode()).toBe('system')
  })
})
