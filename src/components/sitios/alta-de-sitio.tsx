'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

import { FormularioSolicitud, type SitioElegido } from './formulario-solicitud'

type Resultado = {
  id: string
  slug: string
  nombre: string
  city: string
  addressLine: string
  type: string
  instagram: string | null
  status: string
  duenos: number
}

/**
 * Buscar primero, y si no aparece, llenar el formulario ahi mismo.
 *
 * UNA SOLA PANTALLA. Antes eran dos rutas: buscar en una y "registrar uno
 * nuevo" en otra, con un formulario distinto. Quien no encontraba su bar tenia
 * que darse cuenta de que habia otro enlace mas abajo. Aca buscar es un atajo
 * para prellenar, nunca un requisito para seguir.
 */
export function AltaDeSitio({
  termino,
  resultados,
  correoDeLaCuenta,
}: {
  termino: string
  resultados: Resultado[]
  correoDeLaCuenta: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [texto, setTexto] = useState(termino)
  const [elegido, setElegido] = useState<SitioElegido | null>(null)

  const buscar = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams(searchParams?.toString())
    if (texto.trim()) params.set('q', texto.trim())
    else params.delete('q')
    router.push(`/registrar-sitio?${params.toString()}`)
  }

  if (elegido) {
    return (
      <FormularioSolicitud
        correoDeLaCuenta={correoDeLaCuenta}
        sitio={elegido}
        onCambiarSitio={() => setElegido(null)}
      />
    )
  }

  return (
    <div className='mt-8'>
      <section className='rounded-xl border border-border bg-card p-5'>
        <p className='font-display font-bold text-headline-md uppercase'>¿Ya lo tenemos cargado?</p>
        <p className='mt-1 text-body-md text-muted-foreground'>
          Búscalo y te ahorras escribir los datos. Si no aparece, sigue derecho al formulario.
        </p>

        <form onSubmit={buscar} className='mt-4 flex flex-col gap-3 sm:flex-row'>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder='Nombre del bar, dirección o ciudad'
            className='flex-1 rounded-lg border border-border bg-background px-3 py-2 text-body-md text-street-white focus:border-primary focus:outline-none'
          />
          <button
            type='submit'
            className='rounded-lg border border-primary px-5 py-2 font-display text-label-lg text-primary-text uppercase transition-colors hover:bg-primary/10'
          >
            Buscar
          </button>
        </form>

        {termino.length >= 2 && resultados.length === 0 ? (
          <p className='mt-4 text-body-md text-muted-foreground'>
            No encontramos nada con “{termino}”. Sigue derecho: lo registras abajo.
          </p>
        ) : null}

        {resultados.length > 0 ? (
          <ul className='mt-4 flex flex-col gap-2'>
            {resultados.map((sitio) => {
              const ocupado = sitio.duenos > 0
              return (
                <li
                  key={sitio.id}
                  className='flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3'
                >
                  <div className='min-w-0'>
                    <p className='font-display font-bold uppercase'>{sitio.nombre}</p>
                    <p className='text-muted-foreground text-sm'>
                      {sitio.addressLine}, {sitio.city}
                    </p>
                  </div>

                  {/* Decirlo antes evita una solicitud que nace rechazada. */}
                  {ocupado ? (
                    <span className='text-muted-foreground text-xs uppercase'>Ya tiene dueño</span>
                  ) : (
                    <button
                      type='button'
                      onClick={() =>
                        setElegido({
                          id: sitio.id,
                          nombre: sitio.nombre,
                          city: sitio.city,
                          addressLine: sitio.addressLine,
                          type: sitio.type,
                          instagram: sitio.instagram,
                        })
                      }
                      className='rounded-lg bg-primary px-4 py-2 font-display text-label-lg text-primary-foreground uppercase'
                    >
                      Este es mío
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        ) : null}
      </section>

      <FormularioSolicitud correoDeLaCuenta={correoDeLaCuenta} />
    </div>
  )
}
