'use client'

import { useQuery } from '@tanstack/react-query'
import { LocateFixedIcon } from 'lucide-react'
import { useState } from 'react'

import type { GeocodeResult } from '@/app/api/geocode/route'
import { cn } from '@/lib/utils/css'

/**
 * Explicit address lookup against the Nominatim proxy.
 *
 * Nominatim forbids client-side autocomplete. A deliberate button press keeps
 * the request compliant and prevents a request for every keystroke. To save
 * the operator's time, the first match places the map pin immediately; the
 * remaining matches stay available when the first one is not the right door.
 */
export function AddressSearch({
  query,
  venueId,
  onPick,
  className,
}: {
  query: string
  venueId?: string
  onPick: (result: GeocodeResult) => void
  className?: string
}) {
  const term = query.trim()
  const [searchedTerm, setSearchedTerm] = useState('')
  const [selected, setSelected] = useState('')

  const { data, status, fetchStatus, refetch } = useQuery<{ results: GeocodeResult[] }>({
    queryKey: ['geocode', term, venueId ?? 'admin'],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ q: term })
      if (venueId) params.set('venueId', venueId)

      const response = await fetch(`/api/geocode?${params.toString()}`, { signal })
      if (!response.ok) throw new Error('geocode')
      return response.json()
    },
    enabled: false,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  const results = searchedTerm === term ? (data?.results ?? []) : []
  const loading = fetchStatus === 'fetching'
  const failed = searchedTerm === term && status === 'error'
  const empty = searchedTerm === term && status === 'success' && results.length === 0

  const handleSearch = async () => {
    if (term.length < 3) return
    setSearchedTerm(term)
    setSelected('')

    const response = await refetch()
    const first = response.data?.results[0]
    if (!first) return

    onPick(first)
    setSelected(`${first.lat},${first.lng}`)
  }

  const handlePick = (result: GeocodeResult) => {
    onPick(result)
    setSelected(`${result.lat},${result.lng}`)
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <button
        type='button'
        onClick={handleSearch}
        disabled={term.length < 3 || loading}
        className='inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-lg border border-primary px-4 py-2 font-display text-label-lg text-primary-text uppercase transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'
      >
        <LocateFixedIcon className='size-4' />
        {loading ? 'Ubicando…' : 'Ubicar esta dirección en el mapa'}
      </button>

      <p className='text-muted-foreground text-xs' aria-live='polite'>
        {term.length < 3 ? 'Escribe la dirección antes de ubicar el pin.' : null}
        {loading ? ' Buscando la mejor coincidencia…' : null}
        {empty ? ' No se encontró nada. Prueba con menos detalle o pon el pin a mano.' : null}
        {failed ? ' No se pudo buscar. Pon el pin a mano en el mapa.' : null}
        {selected ? ' Pin ubicado. Puedes arrastrarlo para dejarlo en la puerta.' : null}
      </p>

      {results.length > 1 ? (
        <div className='mt-1'>
          <p className='mb-1 font-medium text-sm'>¿No era ese? Elige otra coincidencia:</p>
          <ul className='flex flex-col gap-1 rounded-lg border border-border bg-card p-1'>
            {results.map((result) => {
              const key = `${result.lat},${result.lng}`
              return (
                <li key={key}>
                  <button
                    type='button'
                    onClick={() => handlePick(result)}
                    aria-pressed={selected === key}
                    className={cn(
                      'w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
                      selected === key && 'bg-primary/10 text-primary-text'
                    )}
                  >
                    {result.displayName}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
