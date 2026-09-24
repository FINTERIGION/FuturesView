import { useTranslation } from 'react-i18next'
import type { ThemeMode } from '../theme/themeMode'
import { useThemeMode } from '../theme/themeMode'
import type { IconName } from './Icon'
import { Icon } from './Icon'

const OPTIONS: { mode: ThemeMode; icon: IconName; key: string }[] = [
  { mode: 'system', icon: 'auto', key: 'workspace.themeSystem' },
  { mode: 'light', icon: 'sun', key: 'workspace.themeLight' },
  { mode: 'dark', icon: 'moon', key: 'workspace.themeDark' },
]

/**
 * Light / dark / follow-the-OS.
 *
 * All three are shown at once rather than cycled through one button: with a
 * cycle, "system" and whichever scheme the OS currently is look identical on
 * screen, so there is no way to tell a panel that is dark *because you asked*
 * from one that is dark *for now*. That distinction is the whole reason the
 * third option exists.
 */
export function ThemeToggle() {
  const { t } = useTranslation()
  const [mode, setMode] = useThemeMode()

  return (
    <div className="segmented" role="group" aria-label={t('workspace.theme')}>
      {OPTIONS.map((o) => (
        <button
          key={o.mode}
          type="button"
          className={`segmented-btn ${mode === o.mode ? 'active' : ''}`}
          aria-pressed={mode === o.mode}
          title={t(o.key)}
          onClick={() => setMode(o.mode)}
        >
          <Icon name={o.icon} size={13} />
          <span className="sr-only">{t(o.key)}</span>
        </button>
      ))}
    </div>
  )
}
