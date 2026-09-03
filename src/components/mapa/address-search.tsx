'use client'

import { useQuery } from '@tanstack/react-query'
import { useEffect, useId, useState } from 'react'

import type { GeocodeResult } from '@/app/api/geocode/route'
import { cn } from '@/lib/utils/css'

/**
 * Busqueda de direcciones contra el proxy de Nominatim.
 *
 * Debounce de 500 ms y minimo 3 caracteres: la politica de uso de Nominatim
 * prohibe explicitamente el autocompletado por tecla. Esto no es una
 * optimizacion, es lo que mantiene la ruta dentro de los terminos.
 *
 * Elegir un resultado OFRECE los campos, nunca los escribe en silencio. Los
 * datos de direcciones colombianas en OSM son irregulares y lo que escribio el
 * operador suele ser mejor que lo que devuelve el geocoder.
 */
export function AddressSearch({
  onPick,
  className,
}: {
  onPick: (result: GeocodeResult) => void
  className?: string
}) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  // Picking a result hides the list without clearing what was typed. With the
  // results coming from a cache instead of local state there is nothing to
  // empty, so the dismissal is explicit; typing again brings it back.
  const [picked, setPicked] = useState(false)
  const listId = useId()

  // The 500 ms debounce and the 3-character minimum are NOT an optimisation:
  // Nominatim's usage policy explicitly forbids per-keystroke autocomplete, so
  // this is what keeps the route inside the terms. React Query handles the
  // request; it does not handle "wait until they stop typing", so the debounce
  // stays — but it is now the only timer in this file.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 500)

    return () => clearTimeout(timer)
  }, [query])

  const term = debounced.length >= 3 ? debounced : ''

  /**
   * Query keyed by the search term, which is what kills the stale-response bug
   * this file used to guard by hand with a `requestRef` counter: a slow "bar"
   * landing after "bar la nona" cannot overwrite it, because they are different
   * cache entries and only the current key is rendered. Aborting in-flight
   * requests is Query's job too.
   */
  const { data, status, fetchStatus } = useQuery<{ results: GeocodeResult[] }>({
    queryKey: ['geocode', term],
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(term)}`, { signal })
      if (!response.ok) throw new Error('geocode')
      return response.json()
    },
    enabled: term.length >= 3,
    retry: false,
    // Nominatim already caches server-side for a day; repeating a term the
    // operator just typed should not leave this component at all.
    staleTime: 5 * 60 * 1000,
  })

  const results = picked ? [] : (data?.results ?? [])
  const loading = fetchStatus === 'fetching'
  const failed = status === 'error'
  const empty = status === 'success' && results.length === 0

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={listId} className='font-medium text-sm'>
        Buscar la dirección
      </label>
      <input
        id={listId}
        type='search'
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setPicked(false)
        }}
        placeholder='Calle 85 #12-30, Bogotá'
        autoComplete='off'
        className='h-10 rounded-lg border border-input bg-card px-3 text-foreground text-sm placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      />

      <p className='text-muted-foreground text-xs' aria-live='polite'>
        {loading ? 'Buscando…' : null}
        {empty ? 'No se encontró nada. Prueba con menos detalle.' : null}
        {failed ? 'No se pudo buscar. Ubica el pin a mano en el mapa.' : null}
      </p>

      {results.length > 0 ? (
        <ul className='flex flex-col gap-1 rounded-lg border border-border bg-card p-1'>
          {results.map((result) => (
            <li key={`${result.lat},${result.lng}`}>
              <button
                type='button'
                onClick={() => {
                  onPick(result)
                  setPicked(true)
                }}
                className='w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none'
              >
                {result.displayName}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
