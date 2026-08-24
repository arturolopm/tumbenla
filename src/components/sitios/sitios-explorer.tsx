'use client'

import { SlidersHorizontalIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { cn } from '@/lib/utils/css'
import type { VenueSummary } from '@/lib/venues/types'
import { VenueCard } from './venue-card'

/**
 * List and map are two views of one question, so they live on one route.
 *
 * Filtering happens here in the client rather than through searchParams. Reading
 * searchParams on the page would make it dynamic and lose ISR entirely; with a
 * few dozen venues, shipping the published set once and filtering in memory is
 * both cheaper and instant, which is the whole point of how this should feel.
 * Revisit past a few hundred venues.
 *
 * El reparto es el de Stitch: el mapa manda a la izquierda con dos tercios del
 * ancho, y la lista va como aside a la derecha con cabecera pegajosa.
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
  const [filtersOpen, setFiltersOpen] = useState(false)

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
    <div className="w-full px-margin-mobile pb-section-gap lg:px-margin-desktop">
      {/* Movil: control segmentado. En escritorio las dos vistas estan en
          pantalla al tiempo, asi que un toggle seria un control que no hace
          nada. */}
      <div className="mb-4 flex rounded-lg border-2 border-secondary bg-card p-0.5 lg:hidden">
        {(['lista', 'mapa'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => handleVista(option)}
            aria-pressed={vista === option}
            className={cn(
              'flex-1 rounded-md px-3 py-2 font-display text-label-lg uppercase transition-colors',
              vista === option
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="relative flex w-full flex-col gap-8 lg:flex-row">
        <div
          className={cn(
            'relative h-[600px] w-full overflow-hidden rounded-xl border-4 border-secondary shadow-2xl shadow-primary/5 lg:h-[800px] lg:w-2/3',
            vista === 'lista' ? 'hidden lg:block' : 'block'
          )}
        >
          {map?.({ venues: filtered, activeId, onActiveChange: setActiveId }) ?? (
            <div className="flex h-full items-center justify-center p-8 text-center text-body-md text-muted-foreground">
              El mapa llega en un momento.
            </div>
          )}
        </div>

        <aside
          className={cn(
            'w-full flex-col gap-6 lg:max-h-[800px] lg:w-1/3 lg:overflow-y-auto',
            vista === 'mapa' ? 'hidden lg:flex' : 'flex'
          )}
        >
          <div className="sticky top-0 z-10 flex items-end justify-between gap-3 border-secondary border-b-2 bg-background/90 pb-4 backdrop-blur-md">
            <div className="min-w-0">
              <h2 className="font-display font-bold text-headline-md text-primary-text uppercase">
                Aliados del Viche
              </h2>
              <p className="text-body-md text-muted-foreground" aria-live="polite">
                {filtered.length === 1
                  ? '1 punto apoyando la causa'
                  : `${filtered.length} puntos apoyando la causa`}
                {hasFilters ? ' con estos filtros' : ''}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setFiltersOpen((value) => !value)}
              aria-expanded={filtersOpen}
              aria-controls="filtros-sitios"
              className={cn(
                'shrink-0 rounded-lg border border-secondary p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                filtersOpen || hasFilters
                  ? 'bg-lime text-background'
                  : 'bg-popover text-lime hover:bg-secondary'
              )}
            >
              <SlidersHorizontalIcon className="size-5" />
              <span className="sr-only">Filtros</span>
            </button>
          </div>

          {filtersOpen ? (
            <div id="filtros-sitios" className="flex flex-col gap-3">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Busca por nombre o barrio"
                aria-label="Busca por nombre o barrio"
                className="h-10 w-full rounded-lg border border-input bg-card px-3 text-body-md text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />

              {cities.length > 1 ? (
                <select
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  aria-label="Filtrar por ciudad"
                  className="h-10 w-full rounded-lg border border-input bg-card px-3 text-body-md text-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="all">Toda Colombia</option>
                  {cities.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {TYPE_FILTERS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setType(option.value)}
                    aria-pressed={type === option.value}
                    className={cn(
                      'rounded border px-2 py-1 font-display text-label-sm uppercase transition-colors',
                      type === option.value
                        ? 'border-primary bg-primary/10 text-primary-text'
                        : 'border-secondary text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-4">
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
        </aside>
      </div>
    </div>
  )
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-border border-dashed p-6">
      <p className="font-display font-bold text-headline-md uppercase">
        Por aca no hay nada todavia.
      </p>
      <p className="text-body-md text-muted-foreground">
        Prueba quitando los filtros, o escribe menos.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="rounded-lg bg-primary px-3 py-1.5 font-display text-label-lg text-primary-foreground uppercase transition-opacity hover:opacity-90"
      >
        Ver todos
      </button>
    </div>
  )
}
