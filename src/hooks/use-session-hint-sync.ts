'use client'

import { useEffect } from 'react'

import { applySessionHint, readSessionHint } from '@/lib/auth/session-hint'

/**
 * Re-applies the session hint to <html> whenever the session changes.
 *
 * The inline <head> script marks <html> once, at load. After that the server
 * rewrites the cookie (sign-in, sign-out, `/api/mi-acceso`), but nothing
 * re-reads it — and better-auth goes back to `isPending` whenever it refetches
 * with no session, which puts the hint-driven placeholder on screen again.
 * Without this, signing out would leave the old name in that placeholder.
 */
export const useSessionHintSync = (isPending: boolean, session: unknown) => {
  useEffect(() => {
    applySessionHint(document.documentElement, readSessionHint())
  }, [isPending, session])
}
