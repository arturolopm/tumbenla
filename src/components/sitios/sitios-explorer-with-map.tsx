'use client'

import dynamic from 'next/dynamic'

import type { VenueSummary } from '@/lib/venues/types'
import { SitiosExplorer } from './sitios-explorer'

/**
 * El puente entre la pagina y la isla del mapa.
 *
 * Existe por dos restricciones que se cruzan:
 *
 * 1. SitiosExplorer recibe el mapa como render prop, y una funcion no es
 *    serializable, asi que un Server Component no puede pasarsela.
 * 2. dynamic(..., { ssr: false }) solo se permite dentro de un Client Component.
 *
 * Este archivo es el Client Component mas pequenio que satisface las dos.
 */

const VenuesMap = dynamic(
  () => import('@/components/mapa/venues-map').then((m) => m.VenuesMap),
  {
    // MapLibre toca window en el scope del modulo, asi que renderizarlo en el
    // servidor tira. Ademas pesa alrededor de 800 KB: no puede entrar al
    // payload inicial de una pagina cuyo contenido util es la lista.
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center p-8">
        <p className="text-body-md text-muted-foreground">Cargando el mapa…</p>
      </div>
    ),
  }
)

export function SitiosExplorerWithMap({
  venues,
  cities,
}: {
  venues: VenueSummary[]
  cities: string[]
}) {
  return (
    <SitiosExplorer
      venues={venues}
      cities={cities}
      map={({ venues: visible, activeId, onActiveChange }) => (
        <VenuesMap venues={visible} activeId={activeId} onActiveChange={onActiveChange} />
      )}
    />
  )
}
