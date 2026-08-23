'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import type { VenueSummary } from '@/lib/venues/types'
import { cn } from '@/lib/utils/css'
import { VenueCard } from './venue-card'

/**
 * List and map are two views of one question, so they live on one route.
 *
 * Filtering happens here in the client rather than through searchParams. Reading
 * searchParams on the page would make it dynamic and lose ISR entirely; with a
 * few dozen venues, shipping the published set once and filtering in memory is
 * both cheaper and instant, which is the whole point of how this should feel.
 * Revisit past a few hundred venues.
 */

type Vista = 'lista' | 'mapa'

const TYPE_FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'bar', label: 'Bares' },
  { value: 'discoteca', label: 'Discotecas' },
  { value: 'club', label: 'Clubes' },
  { value: 'terraza', label: 'Terrazas' },
  { value: 'restobar', label: 'Restobares' },
] as const

export function SitiosExplorer({
  venues,
  cities,
  map,
}: {
  venues: VenueSummary[]
  cities: string[]
  /** The map island. Rendered lazily by the page so MapLibre stays out of the
   *  initial payload. */
  map?: (props: {
    venues: VenueSummary[]
    activeId: string | null
    onActiveChange: (id: string | null) => void
  }) => React.ReactNode
}) {
  const [vista, setVista] = useState<Vista>('lista')
  const [city, setCity] = useState<string>('all')
  const [type, setType] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)

  // Read the view out of the URL once on mount so a shared /sitios?vista=mapa
  // link opens on the map. Deliberately not a useSearchParams subscription:
  // that would opt the whole tree into dynamic rendering.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('vista') === 'mapa') setVista('mapa')
  }, [])

  const handleVista = useCallback((next: Vista) => {
    setVista(next)
    // replaceState, not router.replace: this must not round-trip to the server
    // or push a history entry for a view toggle.
    const params = new URLSearchParams(window.location.search)
    if (next === 'mapa') params.set('vista', 'mapa')
    else params.delete('vista')
    const qs = params.toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
  }, [])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return venues.filter((venue) => {
      if (city !== 'all' && venue.city !== city) return false
      if (type !== 'all' && venue.type !== type) return false
      if (!needle) return true
      return (
        venue.name.toLowerCase().includes(needle) ||
        (venue.neighborhood ?? '').toLowerCase().includes(needle) ||
        venue.city.toLowerCase().includes(needle)
      )
    })
  }, [venues, city, type, query])

  const hasFilters = city !== 'all' || type !== 'all' || query.trim() !== ''

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-4 border-border border-b px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Busca por nombre o barrio"
            aria-label="Busca por nombre o barrio"
            className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-card px-3 text-foreground text-sm placeholder:text-muted-foreground focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />

          {cities.length > 1 ? (
            <select
              value={city}
              onChange={(event) => setCity(event.target.value)}
              aria-label="Filtrar por ciudad"
              className="h-10 rounded-lg border border-input bg-card px-3 text-foreground text-sm focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">Toda Colombia</option>
              {cities.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : null}

          {/* Mobile only: on desktop both views are on screen at once, so a
              toggle would be a control that does nothing. */}
          <div className="ml-auto flex rounded-lg border border-input bg-card p-0.5 lg:hidden">
            {(['lista', 'mapa'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handleVista(option)}
                aria-pressed={vista === option}
                className={cn(
                  'rounded-md px-3 py-1.5 font-medium text-sm capitalize transition-colors',
                  vista === option
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {TYPE_FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setType(option.value)}
              aria-pressed={type === option.value}
              className={cn(
                'rounded-full border px-3 py-1 text-sm transition-colors',
                type === option.value
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-border/80 hover:text-foreground'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,420px)_1fr]">
        <div
          className={cn(
            'flex flex-col gap-3 p-4 sm:p-6 lg:h-[calc(100dvh-13rem)] lg:overflow-y-auto',
            vista === 'mapa' ? 'hidden lg:flex' : 'flex'
          )}
        >
          <p className="text-muted-foreground text-sm" aria-live="polite">
            {filtered.length === 1
              ? '1 sitio'
              : `${filtered.length} sitios`}
            {hasFilters ? ' con estos filtros' : ''}
          </p>

          {filtered.length === 0 ? (
            <EmptyState
              onReset={() => {
                setCity('all')
                setType('all')
                setQuery('')
              }}
            />
          ) : (
            filtered.map((venue) => (
              <VenueCard
                key={venue.id}
                venue={venue}
                active={activeId === venue.id}
                onHover={setActiveId}
              />
            ))
          )}
        </div>

        <div
          className={cn(
            'min-h-[60dvh] border-border lg:sticky lg:top-14 lg:h-[calc(100dvh-13rem)] lg:border-l',
            vista === 'lista' ? 'hidden lg:block' : 'block'
          )}
        >
          {map?.({ venues: filtered, activeId, onActiveChange: setActiveId }) ?? (
            <div className="flex h-full min-h-[60dvh] items-center justify-center p-8 text-center text-muted-foreground text-sm">
              El mapa llega en un momento.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-3xl border border-border border-dashed p-6">
      <p className="font-medium">Por aca no hay nada todavia.</p>
      <p className="text-muted-foreground text-sm">
        Prueba quitando los filtros, o escribe menos.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="rounded-lg bg-primary px-3 py-1.5 font-medium text-primary-foreground text-sm transition-opacity hover:opacity-90"
      >
        Ver todos
      </button>
    </div>
  )
}
