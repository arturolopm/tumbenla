'use client'

import { useQuery } from '@tanstack/react-query'

import { type SessionHint, readSessionHint } from '@/lib/auth/session-hint'

/**
 * What this session is allowed to do beyond being a regular person.
 *
 * The role is NOT in the session: ADMIN_EMAILS lives on the server and venue
 * membership is a table (decision 17), so it has to be asked for.
 *
 * FETCHED AS SOON AS THERE IS A SESSION, not when a menu opens. It used to be
 * lazy — the navbar renders everywhere and almost nobody opens the account
 * menu — but that made the venue impossible to surface in the navbar itself,
 * which is exactly where someone who works at a bar needs it. React Query
 * caches it under one key for the whole session, so it is one request per
 * visit rather than one per page, and anonymous visitors never make it at all.
 */
export type MyAccess = {
  admin: boolean
  venues: { slug: string; name: string }[]
}

/**
 * What the session hint implies, shown until /api/mi-acceso answers. It is
 * why the navbar names the venue straight away instead of flashing the
 * person's name first: the hint already carries the venue the trigger will
 * show. `admin` stays false because only the open menu uses it, and the answer
 * arrives long before anyone opens it.
 */
const accessFromHint = (hint: SessionHint | null): MyAccess => ({
  admin: false,
  venues:
    hint?.kind === 'venue' && hint.venueSlug ? [{ slug: hint.venueSlug, name: hint.label }] : [],
})

export function useMyAccess(hasSession: boolean) {
  return useQuery<MyAccess>({
    // Only once there is a session: before that, the navbar is still in its
    // hydration render, which has to match the server's.
    placeholderData: hasSession ? () => accessFromHint(readSessionHint()) : undefined,
    queryKey: ['my-access'],
    queryFn: async () => {
      const response = await fetch('/api/mi-acceso')
      if (!response.ok) throw new Error('could not read access')
      return response.json()
    },
    enabled: hasSession,
    // Failing here only means a navbar without the shortcuts. It is not a
    // reason to break the page, and retrying will not fix it.
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
}
