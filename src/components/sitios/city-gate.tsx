'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { type ReactNode, useEffect, useState } from 'react'

import { ciudadActivaMasCercana, ciudadesEnCamino } from '@/config/ciudades'
import { readBrowserGateCity } from '@/lib/cities/gate'

const CITY_LABELS: Record<string, string> = { bogota: 'Bogotá', medellin: 'Medellín' }

const cityLabel = (city: { slug: string; nombre: string }) => CITY_LABELS[city.slug] ?? city.nombre

export const CityGate = ({ children }: { children: ReactNode }) => {
  const params = useSearchParams()
  const override = params.get('ciudad')
  const [city, setCity] = useState<ReturnType<typeof readBrowserGateCity>>(null)

  useEffect(() => {
    setCity(readBrowserGateCity(override))
  }, [override])

  // Server rendering and failed detection both expose the normal content.
  if (!city || city.estado === 'activa') return children

  const nearest = ciudadActivaMasCercana(city)
  const destination = new URLSearchParams(params.toString())
  if (nearest) destination.set('ciudad', nearest.slug)

  return (
    <section className='mx-auto flex w-full max-w-4xl flex-col items-start gap-6 px-margin-mobile py-16 lg:px-margin-desktop'>
      <h1 className='font-display font-black text-4xl text-street-white uppercase'>
        Aún no estamos en {cityLabel(city)}
      </h1>
      <div>
        <h2 className='mb-3 font-display text-headline-md text-primary-text'>Ciudades en camino</h2>
        <ul className='flex flex-wrap gap-3 text-body-lg text-muted-foreground'>
          {ciudadesEnCamino().map((pending) => (
            <li key={pending.slug} className='rounded-lg border border-border px-3 py-2'>
              {cityLabel(pending)}
            </li>
          ))}
        </ul>
      </div>
      {nearest ? (
        <Link
          href={`/sitios?${destination}`}
          className='rounded-lg bg-primary px-5 py-3 font-display text-label-lg text-primary-foreground uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
        >
          Ver sitios en {cityLabel(nearest)}
        </Link>
      ) : (
        <Link href='/sitios?ciudad=' className='text-primary-text underline'>
          Ver los sitios
        </Link>
      )}
    </section>
  )
}
