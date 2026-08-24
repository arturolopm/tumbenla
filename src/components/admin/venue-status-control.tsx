'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

import { setVenueStatusAction } from '@/app/actions/venues'
import { toastManager } from '@/components/ui/toast'
import type { VenueStatus } from '@/lib/venues/types'
import { VENUE_STATUSES } from '@/lib/venues/types'

const STATUS_LABEL: Record<VenueStatus, string> = {
  draft: 'Borrador',
  published: 'Publicado',
  paused: 'Pausado',
  archived: 'Archivado',
}

/**
 * Cambiar el estado sin abrir el formulario completo, que es la operacion que
 * mas se repite: publicar lo que estaba en borrador, o pausar un sitio que dejo
 * de cumplir.
 */
export function VenueStatusControl({ id, status }: { id: string; status: VenueStatus }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <select
      defaultValue={status}
      disabled={pending}
      aria-label="Cambiar estado"
      onChange={(event) => {
        const next = event.target.value
        const previous = status
        startTransition(async () => {
          const result = await setVenueStatusAction(id, next)
          if (result.ok) {
            // router.refresh() y no un estado local: la accion ya revalido las
            // rutas publicas, y esto vuelve a leer la lista del servidor para
            // que lo que se ve sea lo que quedo guardado, no lo que se pidio.
            router.refresh()
            return
          }
          // Devolver el select a donde estaba. Dejarlo en el valor nuevo
          // despues de un fallo es mentirle al operador sobre lo que hay
          // publicado, que en este producto es justo lo que no puede pasar.
          event.target.value = previous
          toastManager.add({
            title: 'No se pudo cambiar el estado',
            description: result.error,
            type: 'error',
          })
        })
      }}
      className="h-9 rounded-lg border border-input bg-card px-3 text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
    >
      {VENUE_STATUSES.map((option) => (
        <option key={option} value={option}>
          {STATUS_LABEL[option]}
        </option>
      ))}
    </select>
  )
}
