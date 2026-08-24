'use client'

import { useEffect, useId, useRef, useState } from 'react'

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
  const [results, setResults] = useState<GeocodeResult[]>([])
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'empty'>('idle')
  const listId = useId()

  // Para descartar respuestas que llegan tarde. Sin esto, una busqueda lenta de
  // "bar" puede pisar los resultados de "bar la nona" al aterrizar despues.
  const requestRef = useRef(0)

  useEffect(() => {
    const term = query.trim()
    if (term.length < 3) {
      setResults([])
      setState('idle')
      return
    }

    const controller = new AbortController()
    const id = ++requestRef.current

    const timer = setTimeout(async () => {
      setState('loading')
      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('geocode')

        const data = (await response.json()) as { results: GeocodeResult[] }
        if (id !== requestRef.current) return

        setResults(data.results)
        setState(data.results.length === 0 ? 'empty' : 'idle')
      } catch (error) {
        if ((error as Error).name === 'AbortError') return
        if (id !== requestRef.current) return
        setResults([])
        setState('error')
      }
    }, 500)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={listId} className="font-medium text-sm">
        Buscar la direccion
      </label>
      <input
        id={listId}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Calle 85 #12-30, Bogota"
        autoComplete="off"
        className="h-10 rounded-lg border border-input bg-card px-3 text-foreground text-sm placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      <p className="text-muted-foreground text-xs" aria-live="polite">
        {state === 'loading' ? 'Buscando…' : null}
        {state === 'empty' ? 'No se encontro nada. Prueba con menos detalle.' : null}
        {state === 'error' ? 'No se pudo buscar. Ubica el pin a mano en el mapa.' : null}
      </p>

      {results.length > 0 ? (
        <ul className="flex flex-col gap-1 rounded-lg border border-border bg-card p-1">
          {results.map((result) => (
            <li key={`${result.lat},${result.lng}`}>
              <button
                type="button"
                onClick={() => {
                  onPick(result)
                  setResults([])
                }}
                className="w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
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
