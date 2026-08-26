'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { type ReclamoState, resolverSolicitudAction } from '@/app/actions/reclamos'
import { toastManager } from '@/components/ui/toast'
import { formatDate } from '@/lib/utils/format'

type Solicitud = {
  id: string
  venueId: string
  status: string
  message: string | null
  evidenceUrl: string | null
  reviewNote: string | null
  createdAt: string
  venueSlug: string
  venueNombre: string
  venueCity: string
  venueStatus: string
  solicitante: string
  solicitanteEmail: string
}

export function SolicitudesCola({
  pendientes,
  resueltas,
}: {
  pendientes: Solicitud[]
  resueltas: Solicitud[]
}) {
  const router = useRouter()
  const [notas, setNotas] = useState<Record<string, string>>({})
  const [pendiente, startTransition] = useTransition()

  const resolver = (id: string, decision: 'approved' | 'rejected') => {
    startTransition(async () => {
      const r: ReclamoState = await resolverSolicitudAction(id, decision, notas[id])
      if (r.status === 'success') {
        toastManager.add({ title: r.mensaje, type: 'success' })
        router.refresh()
        return
      }
      if (r.status === 'error') {
        toastManager.add({ title: 'No se pudo', description: r.error, type: 'error' })
      }
    })
  }

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h2 className="font-display font-bold text-headline-md uppercase">
          Pendientes ({pendientes.length})
        </h2>

        {pendientes.length === 0 ? (
          <p className="mt-3 text-body-md text-muted-foreground">Nada por revisar.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {pendientes.map((s) => (
              <li key={s.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display font-bold uppercase">{s.venueNombre}</p>
                    <p className="text-muted-foreground text-sm">
                      {s.venueCity} · sitio en {s.venueStatus === 'published' ? 'publicado' : s.venueStatus}
                    </p>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {formatDate(new Date(s.createdAt))}
                  </p>
                </div>

                <p className="mt-3 text-body-md">
                  <span className="text-muted-foreground">Lo pide </span>
                  {s.solicitante}{' '}
                  <a
                    href={`mailto:${s.solicitanteEmail}`}
                    className="text-primary-text hover:underline"
                  >
                    {s.solicitanteEmail}
                  </a>
                </p>

                {s.message ? (
                  <p className="mt-2 whitespace-pre-wrap rounded-lg border border-border p-3 text-body-md">
                    {s.message}
                  </p>
                ) : null}

                {/* Enlace crudo, sin previsualizar: lo escribio un desconocido y
                    renderizarlo como imagen seria cargar lo que el diga. */}
                {s.evidenceUrl ? (
                  <p className="mt-2 break-all text-sm">
                    <span className="text-muted-foreground">Enlace: </span>
                    <a
                      href={s.evidenceUrl}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="text-primary-text hover:underline"
                    >
                      {s.evidenceUrl}
                    </a>
                  </p>
                ) : null}

                <textarea
                  value={notas[s.id] ?? ''}
                  onChange={(e) => setNotas((n) => ({ ...n, [s.id]: e.target.value }))}
                  rows={2}
                  placeholder="Nota de la decisión (la ve quien lo pidió)"
                  className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-body-md focus:border-primary focus:outline-none"
                />

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pendiente}
                    onClick={() => resolver(s.id, 'approved')}
                    className="rounded-lg bg-primary px-4 py-2 font-display text-label-lg text-primary-foreground uppercase disabled:opacity-50"
                  >
                    Aprobar
                  </button>
                  <button
                    type="button"
                    disabled={pendiente}
                    onClick={() => resolver(s.id, 'rejected')}
                    className="rounded-lg border border-border px-4 py-2 font-display text-label-lg uppercase text-muted-foreground transition-colors hover:border-destructive hover:text-destructive-foreground disabled:opacity-50"
                  >
                    Rechazar
                  </button>
                  <Link
                    href={`/admin/sitios/${s.venueId}`}
                    className="self-center px-2 text-primary-text text-sm hover:underline"
                  >
                    Ver el sitio
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {resueltas.length > 0 ? (
        <section>
          <h2 className="font-display font-bold text-headline-md uppercase">Ya resueltas</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {resueltas.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border border-dashed p-4"
              >
                <span className="min-w-0">
                  <span className="font-medium">{s.venueNombre}</span>{' '}
                  <span className="text-muted-foreground text-sm">
                    · {s.solicitanteEmail}
                  </span>
                </span>
                <span className="text-muted-foreground text-xs uppercase">
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
