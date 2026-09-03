'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * A seconds countdown for "you can try again in Ns" style waits.
 *
 * WHY A HOOK: every place that needed one — the OTP resend, and anywhere a
 * cooldown shows up next — was rebuilding the same `useState` + `useEffect` +
 * `setTimeout(-1)` ladder by hand, and each copy is a chance to leak the timer
 * or drop the cleanup. One tested implementation instead.
 *
 * `start(n)` (re)starts it at n seconds; it ticks down to 0 on its own and
 * stops. `remaining` is the number to show, `isRunning` the boolean to gate a
 * button on.
 */
export function useCountdown() {
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    if (remaining <= 0) return
    const id = setTimeout(() => setRemaining((n) => n - 1), 1000)
    return () => clearTimeout(id)
  }, [remaining])

  const start = useCallback((seconds: number) => setRemaining(Math.max(0, Math.floor(seconds))), [])
  const stop = useCallback(() => setRemaining(0), [])

  return { remaining, isRunning: remaining > 0, start, stop }
}
