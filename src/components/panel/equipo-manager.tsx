'use client'

import { Trash2Icon, XIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useTransition } from 'react'

import {
  type EquipoState,
  cambiarRolAction,
  invitarAlEquipoAction,
  revocarInvitacionAction,
  sacarDelEquipoAction,
} from '@/app/actions/equipo'
import { toastManager } from '@/components/ui/toast'
import { formatDate } from '@/lib/utils/format'

type Miembro = {
  memberId: string
  userId: string
  nombre: string
  email: string
  role: string
  desde: string
}

type Invitacion = {
  id: string
  email: string
  role: string
  expiresAt: string
}

const ROL_TEXTO: Record<string, string> = { owner: 'Dueño', staff: 'Equipo' }

export function EquipoManager({
  venueId,
  miUserId,
  equipo,
  invitaciones,
}: {
  venueId: string
  miUserId: string
  equipo: Miembro[]
  invitaciones: Invitacion[]
}) {
  const router = useRouter()
  const [estado, invitar, invitando] = useActionState<EquipoState, FormData>(
    invitarAlEquipoAction,
    { status: 'idle' }
  )
  const [pendiente, startTransition] = useTransition()

  // El resultado de la invitacion llega por useActionState, no por el
  // transition de abajo, asi que su aviso se dispara aca.
  useEffect(() => {
    if (estado.status === 'success') {
      toastManager.add({ title: estado.mensaje, type: 'success' })
      router.refresh()
    }
    if (estado.status === 'error') {
      toastManager.add({ title: 'No se pudo', description: estado.error, type: 'error' })
    }
  }, [estado, router])

  const correr = (accion: () => Promise<EquipoState>) => {
    startTransition(async () => {
      const resultado = await accion()
      if (resultado.status === 'success') {
        toastManager.add({ title: resultado.mensaje, type: 'success' })
        router.refresh()
        return
      }
      if (resultado.status === 'error') {
        toastManager.add({ title: 'No se pudo', description: resultado.error, type: 'error' })
      }
    })
  }

  const ocupado = invitando || pendiente
  const duenos = equipo.filter((m) => m.role === 'owner').length

  return (
    <div className="flex flex-col gap-10">
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-display font-bold text-headline-md uppercase">Invitar a alguien</h2>
        <p className="mt-1 text-body-md text-muted-foreground">
          Le llega un correo con un enlace. Para entrar tiene que usar ese mismo correo.
        </p>

        <form action={invitar} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input type="hidden" name="venueId" value={venueId} />
          <input
            type="email"
            name="email"
            required
            placeholder="correo@dequien.trabaja"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-body-md focus:border-primary focus:outline-none"
          />
          <select
            name="role"
            defaultValue="staff"
            className="rounded-lg border border-border bg-background px-3 py-2 text-body-md focus:border-primary focus:outline-none"
          >
            <option value="staff">Equipo</option>
            <option value="owner">Dueño</option>
          </select>
          <button
            type="submit"
            disabled={ocupado}
            className="rounded-lg bg-primary px-5 py-2 font-display text-label-lg text-primary-foreground uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {invitando ? 'Enviando…' : 'Invitar'}
          </button>
        </form>
      </section>

      <section>
        <h2 className="font-display font-bold text-headline-md uppercase">En el equipo</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {equipo.map((miembro) => {
            const esYo = miembro.userId === miUserId
            // El ultimo dueno no se puede tocar. La accion lo rechaza igual;
            // deshabilitarlo aca ademas explica por que, en vez de dejar que
            // alguien lo intente y reciba un error.
            const esUltimoDueno = miembro.role === 'owner' && duenos === 1

            return (
              <li
                key={miembro.memberId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {miembro.nombre}
                    {esYo ? <span className="text-muted-foreground"> (tú)</span> : null}
                  </p>
                  <p className="truncate text-muted-foreground text-sm">{miembro.email}</p>
                  <p className="text-muted-foreground text-xs">
                    Desde {formatDate(new Date(miembro.desde))}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={miembro.role}
                    disabled={ocupado || esUltimoDueno}
                    onChange={(e) =>
                      correr(() =>
                        cambiarRolAction(
                          miembro.memberId,
                          e.target.value as 'owner' | 'staff'
                        )
                      )
                    }
                    className="rounded-lg border border-border bg-background px-2 py-1 text-sm disabled:opacity-50"
                    title={
                      esUltimoDueno
                        ? 'Es el único dueño. Nombra otro dueño primero.'
                        : undefined
                    }
                  >
                    <option value="owner">Dueño</option>
                    <option value="staff">Equipo</option>
                  </select>

                  <button
                    type="button"
                    disabled={ocupado || esUltimoDueno}
                    onClick={() => correr(() => sacarDelEquipoAction(miembro.memberId))}
                    aria-label={`Sacar a ${miembro.nombre} del equipo`}
                    title={
                      esUltimoDueno
                        ? 'Es el único dueño. El sitio no puede quedarse sin dueño.'
                        : 'Sacar del equipo'
                    }
                    className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:border-destructive hover:text-destructive-foreground disabled:opacity-50"
                  >
                    <Trash2Icon className="size-4" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      {invitaciones.length > 0 ? (
        <section>
          <h2 className="font-display font-bold text-headline-md uppercase">
            Invitaciones sin aceptar
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {invitaciones.map((invitacion) => {
              const vencida = new Date(invitacion.expiresAt) < new Date()
              return (
                <li
                  key={invitacion.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border border-dashed p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate">{invitacion.email}</p>
                    <p className="text-muted-foreground text-xs">
                      {ROL_TEXTO[invitacion.role] ?? invitacion.role} ·{' '}
                      {vencida
                        ? 'Venció, vuelve a invitarla'
                        : `Vence el ${formatDate(new Date(invitacion.expiresAt))}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => correr(() => revocarInvitacionAction(invitacion.id))}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1 text-muted-foreground text-sm transition-colors hover:border-destructive hover:text-destructive-foreground disabled:opacity-50"
                  >
                    <XIcon className="size-4" />
                    Cancelar
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
