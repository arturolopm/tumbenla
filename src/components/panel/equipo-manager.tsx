'use client'

import { Trash2Icon, XIcon } from 'lucide-react'
import { useActionState } from 'react'

import {
  type EquipoState,
  cambiarRolAction,
  invitarAlEquipoAction,
  revocarInvitacionAction,
  sacarDelEquipoAction,
} from '@/app/actions/equipo'
import { useActionFeedback, useActionRunner } from '@/hooks/use-panel-action'
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
  const [estado, invitar, invitando] = useActionState<EquipoState, FormData>(invitarAlEquipoAction, {
    status: 'idle',
  })
  // The invite result arrives through useActionState; the row buttons go
  // through the runner. Both report the same way.
  useActionFeedback(estado)
  const { run, pending } = useActionRunner()

  const busy = invitando || pending
  const ownerCount = equipo.filter((m) => m.role === 'owner').length

  return (
    <div className='flex flex-col gap-10'>
      <section className='rounded-xl border border-border bg-card p-5'>
        <h2 className='font-display font-bold text-headline-md uppercase'>Invitar a alguien</h2>
        <p className='mt-1 text-body-md text-muted-foreground'>
          Le llega un correo con un enlace. Para entrar tiene que usar ese mismo correo.
        </p>

        <form action={invitar} className='mt-4 flex flex-col gap-3 sm:flex-row'>
          <input type='hidden' name='venueId' value={venueId} />
          <input
            type='email'
            name='email'
            required
            placeholder='correo@dequien.trabaja'
            className='flex-1 rounded-lg border border-border bg-background px-3 py-2 text-body-md focus:border-primary focus:outline-none'
          />
          <select
            name='role'
            defaultValue='staff'
            className='rounded-lg border border-border bg-background px-3 py-2 text-body-md focus:border-primary focus:outline-none'
          >
            <option value='staff'>Equipo</option>
            <option value='owner'>Dueño</option>
          </select>
          <button
            type='submit'
            disabled={busy}
            className='rounded-lg bg-primary px-5 py-2 font-display text-label-lg text-primary-foreground uppercase transition-opacity hover:opacity-90 disabled:opacity-50'
          >
            {invitando ? 'Enviando…' : 'Invitar'}
          </button>
        </form>
      </section>

      <section>
        <h2 className='font-display font-bold text-headline-md uppercase'>En el equipo</h2>
        <ul className='mt-3 flex flex-col gap-2'>
          {equipo.map((miembro) => (
            <MiembroRow
              key={miembro.memberId}
              miembro={miembro}
              esYo={miembro.userId === miUserId}
              // El último dueño no se puede tocar. La acción lo rechaza igual;
              // deshabilitarlo acá además explica por qué.
              esUltimoDueno={miembro.role === 'owner' && ownerCount === 1}
              disabled={busy}
              onCambiarRol={(role) => run(() => cambiarRolAction(miembro.memberId, role))}
              onSacar={() => run(() => sacarDelEquipoAction(miembro.memberId))}
            />
          ))}
        </ul>
      </section>

      {invitaciones.length > 0 ? (
        <section>
          <h2 className='font-display font-bold text-headline-md uppercase'>
            Invitaciones sin aceptar
          </h2>
          <ul className='mt-3 flex flex-col gap-2'>
            {invitaciones.map((invitacion) => (
              <InvitacionRow
                key={invitacion.id}
                invitacion={invitacion}
                disabled={busy}
                onRevocar={() => run(() => revocarInvitacionAction(invitacion.id))}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function MiembroRow({
  miembro,
  esYo,
  esUltimoDueno,
  disabled,
  onCambiarRol,
  onSacar,
}: {
  miembro: Miembro
  esYo: boolean
  esUltimoDueno: boolean
  disabled: boolean
  onCambiarRol: (role: 'owner' | 'staff') => void
  onSacar: () => void
}) {
  return (
    <li className='flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4'>
      <div className='min-w-0'>
        <p className='truncate font-medium'>
          {miembro.nombre}
          {esYo ? <span className='text-muted-foreground'> (tú)</span> : null}
        </p>
        <p className='truncate text-muted-foreground text-sm'>{miembro.email}</p>
        <p className='text-muted-foreground text-xs'>
          Desde {formatDate(new Date(miembro.desde))}
        </p>
      </div>

      <div className='flex items-center gap-2'>
        <select
          value={miembro.role}
          disabled={disabled || esUltimoDueno}
          onChange={(e) => onCambiarRol(e.target.value as 'owner' | 'staff')}
          className='rounded-lg border border-border bg-background px-2 py-1 text-sm disabled:opacity-50'
          title={esUltimoDueno ? 'Es el único dueño. Nombra otro dueño primero.' : undefined}
        >
          <option value='owner'>Dueño</option>
          <option value='staff'>Equipo</option>
        </select>

        <button
          type='button'
          disabled={disabled || esUltimoDueno}
          onClick={onSacar}
          aria-label={`Sacar a ${miembro.nombre} del equipo`}
          title={
            esUltimoDueno
              ? 'Es el único dueño. El sitio no puede quedarse sin dueño.'
              : 'Sacar del equipo'
          }
          className='rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:border-destructive hover:text-destructive-foreground disabled:opacity-50'
        >
          <Trash2Icon className='size-4' />
        </button>
      </div>
    </li>
  )
}

function InvitacionRow({
  invitacion,
  disabled,
  onRevocar,
}: {
  invitacion: Invitacion
  disabled: boolean
  onRevocar: () => void
}) {
  const vencida = new Date(invitacion.expiresAt) < new Date()

  return (
    <li className='flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border border-dashed p-4'>
      <div className='min-w-0'>
        <p className='truncate'>{invitacion.email}</p>
        <p className='text-muted-foreground text-xs'>
          {ROL_TEXTO[invitacion.role] ?? invitacion.role} ·{' '}
          {vencida
            ? 'Venció, vuelve a invitarla'
            : `Vence el ${formatDate(new Date(invitacion.expiresAt))}`}
        </p>
      </div>
      <button
        type='button'
        disabled={disabled}
        onClick={onRevocar}
        className='inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1 text-muted-foreground text-sm transition-colors hover:border-destructive hover:text-destructive-foreground disabled:opacity-50'
      >
        <XIcon className='size-4' />
        Cancelar
      </button>
    </li>
  )
}
