'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useActionState, useEffect, useState } from 'react'

import { type ReclamoState, solicitarSitioAction } from '@/app/actions/reclamos'
import { toastManager } from '@/components/ui/toast'

type Resultado = {
  id: string
  slug: string
  nombre: string
  city: string
  addressLine: string
  status: string
  duenos: number
}

/**
 * Buscar el sitio propio y pedirlo.
 *
 * La busqueda va por la URL (?q=) y no por estado local: asi el resultado se
 * puede compartir y sobrevive a recargar, que es justo lo que pasa cuando
 * alguien manda una solicitud y la pagina se revalida.
 */
export function BuscadorDeSitios({
  termino,
  resultados,
}: {
  termino: string
  resultados: Resultado[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [texto, setTexto] = useState(termino)
  const [abierto, setAbierto] = useState<string | null>(null)

  const [estado, solicitar, enviando] = useActionState<ReclamoState, FormData>(
    solicitarSitioAction,
    { status: 'idle' }
  )

  useEffect(() => {
    if (estado.status === 'success') {
      toastManager.add({ title: estado.mensaje, type: 'success' })
      setAbierto(null)
      router.refresh()
    }
    if (estado.status === 'error') {
      toastManager.add({ title: 'No se pudo', description: estado.error, type: 'error' })
    }
  }, [estado, router])

  const buscar = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams(searchParams?.toString())
    if (texto.trim()) params.set('q', texto.trim())
    else params.delete('q')
    router.push(`/registrar-sitio?${params.toString()}`)
  }

  return (
    <div className="mt-8">
      <form onSubmit={buscar} className="flex flex-col gap-3 sm:flex-row">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Nombre del bar, dirección o ciudad"
          className="flex-1 rounded-xl border border-border bg-background px-4 py-3 text-body-md focus:border-primary focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-xl bg-primary px-5 py-3 font-display text-label-lg text-primary-foreground uppercase transition-opacity hover:opacity-90"
        >
          Buscar
        </button>
      </form>

      {termino.length >= 2 && resultados.length === 0 ? (
        <p className="mt-6 text-body-md text-muted-foreground">
          No encontramos nada con “{termino}”. Puede que no esté cargado todavía.
        </p>
      ) : null}

      {resultados.length > 0 ? (
        <ul className="mt-6 flex flex-col gap-2">
          {resultados.map((sitio) => {
            const ocupado = sitio.duenos > 0
            return (
              <li key={sitio.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display font-bold uppercase">{sitio.nombre}</p>
                    <p className="text-muted-foreground text-sm">
                      {sitio.addressLine}, {sitio.city}
                    </p>
                  </div>

                  {/* Decirlo antes evita una solicitud que nace rechazada. */}
                  {ocupado ? (
                    <span className="text-muted-foreground text-xs uppercase">
                      Ya tiene dueño
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAbierto(abierto === sitio.id ? null : sitio.id)}
                      className="rounded-lg border border-primary px-4 py-2 font-display text-label-lg text-primary-text uppercase transition-colors hover:bg-primary/10"
                    >
                      Este es mío
                    </button>
                  )}
                </div>

                {abierto === sitio.id ? (
                  <form action={solicitar} className="mt-4 flex flex-col gap-3">
                    <input type="hidden" name="venueId" value={sitio.id} />
                    <label className="text-muted-foreground text-sm" htmlFor={`m-${sitio.id}`}>
                      Cuéntanos cómo confirmamos que es tuyo. Un teléfono del sitio, tu
                      Instagram, cualquier cosa con la que podamos llamarte.
                    </label>
                    <textarea
                      id={`m-${sitio.id}`}
                      name="message"
                      rows={3}
                      required
                      className="rounded-lg border border-border bg-background px-3 py-2 text-body-md focus:border-primary focus:outline-none"
                    />
                    <input
                      name="evidenceUrl"
                      placeholder="Un enlace, si tienes (opcional)"
                      className="rounded-lg border border-border bg-background px-3 py-2 text-body-md focus:border-primary focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={enviando}
                      className="self-start rounded-lg bg-primary px-5 py-2 font-display text-label-lg text-primary-foreground uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {enviando ? 'Enviando…' : 'Enviar la solicitud'}
                    </button>
                  </form>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
