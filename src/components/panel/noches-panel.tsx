'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { type NocheState, guardarNocheAction, publicarNocheAction } from '@/app/actions/noches'
import { useActionFeedback, useActionRunner } from '@/hooks/use-panel-action'
import { formatDate } from '@/lib/utils/format'

type Noche = {
  id: string
  happenedAt: string
  title: string | null
  status: string
  fotos: number
  pendientes: number
  disponibles: number
}

export function NochesPanel({
  venueId,
  slug,
  noches,
}: {
  venueId: string
  slug: string
  noches: Noche[]
}) {
  const [estado, crear, creando] = useActionState<NocheState, FormData>(guardarNocheAction, {
    status: 'idle',
  })
  useActionFeedback(estado)

  const { run, pending } = useActionRunner()

  const alternar = (noche: Noche) =>
    run(() => publicarNocheAction(noche.id, noche.status === 'published' ? 'draft' : 'published'))

  return (
    <div className='flex flex-col gap-8'>
      <section className='rounded-xl border border-border bg-card p-5'>
        <h2 className='font-display font-bold text-headline-md uppercase'>Nueva noche</h2>
        <p className='mt-1 text-body-md text-muted-foreground'>
          La fecha es la de la noche, no la de hoy. Una fiesta que terminó a las 4 am es de la
          noche en que empezó.
        </p>
        <form action={crear} className='mt-4 flex flex-col gap-3 sm:flex-row'>
          <input type='hidden' name='venueId' value={venueId} />
          <input
            type='date'
            name='happenedAt'
            required
            className='rounded-lg border border-border bg-background px-3 py-2 text-body-md focus:border-primary focus:outline-none'
          />
          <input
            name='title'
            placeholder='Nombre de la noche (opcional)'
            className='flex-1 rounded-lg border border-border bg-background px-3 py-2 text-body-md focus:border-primary focus:outline-none'
          />
          <button
            type='submit'
            disabled={creando}
            className='rounded-lg bg-primary px-5 py-2 font-display text-label-lg text-primary-foreground uppercase transition-opacity hover:opacity-90 disabled:opacity-50'
          >
            {creando ? 'Creando…' : 'Crear'}
          </button>
        </form>
      </section>

      {noches.length === 0 ? (
        <p className='text-body-md text-muted-foreground'>
          Todavía no hay noches. Crea la primera y súbele las fotos.
        </p>
      ) : (
        <ul className='flex flex-col gap-2'>
          {noches.map((noche) => (
            <NocheRow
              key={noche.id}
              noche={noche}
              slug={slug}
              onAlternar={() => alternar(noche)}
              disabled={pending}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function NocheRow({
  noche,
  slug,
  onAlternar,
  disabled,
}: {
  noche: Noche
  slug: string
  onAlternar: () => void
  disabled: boolean
}) {
  const publicada = noche.status === 'published'
  const sinFotos = noche.disponibles === 0 && noche.pendientes === 0

  return (
    <li className='flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4'>
      <div className='min-w-0'>
        <p>
          <Link
            href={`/panel/${slug}/noches/${noche.id}`}
            className='font-display font-bold uppercase underline-offset-4 hover:text-primary-text hover:underline'
          >
            {noche.title || formatDate(new Date(noche.happenedAt))}
          </Link>
          {/* La fecha solo se repite cuando la noche tiene nombre propio: sin
              nombre, el nombre YA es la fecha. */}
          {noche.title ? (
            <span className='ml-2 text-muted-foreground text-xs'>
              {formatDate(new Date(noche.happenedAt))}
            </span>
          ) : null}
        </p>
        <p className='text-muted-foreground text-sm'>
          {sinFotos ? 'sin fotos todavía' : `${noche.disponibles} visibles`}
          {noche.pendientes > 0 ? (
            <span className='text-primary-text'> · {noche.pendientes} por revisar</span>
          ) : null}
        </p>
      </div>

      <div className='flex items-center gap-2'>
        <span className='text-muted-foreground text-xs uppercase'>
          {publicada ? 'Publicada' : 'Borrador'}
        </span>
        {/* The night's title also links here, but a title that only changes on
            hover is not an affordance: the whole point of the row is the photos,
            so the row says so. */}
        <Link
          href={`/panel/${slug}/noches/${noche.id}`}
          className={`rounded-lg border px-3 py-1 text-sm transition-colors hover:border-primary ${
            sinFotos ? 'border-primary text-primary-text' : 'border-border'
          }`}
        >
          {sinFotos ? 'Subir fotos' : 'Ver fotos'}
        </Link>
        <button
          type='button'
          disabled={disabled}
          onClick={onAlternar}
          className='rounded-lg border border-border px-3 py-1 text-sm transition-colors hover:border-primary disabled:opacity-50'
        >
          {publicada ? 'Volver a borrador' : 'Publicar'}
        </button>
      </div>
    </li>
  )
}
