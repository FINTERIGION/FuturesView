import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { formatCombo, SHORTCUTS } from './useHotkeys'

export function ShortcutsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true" aria-label={t('workspace.shortcuts')}>
        <div className="modal-body">
          <h3>{t('workspace.shortcuts')}</h3>
          <div className="shortcut-list">
            {SHORTCUTS.map((s) => (
              <div className="shortcut-row" key={s.combo}>
                <span>{t(s.key)}</span>
                <span className="shortcut-keys">
                  {formatCombo(s.combo).map((k) => (
                    <kbd className="kbd" key={k}>
                      {k}
                    </kbd>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </>,
    document.body,
  )
}
