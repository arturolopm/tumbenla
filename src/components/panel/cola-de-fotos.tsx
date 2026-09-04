'use client'

import Link from 'next/link'

import {
  borrarFotoAction,
  moderarFotoAction,
  resolverReporteAction,
} from '@/app/actions/noches'
import { useActionRunner } from '@/hooks/use-panel-action'
import { formatDate } from '@/lib/utils/format'

type Pendiente = {
  id: string
  url: string
  caption: string | null
  source: string
  createdAt: string
  nightId: string
  happenedAt: string
  nightTitle: string | null
}

type Reporte = {
  id: string
  reason: string | null
  createdAt: string
  photoId: string
  url: string
  photoStatus: string
  nightId: string
}

export function ColaDeFotos({
  slug,
  pendientes,
  reportes,
}: {
  slug: string
  pendientes: Pendiente[]
  reportes: Reporte[]
}) {
  const { run, pending } = useActionRunner()

  return (
    <div className='flex flex-col gap-10'>
      {/* Los reportes van primero. Una foto sin revisar puede esperar; alguien
          pidiendo que baje una foto suya, no. */}
      {reportes.length > 0 ? (
        <section>
          <h2 className='font-display font-bold text-headline-md text-primary-text uppercase'>
            Alguien pidió que bajes una foto ({reportes.length})
          </h2>
          <p className='mt-1 max-w-prose text-body-md text-muted-foreground'>
            Sale gente identificable en estas fotos. Si quien reporta dice que es él o ella,
            retírala; no hace falta que lo demuestre.
          </p>

          <ul className='mt-4 flex flex-col gap-3'>
            {reportes.map((reporte) => (
              <ReporteCard key={reporte.id} reporte={reporte} run={run} pending={pending} />
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className='font-display font-bold text-headline-md uppercase'>
          Fotos que subió la gente ({pendientes.length})
        </h2>

        {pendientes.length === 0 ? (
          <p className='mt-2 text-body-md text-muted-foreground'>
            Nada por revisar. Cuando alguien suba una foto a una de tus noches, aparece acá.
          </p>
        ) : (
          <ul className='mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3'>
            {pendientes.map((foto) => (
              <FotoPendienteCard
                key={foto.id}
                foto={foto}
                slug={slug}
                run={run}
                pending={pending}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

type RunFn = ReturnType<typeof useActionRunner>['run']

function ReporteCard({
  reporte,
  run,
  pending,
}: {
  reporte: Reporte
  run: RunFn
  pending: boolean
}) {
  return (
    <li className='flex flex-wrap gap-4 rounded-xl border border-primary bg-primary/5 p-4'>
      <img src={reporte.url} alt='' className='size-24 shrink-0 rounded-lg object-cover' />
      <div className='min-w-0 flex-1'>
        <p className='text-muted-foreground text-xs uppercase'>
          {formatDate(new Date(reporte.createdAt))} ·{' '}
          {reporte.photoStatus === 'available' ? 'todavía visible' : 'ya no se ve'}
        </p>
        {reporte.reason ? (
          <p className='mt-1 whitespace-pre-wrap text-body-md'>{reporte.reason}</p>
        ) : null}

        <div className='mt-3 flex flex-wrap gap-2'>
          <button
            type='button'
            disabled={pending}
            onClick={() => run(() => moderarFotoAction(reporte.photoId, 'hidden'))}
            className='rounded-lg bg-primary px-4 py-1 font-display text-primary-foreground text-sm uppercase disabled:opacity-50'
          >
            Retirar la foto
          </button>
          <button
            type='button'
            disabled={pending}
            onClick={() => run(() => borrarFotoAction(reporte.photoId))}
            className='rounded-lg border border-border px-4 py-1 text-sm transition-colors hover:border-destructive hover:text-destructive-foreground disabled:opacity-50'
          >
            Borrarla del todo
          </button>
          <button
            type='button'
            disabled={pending}
            onClick={() => run(() => resolverReporteAction(reporte.id))}
            className='rounded-lg px-4 py-1 text-muted-foreground text-sm hover:text-street-white disabled:opacity-50'
          >
            Ya lo resolví
          </button>
        </div>
      </div>
    </li>
  )
}

function FotoPendienteCard({
  foto,
  slug,
  run,
  pending,
}: {
  foto: Pendiente
  slug: string
  run: RunFn
  pending: boolean
}) {
  return (
    <li className='overflow-hidden rounded-xl border border-border bg-card'>
      <img src={foto.url} alt={foto.caption ?? ''} className='aspect-square w-full object-cover' />
      <div className='flex flex-col gap-2 p-3'>
        <Link
          href={`/panel/${slug}/noches/${foto.nightId}`}
          className='truncate text-muted-foreground text-xs hover:text-primary-text'
        >
          {foto.nightTitle || formatDate(new Date(foto.happenedAt))}
        </Link>
        <div className='flex flex-wrap gap-1'>
          <button
            type='button'
            disabled={pending}
            onClick={() => run(() => moderarFotoAction(foto.id, 'available'))}
            className='rounded-lg bg-primary px-3 py-1 font-display text-primary-foreground text-xs uppercase disabled:opacity-50'
          >
            Habilitar
          </button>
          <button
            type='button'
            disabled={pending}
            onClick={() => run(() => borrarFotoAction(foto.id))}
            className='rounded-lg border border-border px-3 py-1 text-xs transition-colors hover:border-destructive disabled:opacity-50'
          >
            Borrar
          </button>
        </div>
      </div>
    </li>
  )
}
