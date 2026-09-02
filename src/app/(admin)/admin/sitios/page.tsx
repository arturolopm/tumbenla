import Link from 'next/link'

import { VenueStatusControl } from '@/components/admin/venue-status-control'
import { listVenuesForAdmin } from '@/lib/venues/queries'

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  published: 'Publicado',
  paused: 'Pausado',
  archived: 'Archivado',
}

export default async function AdminSitiosPage() {
  const venues = await listVenuesForAdmin()

  return (
    <div className='flex flex-col gap-6'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h1 className='font-display font-extrabold text-3xl'>Sitios</h1>
          <p className='text-muted-foreground text-sm'>
            {venues.length === 1 ? '1 sitio cargado' : `${venues.length} sitios cargados`}
          </p>
        </div>
        <Link
          href='/admin/sitios/nuevo'
          className='rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground text-sm'
        >
          Agregar un sitio
        </Link>
      </div>

      {venues.length === 0 ? (
        <div className='rounded-xl border border-border border-dashed p-8'>
          <p className='font-medium'>Todavía no hay sitios.</p>
          <p className='mt-1 text-muted-foreground text-sm'>
            Agrega el primero y aparecera en el mapa publico.
          </p>
        </div>
      ) : (
        <ul className='flex flex-col gap-2'>
          {venues.map((venue) => (
            <li
              key={venue.id}
              className='flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4'
            >
              <div className='min-w-0 flex-1'>
                <p className='truncate font-medium'>
                  <Link
                    href={`/admin/sitios/${venue.id}`}
                    className='hover:text-primary-text focus-visible:outline-none focus-visible:underline'
                  >
                    {venue.name}
                  </Link>
                </p>
                <p className='truncate text-muted-foreground text-sm'>
                  {venue.neighborhood ? `${venue.neighborhood}, ` : ''}
                  {venue.city} · {STATUS_LABEL[venue.status]}
                </p>
              </div>

              <VenueStatusControl id={venue.id} status={venue.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
