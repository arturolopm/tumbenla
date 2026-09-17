import Link from 'next/link'
import { notFound } from 'next/navigation'

import { VenueForm } from '@/components/admin/venue-form'
import { getVenueById } from '@/lib/venues/queries'

export default async function EditarSitioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const venue = await getVenueById(id)

  if (!venue) notFound()

  return (
    <div className='flex flex-col gap-6'>
      <div>
        <h1 className='font-display font-extrabold text-3xl'>{venue.name}</h1>
        <p className='text-muted-foreground text-sm'>
          {venue.status === 'published' ? (
            <>
              Publicado en{' '}
              <Link href={`/sitios/${venue.slug}`} className='underline underline-offset-2'>
                /sitios/{venue.slug}
              </Link>
            </>
          ) : (
            'Todavía no está publicado.'
          )}
        </p>
      </div>

      <VenueForm venue={venue} />
    </div>
  )
}
