'use client'

import { useQuery } from '@tanstack/react-query'

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

export function useMyAccess(hasSession: boolean) {
  return useQuery<MyAccess>({
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
