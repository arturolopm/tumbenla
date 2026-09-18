'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { abrirNocheComoRumberoAction } from '@/app/actions/noches'
import { toastManager } from '@/components/ui/toast'

/**
 * "Salí y mi noche no está en la lista."
 *
 * Abre la noche y lleva a quien la abrio derecho a ella, porque abrir una noche
 * vacia no es lo que vino a hacer: vino a subir sus fotos. Si el sitio ya la
 * habia abierto, la accion devuelve esa misma y esto termina igual, en la noche
 * correcta.
 */
export function AbrirNoche({ venueSlug }: { venueSlug: string }) {
  const router = useRouter()
  const [pendiente, startTransition] = useTransition()
  const [fecha, setFecha] = useState('')

  const abrir = () => {
    if (!fecha) return
    startTransition(async () => {
      const r = await abrirNocheComoRumberoAction(venueSlug, fecha)
      if (r.status === 'success' && r.nightId) {
        router.push(`/sitios/${venueSlug}/noches/${r.nightId}`)
        return
      }
      toastManager.add({
        title: 'No se pudo',
        description: r.status === 'error' ? r.error : undefined,
        type: 'error',
      })
    })
  }

  return (
    <div className='mt-6 rounded-xl border border-border border-dashed p-4'>
      <p className='font-display font-bold uppercase'>¿Saliste y tu noche no está?</p>
      <p className='mt-1 text-body-md text-muted-foreground'>
        Dinos qué día fue y la abrimos para que subas tus fotos.
      </p>
      <div className='mt-3 flex flex-wrap items-center gap-2'>
        <label htmlFor='fecha-noche' className='sr-only'>
          Qué día fue esa noche
        </label>
        <input
          id='fecha-noche'
          type='date'
          value={fecha}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setFecha(e.target.value)}
          className='rounded-lg border border-border bg-background px-3 py-2 text-body-md focus:border-primary focus:outline-none'
        />
        <button
          type='button'
          disabled={pendiente || !fecha}
          onClick={abrir}
          className='rounded-lg bg-primary px-4 py-2 font-display text-primary-foreground text-sm uppercase disabled:opacity-50'
        >
          Abrir esa noche
        </button>
      </div>
    </div>
  )
}
