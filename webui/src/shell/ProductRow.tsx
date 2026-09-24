import { useTranslation } from 'react-i18next'
import type { Product } from '../api/types'
import { Icon } from '../components/Icon'

/**
 * One row in the product sidebar. Two independent selections live on the
 * same row and have to read as unmistakably different: a single click
 * toggles the row into/out of the backtest universe (multi-select, shown by
 * `aria-selected` and the tick box at the head of the row), while a double
 * click switches which product the main chart displays (single-select, shown
 * by the accent fill and the rule down the left edge). Single-clicking the
 * charted row is a no-op on the universe -- the charted product is
 * structurally always in it, so there is no state where toggling it would do
 * anything, and its box is drawn ticked-but-dimmed to say so.
 *
 * The tick box is the part that was missing: with only a border colour
 * separating "in the universe" from "not", the row's two selections looked
 * like two shades of the same one.
 */
export function ProductRow({
  product,
  isCharted,
  inUniverse,
  isActive,
  onSetChart,
  onToggleUniverse,
  onEdit,
  onDownload,
  downloadDisabled,
}: {
  product: Product
  isCharted: boolean
  inUniverse: boolean
  /** Highlighted by the search box's arrow keys -- not a selection of its
   * own, just where Enter would land. */
  isActive?: boolean
  onSetChart: () => void
  onToggleUniverse: () => void
  onEdit: () => void
  onDownload: () => void
  downloadDisabled?: boolean
}) {
  const { t, i18n } = useTranslation()
  const isZh = i18n.resolvedLanguage === 'zh'
  const name = isZh ? product.name_zh : product.name
  const cov = product.coverage

  const coverageState = !cov.has_data ? 'is-empty' : cov.stale_keys.length > 0 ? 'is-stale' : 'is-fresh'
  const coverageTitle = !cov.has_data
    ? t('products.noData')
    : `${cov.stale_keys.length > 0 ? t('data.stale') : t('data.fresh')} · ${cov.n_rows} ${t('products.rows')}`

  return (
    <div
      id={`product-row-${product.code}`}
      className={[
        'product-row',
        isCharted ? 'is-charted' : '',
        inUniverse ? 'is-in-universe' : '',
        isActive ? 'is-active' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="option"
      aria-selected={inUniverse}
      title={isCharted ? t('workspace.chartedAlwaysIncluded') : t('workspace.inUniverse')}
      onClick={onToggleUniverse}
      onDoubleClick={onSetChart}
    >
      <span className="universe-box" aria-hidden="true">
        <Icon name="check" size={11} />
      </span>
      <span className="code">{product.code}</span>
      <span className="name">{name}</span>
      {/* Three coverage states in a 300px row: a dot reads down the column at
          a glance where three differently-sized word badges did not. The text
          it replaced lives on in the title, alongside the row count that used
          to be hidden there anyway. */}
      <span className={`coverage-dot ${coverageState}`} title={coverageTitle} role="img" aria-label={coverageTitle} />
      <div className="row-actions" onDoubleClick={(e) => e.stopPropagation()}>
        {/* Downloading one product used to mean checking it into the universe
            first, then using the bulk button in the footer -- and unchecking
            it afterwards. */}
        <button
          className="btn btn-sm btn-ghost btn-icon"
          title={t('data.updateOne', { code: product.code })}
          aria-label={t('data.updateOne', { code: product.code })}
          disabled={downloadDisabled}
          onClick={(e) => {
            e.stopPropagation()
            onDownload()
          }}
        >
          <Icon name="download" size={14} />
        </button>
        <button
          className="btn btn-sm btn-ghost btn-icon"
          title={t('products.editProduct')}
          aria-label={t('products.editProduct')}
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
        >
          <Icon name="pencil" size={14} />
        </button>
      </div>
    </div>
  )
}
