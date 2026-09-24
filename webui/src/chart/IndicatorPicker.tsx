import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { errorMessage } from '../api/client'
import { indicatorsApi } from '../api/endpoints'
import { Icon } from '../components/Icon'
import type { IndicatorInfo } from '../api/types'
import { useWorkspace } from '../shell/WorkspaceContext'

/**
 * Pick what is drawn on the chart: every indicator class under `indicators/`,
 * plus the built-in volume pane.
 *
 * The catalog part is whatever `indicators/` currently holds -- the same
 * "write a class, drop it in the folder" deal strategies get -- so it includes
 * the user's private modules, and an entry that failed to import or declared
 * something impossible is shown disabled with the reason rather than being
 * dropped silently. A user who has just introduced a typo needs to see *that*,
 * not an indicator that quietly vanished.
 *
 * The rule splits the list the way the chart itself is split: above it,
 * everything that draws over the candles; below it, everything that takes a
 * pane of its own, in the order those panes stack. So volume -- built in, and
 * always the pane directly under the price -- heads the lower group rather
 * than being singled out. Where it differs from the rest is only that it
 * cannot break or be reloaded, which is what its tooltip says.
 */
export function IndicatorPicker() {
  const { t } = useTranslation()
  const { indicators, toggleIndicator, showVolume, setShowVolume } = useWorkspace()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const { data: catalog, isLoading, error } = useQuery({
    queryKey: ['indicators'],
    queryFn: indicatorsApi.list,
    staleTime: 5 * 60 * 1000,
  })

  const reload = useMutation({
    mutationFn: indicatorsApi.reload,
    // Both keys, not just the catalog: the point of reloading is that the
    // class body changed, so any values already fetched from the old one are
    // exactly what must not stay on screen for the rest of their staleTime.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['indicators'] })
      void queryClient.invalidateQueries({ queryKey: ['indicator'] })
    },
  })

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // Counts volume too: the button is this menu's summary, and a count that
  // ignored a ticked row would contradict the list it opens onto.
  const count = indicators.length + (showVolume ? 1 : 0)

  // Grouped by where each one draws, not by where it came from. `pane` is the
  // class's own declaration and flips under a hot reload, so a row moves
  // across the rule the moment its author edits it -- which is the point.
  const mainRows = (catalog ?? []).filter((info) => info.pane !== 'sub')
  const subRows = (catalog ?? []).filter((info) => info.pane === 'sub')

  const catalogRow = (info: IndicatorInfo) => {
    const broken = info.errors.length > 0
    return (
      <label
        key={info.key}
        className={`indicator-row${broken ? ' is-broken' : ''}`}
        title={broken ? info.errors.join('\n') : info.docstring}
      >
        <input
          type="checkbox"
          disabled={broken}
          checked={indicators.includes(info.key)}
          onChange={() => toggleIndicator(info.key)}
        />
        <span className="indicator-row-label">{info.label}</span>
        <span className="indicator-row-pane">
          {info.pane === 'sub' ? t('workspace.paneSub') : t('workspace.paneMain')}
        </span>
        {broken && <span className="indicator-row-error">{t('workspace.indicatorBroken')}</span>}
      </label>
    )
  }

  return (
    <div className="indicator-picker" ref={rootRef}>
      <button
        className={`btn btn-sm ${count ? 'btn-primary' : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen(!open)}
      >
        <Icon name="layers" size={14} />
        {count ? t('workspace.indicatorsWithCount', { count }) : t('workspace.indicators')}
        <Icon name="chevron-down" size={13} />
      </button>

      {open && (
        <div className="indicator-menu" role="dialog" aria-label={t('workspace.indicators')}>
          <div className="indicator-menu-head">
            <span>{t('workspace.indicators')}</span>
            <button
              className="btn btn-sm"
              disabled={reload.isPending}
              onClick={() => reload.mutate()}
              title={t('workspace.reloadIndicatorsHint')}
            >
              {reload.isPending ? t('common.loading') : t('workspace.reloadIndicators')}
            </button>
          </div>

          {/* A module that failed to *reload* is reported here as well as in
              the catalog: the catalog can only describe classes it managed to
              import, so a class whose edit did not compile is named by the
              reload response and nowhere else. */}
          {Object.entries(reload.data?.failed ?? {}).map(([module, message]) => (
            <div key={module} className="indicator-menu-empty indicator-row-error">
              {module}: {message}
            </div>
          ))}
          {reload.error && (
            <div className="indicator-menu-empty indicator-row-error">{errorMessage(reload.error)}</div>
          )}

          {isLoading && <div className="indicator-menu-empty">{t('common.loading')}</div>}
          {error && <div className="indicator-menu-empty">{errorMessage(error)}</div>}
          {catalog && catalog.length === 0 && (
            <div className="indicator-menu-empty">{t('workspace.noIndicators')}</div>
          )}

          {mainRows.map(catalogRow)}

          {/* Only between two groups that both have rows -- a rule with
              nothing above it reads as the head's own border. */}
          {mainRows.length > 0 && <div className="indicator-menu-rule" />}

          <label className="indicator-row" title={t('workspace.volumeHint')}>
            <input type="checkbox" checked={showVolume} onChange={() => setShowVolume(!showVolume)} />
            <span className="indicator-row-label">{t('workspace.paneVolume')}</span>
            <span className="indicator-row-pane">{t('workspace.paneSub')}</span>
          </label>
          {subRows.map(catalogRow)}
        </div>
      )}
    </div>
  )
}
