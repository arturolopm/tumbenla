'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

import { toastManager } from '@/components/ui/toast'

/**
 * The panel's two action shapes, in one place.
 *
 * Every list in `/panel` and `/admin` was carrying two copies of the same
 * plumbing:
 *
 *  1. a `useEffect(() => { if (estado.status === 'success') toast + refresh;
 *     if 'error' toast }, [estado])` for the `useActionState` form, and
 *  2. a `const correr = (fn) => startTransition(async () => { const r =
 *     await fn(); if (r.status === 'success') toast + refresh; else toast })`
 *     for the row buttons.
 *
 * Five files, verbatim, and each copy is a place for the toast title or the
 * `router.refresh()` to drift. This is the shared version.
 *
 * The result shape is the one every panel action already returns:
 * `{ status: 'idle' } | { status: 'error', error } | { status: 'success', mensaje }`.
 */
export type PanelActionResult =
  | { status: 'idle' }
  | { status: 'error'; error: string }
  | { status: 'success'; mensaje: string }

type Options = {
  /** Título del toast de error. Por defecto "No se pudo". */
  errorTitle?: string
  /** `router.refresh()` tras un éxito. Por defecto `true`. */
  refresh?: boolean
  /** Se llama tras un éxito, después del refresh. Para navegar, cerrar un modal, etc. */
  onSuccess?: (result: Extract<PanelActionResult, { status: 'success' }>) => void
}

function report(result: PanelActionResult, router: ReturnType<typeof useRouter>, options: Options) {
  const { errorTitle = 'No se pudo', refresh = true, onSuccess } = options

  if (result.status === 'success') {
    toastManager.add({ title: result.mensaje, type: 'success' })
    if (refresh) router.refresh()
    onSuccess?.(result)
    return
  }

  if (result.status === 'error') {
    toastManager.add({ title: errorTitle, description: result.error, type: 'error' })
  }
}

/**
 * Toast + refresh for a `useActionState` result. Fires when `estado` changes;
 * `idle` is a no-op, so it does nothing on mount.
 */
export function useActionFeedback(estado: PanelActionResult, options: Options = {}) {
  const router = useRouter()

  // `estado` is the whole trigger: a new object from `useActionState` is a new
  // result to report. The options are read at fire time, not tracked.
  useEffect(() => {
    report(estado, router, options)
  }, [estado])
}

/**
 * Wraps `useTransition` for row buttons that call an action imperatively.
 * `run(() => someAction(id))` handles the toast + refresh; `pending` gates the
 * buttons.
 */
export function useActionRunner(options: Options = {}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const run = (action: () => Promise<PanelActionResult>) => {
    startTransition(async () => {
      report(await action(), router, options)
    })
  }

  return { run, pending }
}
