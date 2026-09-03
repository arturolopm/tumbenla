'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import {
  type DecisionState,
  pedirVerificacionAction,
  rechazarSolicitudAction,
} from '@/app/actions/reclamos'
import { toastManager } from '@/components/ui/toast'
import { urlInstagram } from '@/config/contacto'
import { formatDate } from '@/lib/utils/format'

export type Solicitud = {
  id: string
  status: string
  name: string
  // Nullable desde la decision 35: el formulario de cuatro campos no los pide y
  // los pone el operador al aprobar. Las solicitudes viejas si los traen.
  type: string | null
  city: string | null
  addressLine: string | null
  neighborhood: string | null
  instagram: string
  contactEmail: string
  tiktok: string | null
  whatsapp: string | null
  phone: string | null
  website: string | null
  openingHours: string | null
  description: string | null
  pledgeIdea: string | null
  reviewNote: string | null
  createdAt: string
  venueId: string | null
  venueSlug: string | null
  venueNombre: string | null
  /** null = todavia nadie creo la cuenta. No se puede aprobar asi. */
  userId: string | null
  solicitante: string | null
  solicitanteEmail: string | null
}

export function SolicitudesCola({
  abiertas,
  resueltas,
}: {
  abiertas: Solicitud[]
  resueltas: Solicitud[]
}) {
  const router = useRouter()
  const [notas, setNotas] = useState<Record<string, string>>({})
  const [pendiente, startTransition] = useTransition()

  const correr = (accion: () => Promise<DecisionState>) => {
    startTransition(async () => {
      const r = await accion()
      if (r.status === 'success') {
        toastManager.add({ title: r.mensaje, type: 'success' })
        router.refresh()
      } else if (r.status === 'error') {
        toastManager.add({ title: 'No se pudo', description: r.error, type: 'error' })
      }
    })
  }

  return (
    <div className='flex flex-col gap-10'>
      <section>
        <h2 className='font-display font-bold text-headline-md uppercase'>
          Sin resolver ({abiertas.length})
        </h2>

        {abiertas.length === 0 ? (
          <p className='mt-3 text-body-md text-muted-foreground'>Nada por revisar.</p>
        ) : (
          <ul className='mt-3 flex flex-col gap-3'>
            {abiertas.map((s) => (
              <li key={s.id} className='rounded-xl border border-border bg-card p-5'>
                <div className='flex flex-wrap items-start justify-between gap-3'>
                  <div className='min-w-0'>
                    <p className='font-display font-bold text-headline-md uppercase'>{s.name}</p>
                    {/* Una solicitud nueva no trae direccion, barrio, ciudad ni
                        tipo: los pone el operador al aprobar (decision 35). Sin
                        este filtro la linea salia como ", , · " y parecia un
                        dato roto en vez de un dato que todavia no existe. */}
                    <p className='text-muted-foreground text-sm'>
                      {[s.addressLine, s.neighborhood, s.city].filter(Boolean).join(', ') ||
                        'Sin dirección todavía'}
                      {s.type ? ` · ${s.type}` : ''}
                    </p>
                  </div>
                  <div className='text-right'>
                    <span
                      className={
                        s.status === 'verifying'
                          ? 'text-primary-text text-xs uppercase'
                          : 'text-muted-foreground text-xs uppercase'
                      }
                    >
                      {s.status === 'verifying' ? 'Esperando su DM' : 'Sin mirar'}
                    </span>
                    <p className='text-muted-foreground text-xs'>
                      {formatDate(new Date(s.createdAt))}
                    </p>
                  </div>
                </div>

                {/* LA COMPARACION QUE DECIDE. El DM tiene que llegar de la
                    cuenta de la izquierda y citar el correo de la derecha. Van
                    juntos y grandes porque son el trabajo del operador; todo lo
                    demas de esta tarjeta es contexto. */}
                <div className='mt-4 grid gap-3 rounded-lg border border-primary bg-primary/5 p-4 sm:grid-cols-2'>
                  <div>
                    <p className='text-muted-foreground text-xs uppercase'>
                      El DM tiene que venir de
                    </p>
                    <a
                      href={urlInstagram(s.instagram)}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='font-display font-bold text-lg text-primary-text hover:underline'
                    >
                      @{s.instagram}
                    </a>
                    {s.tiktok ? (
                      <p className='text-muted-foreground text-xs'>TikTok: @{s.tiktok}</p>
                    ) : null}
                  </div>
                  <div>
                    <p className='text-muted-foreground text-xs uppercase'>
                      Y tiene que citar este correo
                    </p>
                    <p className='break-all font-display font-bold text-lg'>{s.contactEmail}</p>
                  </div>
                </div>

                {!s.userId ? (
                  // Sin cuenta no hay a quien darle la propiedad. Se dice de
                  // frente y con la salida a la mano, porque desde afuera esto
                  // parece que la solicitud esta bien y no avanza sola.
                  <div className='mt-3 rounded-lg border border-primary border-dashed p-3'>
                    <p className='font-display text-label-lg text-primary-text uppercase'>
                      Sin cuenta todavía — no se puede aprobar
                    </p>
                    <p className='mt-1 text-body-md text-muted-foreground'>
                      Mandó la solicitud sin registrarse. Se amarra sola cuando cree la cuenta con{' '}
                      <strong className='text-street-white'>{s.contactEmail}</strong> y verifique el
                      correo. Pásale este enlace cuando le contestes el DM:{' '}
                      <span className='break-all text-primary-text'>
                        /register?correo={s.contactEmail}
                      </span>
                    </p>
                  </div>
                ) : (
                  <div className='mt-3 text-body-md'>
                    <span className='text-muted-foreground'>Queda de dueño: </span>
                    {s.solicitante}{' '}
                    <a
                      href={`mailto:${s.solicitanteEmail}`}
                      className='text-primary-text hover:underline'
                    >
                      {s.solicitanteEmail}
                    </a>
                    {s.solicitanteEmail !== s.contactEmail ? (
                      // No es un error, y por eso es un aviso y no un bloqueo: es
                      // normal aplicar con el correo personal y poner el del bar
                      // como contacto. Pero el DM cita el de contacto, asi que el
                      // operador tiene que verlo antes de comparar.
                      <span className='ml-2 text-muted-foreground text-xs'>
                        (distinto del correo de contacto)
                      </span>
                    ) : null}
                  </div>
                )}

                {s.venueId ? (
                  <p className='mt-2 text-body-md'>
                    <span className='text-muted-foreground'>Pide un sitio que ya tenemos: </span>
                    <Link
                      href={`/admin/sitios/${s.venueId}`}
                      className='text-primary-text hover:underline'
                    >
                      {s.venueNombre}
                    </Link>
                  </p>
                ) : null}

                {s.description ? (
                  <p className='mt-3 whitespace-pre-wrap rounded-lg border border-border p-3 text-body-md'>
                    {s.description}
                  </p>
                ) : null}

                {s.pledgeIdea ? (
                  <div className='mt-2 rounded-lg border border-border p-3'>
                    <p className='text-muted-foreground text-xs uppercase'>
                      Lo que tiene en mente — es una idea, no un compromiso
                    </p>
                    <p className='mt-1 whitespace-pre-wrap text-body-md'>{s.pledgeIdea}</p>
                  </div>
                ) : null}

                {(s.whatsapp || s.phone || s.website || s.openingHours) && (
                  <p className='mt-2 text-muted-foreground text-sm'>
                    {[s.whatsapp && `WhatsApp ${s.whatsapp}`, s.phone, s.website, s.openingHours]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}

                <div className='mt-4 flex flex-wrap items-center gap-2'>
                  {s.status === 'pending' ? (
                    <button
                      type='button'
                      disabled={pendiente}
                      onClick={() => correr(() => pedirVerificacionAction(s.id))}
                      className='rounded-lg border border-primary px-4 py-2 font-display text-label-lg text-primary-text uppercase transition-colors hover:bg-primary/10 disabled:opacity-50'
                    >
                      Pedirle el DM
                    </button>
                  ) : null}

                  {/* Aprobar no es un boton que resuelva solo: lleva al
                      formulario del sitio, donde el operador pone el pin y la
                      direccion. Guardar ahi es lo que crea el sitio y asigna al
                      dueno, en un solo acto.

                      SIN CUENTA VA DESHABILITADO, y no es la proteccion:
                      saveVenueAction lo rechaza igual, antes de crear nada.
                      Esto solo evita que el operador llene un formulario largo
                      para que se lo boten al guardar. */}
                  {s.userId ? (
                    <Link
                      href={`/admin/sitios/nuevo?solicitud=${s.id}`}
                      className='rounded-lg bg-primary px-4 py-2 font-display text-label-lg text-primary-foreground uppercase'
                    >
                      Aprobar y crear el sitio
                    </Link>
                  ) : (
                    <span
                      aria-disabled='true'
                      title='La solicitud todavía no tiene cuenta amarrada'
                      className='cursor-not-allowed rounded-lg bg-primary px-4 py-2 font-display text-label-lg text-primary-foreground uppercase opacity-40'
                    >
                      Aprobar y crear el sitio
                    </span>
                  )}

                  <button
                    type='button'
                    disabled={pendiente}
                    onClick={() => correr(() => rechazarSolicitudAction(s.id, notas[s.id]))}
                    className='rounded-lg border border-border px-4 py-2 font-display text-label-lg text-muted-foreground uppercase transition-colors hover:border-destructive hover:text-destructive-foreground disabled:opacity-50'
                  >
                    Rechazar
                  </button>

                  <input
                    value={notas[s.id] ?? ''}
                    onChange={(e) => setNotas((n) => ({ ...n, [s.id]: e.target.value }))}
                    placeholder='Nota del rechazo (la recibe por correo)'
                    className='min-w-56 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-body-md focus:border-primary focus:outline-none'
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {resueltas.length > 0 ? (
        <section>
          <h2 className='font-display font-bold text-headline-md uppercase'>Ya resueltas</h2>
          <ul className='mt-3 flex flex-col gap-2'>
            {resueltas.map((s) => (
              <li
                key={s.id}
                className='flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border border-dashed p-4'
              >
                <span className='min-w-0'>
                  <span className='font-medium'>{s.name}</span>{' '}
                  <span className='text-muted-foreground text-sm'>· @{s.instagram}</span>
                </span>
                <span className='text-muted-foreground text-xs uppercase'>
                  {s.status === 'approved' ? 'Aprobada' : 'Rechazada'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
