import { useCallback, useRef } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'

const MIN_HEIGHT = 160
const MAX_RATIO = 0.7
/** One arrow press. Large enough to get somewhere in a few taps, small enough
 * to land on a height you actually wanted. */
const KEY_STEP = 24

/** Pure clamp, tested without synthesizing pointer events: never smaller
 * than a form actually needs, never so tall it swallows the chart above it. */
export function clampDrawerHeight(height: number, viewportHeight: number): number {
  const max = Math.max(MIN_HEIGHT, viewportHeight * MAX_RATIO)
  return Math.min(Math.max(height, MIN_HEIGHT), max)
}

/**
 * Drag-to-resize for the drawer's top edge. The live drag writes straight to
 * a CSS custom property, not React state -- state updates on every
 * `pointermove` would re-render the whole workspace tree at drag speed. Only
 * the final height, on `pointerup`, reaches `onCommit` (and from there,
 * sticky storage).
 *
 * That property has to be set on the same element that declares it. The
 * workspace grid carries `--drawer-h` in its own inline style (see
 * ChartWorkspace), and an element's inline declaration beats anything it would
 * otherwise inherit -- so a drag that wrote to `document.documentElement`, as
 * this used to, changed a value nothing read, and the drawer sat still until
 * the pointer came up and React re-rendered it in one jump.
 *
 * Arrow keys drive the same edge, one `KEY_STEP` at a time, and commit
 * immediately: there is no drag to be in the middle of.
 */
export function useDrawerResize(height: number, onCommit: (height: number) => void) {
  const draggingRef = useRef(false)

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const handle = e.currentTarget
      const startY = e.clientY
      const startHeight = height
      const grid = handle.closest<HTMLElement>('.workspace') ?? document.documentElement
      draggingRef.current = true
      handle.setPointerCapture(e.pointerId)
      document.body.classList.add('drawer-resizing')

      const apply = (clientY: number) => {
        const next = clampDrawerHeight(startHeight + (startY - clientY), window.innerHeight)
        grid.style.setProperty('--drawer-h', `${next}px`)
        return next
      }

      const move = (ev: PointerEvent) => {
        apply(ev.clientY)
      }
      const up = (ev: PointerEvent) => {
        draggingRef.current = false
        handle.releasePointerCapture(e.pointerId)
        document.body.classList.remove('drawer-resizing')
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        onCommit(apply(ev.clientY))
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    },
    [height, onCommit],
  )

  const onHandleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLElement>) => {
      const step = e.key === 'ArrowUp' ? KEY_STEP : e.key === 'ArrowDown' ? -KEY_STEP : 0
      if (step === 0) return
      e.preventDefault()
      onCommit(clampDrawerHeight(height + step, window.innerHeight))
    },
    [height, onCommit],
  )

  return { onPointerDown, onHandleKeyDown }
}
