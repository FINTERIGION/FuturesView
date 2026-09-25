import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { backtestApi, indicatorsApi, runsApi, strategiesApi } from '../api/endpoints'
import { INDICATORS, STRATEGIES, renderWorkspace } from '../test/utils'
import type { BacktestFieldsPrefill } from './BacktestPanel'
import { BacktestPanel } from './BacktestPanel'

vi.mock('../api/endpoints', () => ({
  strategiesApi: { list: vi.fn(), reload: vi.fn() },
  backtestApi: { start: vi.fn() },
  runsApi: { list: vi.fn(), get: vi.fn(), price: vi.fn(), remove: vi.fn() },
  jobsApi: { get: vi.fn(), cancel: vi.fn(), streamUrl: (id: string) => `/api/jobs/${id}/stream` },
  indicatorsApi: { list: vi.fn(), get: vi.fn(), values: vi.fn(), reload: vi.fn() },
}))

/** The form's inputs carry no htmlFor, so reach them through the field their
 * label names. */
function fieldInput(label: string) {
  const field = screen.getByText(label).closest('.field')!
  return within(field as HTMLElement).getByRole('spinbutton')
}

beforeEach(() => {
  // Call history too, not just the resolved values: one test below asserts
  // the run was never started, and another one before it does start a run.
  vi.clearAllMocks()
  vi.mocked(strategiesApi.list).mockResolvedValue(STRATEGIES)
  vi.mocked(indicatorsApi.list).mockResolvedValue(INDICATORS)
  vi.mocked(backtestApi.start).mockResolvedValue({ job_id: 'j1', run_id: 'r1' })
  vi.mocked(runsApi.get).mockResolvedValue({
    id: 'r1', kind: 'backtest', created_at: 0, strategy: null, symbols: [], start: null, end: null,
    cash: null, slippage: null, status: 'done', params: {}, metrics: null, error: null,
    equity_records: [], trade_logs: [], deferred: {}, symbols_with_price: [],
  })
})

function renderPanel(prefill?: BacktestFieldsPrefill) {
  return renderWorkspace(<BacktestPanel prefill={prefill} />, { path: '/?symbol=SA' })
}

describe('prefill from a past run', () => {
  it('applies the prefilled strategy over the remembered one', async () => {
    // The ordinary case: the sticky strategy is whatever was run last, and
    // the run being reopened used something else.
    localStorage.setItem('ft.strategy', JSON.stringify('double_ma'))

    renderPanel({ strategy: 'chan_theory', start: '2020-01-01', end: '2024-01-01' })

    await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue('chan_theory'))
  })

  it('carries the cost assumptions the run was made under', async () => {
    // Without these the rerun reproduces nothing: the panel's own defaults are
    // 200000 / 0, and a run made at 100000 / 1.5 is a different backtest.
    localStorage.setItem('ft.cash', JSON.stringify(200000))
    localStorage.setItem('ft.slippage', JSON.stringify(0))

    renderPanel({ strategy: 'chan_theory', cash: 100000, slippage: 1.5 })

    await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue('chan_theory'))
    expect(fieldInput('Cash')).toHaveValue(100000)
    expect(fieldInput('Slippage')).toHaveValue(1.5)
  })
})

describe('strategy parameters', () => {
  it('offers no parameter inputs and sends none, whatever strategy is picked', async () => {
    // The form edits the run's own settings only; the engine uses each
    // strategy's declared defaults (STRATEGIES declares `fast`/`slow` for
    // double_ma and `atr_mult` for chan_theory -- none of them show here).
    const user = userEvent.setup()
    localStorage.setItem('ft.strategy', JSON.stringify('double_ma'))
    renderPanel()

    await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue('double_ma'))
    expect(screen.queryByText('fast')).not.toBeInTheDocument()
    expect(screen.queryByText('slow')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByRole('combobox'), 'chan_theory')
    expect(screen.queryByText('atr_mult')).not.toBeInTheDocument()
    // Cash and slippage are the only numeric inputs left.
    expect(screen.getAllByRole('spinbutton')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: /run backtest/i }))
    await waitFor(() => expect(backtestApi.start).toHaveBeenCalled())
    expect(vi.mocked(backtestApi.start).mock.calls[0][0]).not.toHaveProperty('params')
  })
})

describe('slippage validation', () => {
  it('blocks the run and explains why when slippage is negative', async () => {
    localStorage.setItem('ft.strategy', JSON.stringify('double_ma'))
    renderPanel()

    const runButton = await screen.findByRole('button', { name: /run backtest/i })
    await waitFor(() => expect(runButton).toBeEnabled())

    // `fireEvent.change` rather than `user.type`: jsdom discards a number
    // input's value while it is transiently invalid, so typing "-5" a
    // character at a time lands on 5, not -5. A real browser keeps the minus.
    fireEvent.change(fieldInput('Slippage'), { target: { value: '-5' } })

    await waitFor(() => expect(runButton).toBeDisabled())
    expect(screen.getByText(/cannot be negative/i)).toBeInTheDocument()
    expect(backtestApi.start).not.toHaveBeenCalled()
  })
})

describe('a strategy whose file failed to load', () => {
  const BROKEN = {
    ...STRATEGIES[0],
    key: 'ftk_typo',
    class_name: '',
    module: 'strategies.ftk_typo',
    file: '',
    params: {},
    space: {},
    errors: ["SyntaxError: '(' was never closed (ftk_typo.py, line 1)"],
  }

  it('is listed disabled with its error, and never picked by default', async () => {
    // Listed first, so a default of `strategies[0]` would have landed on it.
    vi.mocked(strategiesApi.list).mockResolvedValue([BROKEN, ...STRATEGIES])
    renderPanel()

    await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue('double_ma'))
    const option = screen.getByRole('option', { name: /ftk_typo/ }) as HTMLOptionElement
    expect(option.disabled).toBe(true)
    expect(screen.getByText(/was never closed/)).toBeInTheDocument()
  })

  it('cannot be run when it is the remembered pick', async () => {
    vi.mocked(strategiesApi.list).mockResolvedValue([...STRATEGIES, BROKEN])
    localStorage.setItem('ft.strategy', JSON.stringify('ftk_typo'))
    renderPanel()

    await screen.findByText(/was never closed/)
    expect(screen.getByRole('button', { name: /run backtest/i })).toBeDisabled()
  })
})

describe('the reload button', () => {
  const RENAMED = { ...STRATEGIES[0], key: 'double_ma_v2', class_name: 'DoubleMaV2Strategy' }

  it('re-imports strategies/ and refetches the dropdown', async () => {
    const user = userEvent.setup()
    localStorage.setItem('ft.strategy', JSON.stringify('double_ma'))
    renderPanel()
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue('double_ma'))

    vi.mocked(strategiesApi.list).mockResolvedValue([...STRATEGIES, RENAMED])
    vi.mocked(strategiesApi.reload).mockResolvedValue({
      reloaded: true, strategies: [...STRATEGIES, RENAMED].map((s) => s.key), failed: {},
    })
    await user.click(screen.getByRole('button', { name: /^reload$/i }))

    expect(strategiesApi.reload).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole('option', { name: 'double_ma_v2' })).toBeInTheDocument()
    expect(screen.getByText(/reloaded 3 strategies/i)).toBeInTheDocument()
  })

  it('moves off a pick whose class the reload removed', async () => {
    // Renaming the class renames its key. Left on the stale key, the select
    // showed another strategy while the run sent the one that is gone.
    const user = userEvent.setup()
    localStorage.setItem('ft.strategy', JSON.stringify('double_ma'))
    renderPanel()
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue('double_ma'))

    const after = [RENAMED, ...STRATEGIES.slice(1)]
    vi.mocked(strategiesApi.list).mockResolvedValue(after)
    vi.mocked(strategiesApi.reload).mockResolvedValue({
      reloaded: true, strategies: after.map((s) => s.key), failed: {},
    })
    await user.click(screen.getByRole('button', { name: /^reload$/i }))

    await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue('double_ma_v2'))
  })

  it("says why when the server refuses, and keeps the list it had", async () => {
    const user = userEvent.setup()
    renderPanel()
    await screen.findByRole('option', { name: 'double_ma' })

    vi.mocked(strategiesApi.reload).mockRejectedValue(new ApiError(409, 'A job is running'))
    await user.click(screen.getByRole('button', { name: /^reload$/i }))

    expect(await screen.findByText(/could not reload strategies/i)).toBeInTheDocument()
    expect(screen.getByText(/a job is running/i)).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'double_ma' })).toBeInTheDocument()
  })
})

describe('the window presets', () => {
  it('end on today in the local calendar, not on the UTC date', async () => {
    // 01:30 on 24 September in Beijing is still the 23rd in UTC, and
    // `toISOString()` handed the preset that stale end date.
    vi.stubEnv('TZ', 'Asia/Shanghai')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-23T17:30:00Z'))
    try {
      renderPanel()
      fireEvent.click(await screen.findByRole('button', { name: '1Y' }))

      const input = (label: string) =>
        screen.getByText(label).closest('.field')!.querySelector('input') as HTMLInputElement
      expect(input('End').value).toBe('2026-09-24')
      expect(input('Start').value).toBe('2025-09-24')
    } finally {
      vi.useRealTimers()
      vi.unstubAllEnvs()
    }
  })
})
