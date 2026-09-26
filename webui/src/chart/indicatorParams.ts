import type { IndicatorInfo, SpaceSpec } from '../api/types'

/** One indicator's user-set params, `{name: value}`. Only values that differ
 * from the class's declared defaults are kept -- see `setIndicatorParams` in
 * shell/WorkspaceContext.tsx. */
export type ParamOverrides = Record<string, unknown>

/** Params the panel lets a user set: declared, not in `fixed_params`, and of
 * a type an input can hold. A `None` or list default has no editor that
 * would mean anything, so it is left to the class. */
export function editableParams(info: IndicatorInfo): string[] {
  const fixed = new Set(info.fixed_params)
  return Object.keys(info.params).filter((name) => {
    if (fixed.has(name)) return false
    const value = info.params[name]
    return (
      info.space[name]?.kind === 'categorical' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'string'
    )
  })
}

/** The stored overrides that still apply to `info` as the catalog now
 * declares it.
 *
 * The class can change under a hot reload. An override for a param it has
 * since renamed or dropped would be refused by the server with a 422 and
 * blank the indicator, for a value the user can no longer even see in the
 * editor. So it is dropped here instead. A value the class still declares
 * but now bounds more tightly is kept, and its 422 reaches the chart's
 * banner, because the user can fix that one. */
export function activeOverrides(info: IndicatorInfo, stored: unknown): ParamOverrides {
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return {}
  const editable = new Set(editableParams(info))
  return Object.fromEntries(Object.entries(stored as ParamOverrides).filter(([name]) => editable.has(name)))
}

/** `"9, 3, 3"`: every editable param's effective value, in declared order. */
export function paramSummary(info: IndicatorInfo, overrides: ParamOverrides): string {
  return editableParams(info)
    .map((name) => String(name in overrides ? overrides[name] : info.params[name]))
    .join(', ')
}

export type ParamError = 'required' | 'number' | 'integer' | 'range' | 'choice'

export type ParsedParam = { ok: true; value: unknown } | { ok: false; error: ParamError }

/** One field of the editor, from its input text back to a typed value.
 *
 * Checks what the catalog says about the param: its kind and declared
 * range. What it cannot check are the class's `constraints` (`fast < slow`).
 * Those are Python lambdas, so the editor has the server evaluate them
 * before a value is kept. */
export function parseParam(raw: string, defaultValue: unknown, spec: SpaceSpec | undefined): ParsedParam {
  if (spec?.kind === 'categorical') {
    const choice = (spec.choices ?? []).find((c) => String(c) === raw)
    return choice === undefined ? { ok: false, error: 'choice' } : { ok: true, value: choice }
  }
  if (typeof defaultValue === 'boolean') {
    if (raw !== 'true' && raw !== 'false') return { ok: false, error: 'choice' }
    return { ok: true, value: raw === 'true' }
  }
  if (typeof defaultValue !== 'number' && spec?.kind !== 'int' && spec?.kind !== 'float') {
    return { ok: true, value: raw }
  }

  const text = raw.trim()
  if (text === '') return { ok: false, error: 'required' }
  const value = Number(text)
  if (!Number.isFinite(value)) return { ok: false, error: 'number' }
  if (spec?.kind === 'int' && !Number.isInteger(value)) return { ok: false, error: 'integer' }
  if ((spec?.low !== undefined && value < spec.low) || (spec?.high !== undefined && value > spec.high)) {
    return { ok: false, error: 'range' }
  }
  return { ok: true, value }
}
