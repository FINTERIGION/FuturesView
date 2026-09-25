import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { errorMessage } from '../api/client'
import { backtestApi, runsApi, strategiesApi } from '../api/endpoints'
import type { RunDetail } from '../api/types'
import { Icon } from '../components/Icon'
import { JobProgress } from '../components/JobProgress'
import { useToast } from '../components/Toast'
import { useJobSlot } from '../shell/JobsProvider'
import { useHotkeys } from '../shell/useHotkeys'
import { useStickyState } from '../hooks/useStickyState'
import { useWorkspace } from '../shell/WorkspaceContext'
import { BacktestForm } from './BacktestForm'
import { ResultTables } from './ResultTables'
import { sharedFormDefaults } from './sharedFormDefaults'

/** What this panel itself reads out of a prefill -- deliberately narrower
 * than `WorkspaceContext.BacktestPrefill`, which also carries `symbols`: the
 * universe is a shell-level concern (`prefillBacktest` sets `chartSymbol` /
 * `extraSymbols` directly), not something this panel seeds. Every field is
 * optional because a prefill applies whatever it names and leaves the rest
 * at their sticky values -- a prefill carrying only a strategy and symbols,
 * for instance, has no cash/slippage to name. */
export interface BacktestFieldsPrefill {
  strategy?: string
  start?: string
  end?: string
  cash?: number
  slippage?: number
}

/**
 * The drawer's Backtest tab. Ported from the old `BacktestPage` essentially
 * unchanged: the sticky-state fields and the one-shot `useState(() =>
 * prefill)` read are the same load-bearing behavior -- only the prefill's
 * source changed, from `useLocation().state` to a prop the shell remounts
 * this component on (`key={seq}` at the call site, see BottomDrawer.tsx).
 * The universe is no longer picked here: it comes from
 * `WorkspaceContext.universe`, the same list the sidebar's checkboxes edit.
 *
 * Strategy parameters are not part of this form. A run sends none, so the
 * engine uses each strategy's declared defaults -- including a run reopened
 * from the History tab, which reproduces that run's window and costs but not
 * whatever parameters it was launched with.
 */
export function BacktestPanel({ prefill }: { prefill?: BacktestFieldsPrefill }) {
  const { t } = useTranslation()
  const job = useJobSlot('backtest')
  const queryClient = useQueryClient()
  const toast = useToast()
  const [error, setError] = useState<string | null>(null)
  const { universe, runId, setRunId } = useWorkspace()

  // Read once, the way BacktestPage's router-state prefill was: applying it
  // in an effect instead left one render where the form still showed the
  // *stored* value while it was already meant to show the prefilled one, and
  // an effect keyed on the field then fired on a change that was never a
  // user edit. This component is remounted (`key={seq}`) whenever a new
  // prefill arrives, so "once, in the initializer" is still correct.
  const [initialPrefill] = useState<BacktestFieldsPrefill | undefined>(prefill)

  const { data: strategies } = useQuery({ queryKey: ['strategies'], queryFn: strategiesApi.list })

  // Re-imports strategies/ on the server so an edited file shows up without a
  // restart. Broken modules need no separate report here: the refetched
  // catalog lists them disabled with their error, below the dropdown.
  const reloadStrategies = useMutation({
    mutationFn: strategiesApi.reload,
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['strategies'] })
      toast.push({ kind: 'success', title: t('backtest.reloadedStrategies', { count: data.strategies.length }) })
    },
    // Mostly the server's 409: it refuses while any job is running, since
    // swapping a class object mid-run would pull it out from under the job.
    onError: (err) => {
      toast.push({ kind: 'error', title: t('backtest.reloadStrategiesFailed'), message: errorMessage(err) })
    },
  })

  const [strategyKey, setStrategyKey] = useStickyState('strategy', sharedFormDefaults.strategy, initialPrefill?.strategy)
  const [start, setStart] = useStickyState('start', sharedFormDefaults.start, initialPrefill?.start)
  const [end, setEnd] = useStickyState('end', sharedFormDefaults.end, initialPrefill?.end)
  const [cash, setCash] = useStickyState('cash', sharedFormDefaults.cash, initialPrefill?.cash)
  const [slippage, setSlippage] = useStickyState('slippage', sharedFormDefaults.slippage, initialPrefill?.slippage)

  // Slippage is a cost and cannot be negative -- a negative one fills every
  // trade better than the market and inflates the whole run. The API rejects
  // it too (web/schemas.py); blocking it here is so the user is told before
  // they wait for a job.
  const slippageValid = slippage >= 0

  // Also covers a pick that is no longer in the catalog -- a class renamed or
  // deleted and then reloaded. Left alone, the select would show the first
  // option while the run sent the stale key and failed on the server.
  useEffect(() => {
    const firstRunnable = strategies?.find((s) => s.errors.length === 0)
    const missing = strategies !== undefined && !strategies.some((s) => s.key === strategyKey)
    if (firstRunnable && (!strategyKey || missing)) {
      setStrategyKey(firstRunnable.key)
    }
  }, [strategies, strategyKey, setStrategyKey])

  // The remembered pick can be a strategy whose file has since broken; the
  // form lists it disabled with its error, and there is nothing to run.
  const strategyBroken = Boolean(strategies?.find((s) => s.key === strategyKey)?.errors.length)

  // The run whose outcome has already been announced. A toast is not
  // idempotent the way `invalidateQueries` is, and this effect re-runs on
  // every render while the status sits terminal.
  const announcedJob = useRef<string | null>(null)

  useEffect(() => {
    const state = job.state
    if (!state || !['done', 'error'].includes(state.status)) return
    if (state.status === 'done') void queryClient.invalidateQueries({ queryKey: ['runs'] })
    if (announcedJob.current === state.id) return
    announcedJob.current = state.id
    // Said out here as well as in the progress block below, because a run
    // takes long enough that the drawer is often collapsed or on the History
    // tab by the time it lands.
    if (state.status === 'error') {
      toast.push({ kind: 'error', title: t('backtest.runFailed'), message: state.error ?? undefined })
    } else {
      toast.push({ kind: 'success', title: t('backtest.runFinished') })
    }
  }, [job.state, queryClient, toast, t])

  const canRun = !job.isActive && Boolean(strategyKey) && !strategyBroken && universe.length > 0 && slippageValid

  const runBacktest = async () => {
    setError(null)
    try {
      const { job_id, run_id } = await backtestApi.start({
        strategy: strategyKey,
        symbols: universe,
        start,
        end,
        cash,
        slippage,
      })
      job.start(job_id)
      // A fresh run gets its own overlay even if the server hands back an id
      // this panel has charted before.
      overlaidRunId.current = null
      setLastRunId(run_id)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  // Ctrl/⌘+Enter launches the run from anywhere in the workspace -- the form
  // is a handful of remembered fields that rarely change between runs, so the
  // common case is "open the drawer, press it again".
  useHotkeys({
    'mod+enter': () => {
      if (canRun) void runBacktest()
    },
  })

  const [lastRunId, setLastRunId] = useState<string | null>(null)
  /** The run this panel has already put on the chart. Each finished run is
   * overlaid once, by id, rather than re-applied on every render the effect
   * below happens to re-run on: `setRunId` is rebuilt on every URL change
   * (react-router rebuilds `setSearchParams` from the current
   * `searchParams`), so depending on it alone re-fires the effect on
   * navigation that has nothing to do with this run -- including the URL
   * change made by the toolbar's own "exit backtest", which is how that
   * button came to undo itself. */
  const overlaidRunId = useRef<string | null>(null)

  // The job result carries this run's metrics, and `blown_up` among them.
  const jobMetrics = (job.state?.result as { metrics?: Record<string, unknown> } | undefined)?.metrics
  const jobBlownUp = Boolean(jobMetrics?.blown_up)

  // A finished run overlays the chart automatically -- see the effect below --
  // so once the job is done, the chart's own `runId` is what this panel's
  // result table follows too, not a separate "last run I started" id. That
  // keeps a run reopened from the History tab and a run just launched here
  // showing through the exact same path.
  useEffect(() => {
    if (job.state?.status !== 'done' || !lastRunId) return
    if (overlaidRunId.current === lastRunId) return
    overlaidRunId.current = lastRunId
    setRunId(lastRunId)
  }, [job.state?.status, lastRunId, setRunId])

  const { data: run } = useQuery<RunDetail>({
    queryKey: ['run', runId],
    queryFn: () => runsApi.get(runId as string),
    enabled: runId !== null,
  })

  return (
    <div className="panel-split">
      <div className="panel-rail">
        <BacktestForm
          strategies={strategies ?? []}
          strategyKey={strategyKey}
          onStrategyChange={setStrategyKey}
          onReloadStrategies={() => reloadStrategies.mutate()}
          reloadingStrategies={reloadStrategies.isPending}
          canReloadStrategies={!job.isActive}
          universe={universe}
          start={start}
          onStartChange={setStart}
          end={end}
          onEndChange={setEnd}
          cash={cash}
          onCashChange={setCash}
          slippage={slippage}
          onSlippageChange={setSlippage}
          slippageValid={slippageValid}
        />

        {error && <div className="hint-banner warning">{error}</div>}
        {!slippageValid && <div className="hint-banner warning">{t('common.slippageNegative')}</div>}

        <button
          className="btn btn-primary btn-block"
          onClick={() => void runBacktest()}
          disabled={!canRun}
          style={{ marginTop: 8 }}
          title={t('backtest.runBacktestHint')}
        >
          {job.isActive ? <span className="spinner" /> : <Icon name="line-chart" size={14} />}
          {t('backtest.runBacktest')}
        </button>

        {job.state && (
          <div style={{ marginTop: 16 }}>
            <JobProgress
              state={job.state}
              logs={job.logs}
              onCancel={job.cancel}
              streaming={job.streaming}
              blownUp={jobBlownUp}
              lost={job.lost}
            />
          </div>
        )}
      </div>

      <div className="panel-main">
        {run ? (
          <ResultTables run={run} />
        ) : (
          // The results half is the larger of the two columns and sat blank
          // until a run landed, which read as something failing to load rather
          // than as nothing having been asked for yet.
          <div className="empty-state">
            <span className="empty-state-icon">
              <Icon name="line-chart" size={18} />
            </span>
            <span className="empty-state-title">{t('backtest.noRunYet')}</span>
            <p className="empty-state-hint">{t('backtest.noRunYetHint')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
