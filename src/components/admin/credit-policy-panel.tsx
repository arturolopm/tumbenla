'use client'

import { useActionState, useEffect, useState } from 'react'

import { type CreditPolicyState, configureCreditPolicyAction } from '@/app/actions/credito'
import { toastManager } from '@/components/ui/toast'
import { formatCOP } from '@/lib/utils/format'

export type CreditPolicyView = Readonly<{
  venueId: string
  venueName: string
  venueSlug: string
  version: number | null
  limit: number
  reserved: number
  outstanding: number
  available: number
  overdue: number
  maxActiveReservations: number
  maxActivePerShopper: number
}>

const newOperationKey = (): string =>
  typeof globalThis.crypto?.randomUUID === 'function'
    ? `credit-policy:${globalThis.crypto.randomUUID()}`
    : `credit-policy:${Date.now()}:${Math.random().toString(36).slice(2)}`

export function CreditPolicyPanel({ venues }: { venues: readonly CreditPolicyView[] }) {
  return (
    <section className='flex flex-col gap-3'>
      <div>
        <h2 className='font-display text-label-lg uppercase'>Cupo para cobrar en la barra</h2>
        <p className='mt-1 max-w-prose text-body-md text-muted-foreground'>
          Cada sitio arranca con $500.000. El disponible descuenta deuda y reservas activas; guarda
          un cupo de $0 para cortar pedidos nuevos sin afectar los pagos aquí.
        </p>
      </div>
      <ul className='grid gap-4 lg:grid-cols-2'>
        {venues.map((venue) => (
          <CreditPolicyRow key={venue.venueId} venue={venue} />
        ))}
      </ul>
    </section>
  )
}

function CreditPolicyRow({ venue }: { venue: CreditPolicyView }) {
  const [operationKey, setOperationKey] = useState('')
  const [state, action, pending] = useActionState<CreditPolicyState, FormData>(
    configureCreditPolicyAction,
    { status: 'idle' }
  )

  useEffect(() => setOperationKey(newOperationKey()), [])
  useEffect(() => {
    if (state.status === 'success') {
      toastManager.add({ title: state.message, type: 'success' })
      setOperationKey(newOperationKey())
    } else if (state.status === 'error') {
      toastManager.add({ title: 'No se pudo guardar', description: state.error, type: 'error' })
    }
  }, [state])

  return (
    <li className='rounded-xl border border-border bg-card p-5'>
      <div className='flex items-start justify-between gap-3'>
        <div>
          <p className='font-display font-bold text-lg'>{venue.venueName}</p>
          <p className='text-muted-foreground text-sm'>
            {venue.version ? `Política v${venue.version}` : 'Cupo inicial automático'}
          </p>
        </div>
        {venue.overdue > 0 ? (
          <span className='rounded-full bg-destructive/15 px-2 py-1 font-display text-destructive-foreground text-xs uppercase'>
            Deuda vencida
          </span>
        ) : null}
      </div>
      <dl className='mt-4 grid grid-cols-3 gap-2 text-sm'>
        <Metric label='Reservado' value={venue.reserved} />
        <Metric label='Deuda' value={venue.outstanding} />
        <Metric label='Disponible' value={Math.max(venue.available, 0)} />
      </dl>
      <form action={action} className='mt-4 grid gap-3 border-border border-t pt-4 sm:grid-cols-2'>
        <input type='hidden' name='venueId' value={venue.venueId} />
        <input type='hidden' name='operationKey' value={operationKey} />
        <label className='flex flex-col gap-1 sm:col-span-2'>
          <span className='font-display text-label-lg uppercase'>Cupo vigente en pesos</span>
          <input
            name='limitPesos'
            type='number'
            min={0}
            step={1}
            defaultValue={venue.limit}
            required
            className='rounded-lg border border-border bg-background px-3 py-2'
          />
        </label>
        <label className='flex flex-col gap-1'>
          <span className='text-sm'>Reservas activas del sitio</span>
          <input
            name='maxActiveReservations'
            type='number'
            min={1}
            max={1000}
            defaultValue={venue.maxActiveReservations}
            required
            className='rounded-lg border border-border bg-background px-3 py-2'
          />
        </label>
        <label className='flex flex-col gap-1'>
          <span className='text-sm'>Por comprador</span>
          <input
            name='maxActivePerShopper'
            type='number'
            min={1}
            max={100}
            defaultValue={venue.maxActivePerShopper}
            required
            className='rounded-lg border border-border bg-background px-3 py-2'
          />
        </label>
        <button
          type='submit'
          disabled={pending || !operationKey}
          className='rounded-lg bg-primary px-5 py-2 font-display text-label-lg text-primary-foreground uppercase disabled:opacity-50 sm:col-span-2'
        >
          {pending ? 'Guardando…' : 'Guardar cupo'}
        </button>
      </form>
    </li>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className='text-muted-foreground'>{label}</dt>
      <dd className='font-display font-bold'>{formatCOP(value)}</dd>
    </div>
  )
}
