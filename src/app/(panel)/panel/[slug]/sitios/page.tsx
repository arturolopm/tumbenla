import { Building2Icon, PlusIcon } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { getVenueForPanel, listMyVenues, requireVenueAccess } from '@/lib/auth/venue-access'
import { cn } from '@/lib/utils/css'

export const dynamic = 'force-dynamic'

export default async function OwnerVenuesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const currentVenue = await getVenueForPanel(slug)
  if (!currentVenue) notFound()

  const access = await requireVenueAccess(currentVenue.id, `/panel/${slug}/sitios`, ['owner'])
  const venues = access.esPlataforma ? [] : await listMyVenues(access.userId)

  return (
    <div className='flex max-w-3xl flex-col gap-8'>
      <header>
        <h1 className='font-display font-black text-3xl uppercase leading-none tracking-tighter'>
          Tus sitios
        </h1>
        <p className='mt-2 max-w-prose text-body-md text-muted-foreground'>
          Cambia de panel o registra otro sitio con la misma cuenta.
        </p>
      </header>

      {venues.length > 0 ? (
        <ul className='flex flex-col gap-3'>
          {venues.map((venue) => {
            const active = venue.slug === slug
            return (
              <li
                key={venue.slug}
                className={cn(
                  'flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4',
                  active ? 'border-lime' : 'border-border'
                )}
              >
                <div className='flex min-w-0 items-center gap-3'>
                  <Building2Icon className={cn('size-5 shrink-0', active && 'text-lime')} />
                  <div className='min-w-0'>
                    <p className='truncate font-display font-bold uppercase'>{venue.nombre}</p>
                    <p className='text-muted-foreground text-sm'>
                      {active
                        ? 'Estás en este panel'
                        : venue.role === 'owner'
                          ? 'Eres dueño'
                          : 'Equipo'}
                    </p>
                  </div>
                </div>
                <div className='flex flex-wrap gap-2'>
                  <Link
                    href={`/panel/${venue.slug}`}
                    className='rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:border-primary'
                  >
                    Abrir panel
                  </Link>
                  {active ? (
                    <Link
                      href={`/panel/${venue.slug}/sitio`}
                      className='rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:border-primary'
                    >
                      Editar perfil
                    </Link>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className='rounded-xl border border-border border-dashed p-6 text-muted-foreground'>
          Entra por Operación para administrar los sitios de la red.
        </p>
      )}

      {!access.esPlataforma ? (
        <section className='border-border border-t pt-6'>
          <h2 className='font-display font-bold text-xl uppercase'>¿Tienes otro sitio?</h2>
          <p className='mt-2 max-w-prose text-body-md text-muted-foreground'>
            Manda los cuatro datos básicos. Operación confirma el Instagram y el correo antes de
            sumarlo a tu panel.
          </p>
          <Link
            href='/registrar-sitio'
            className='mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-display text-label-lg text-primary-foreground uppercase transition-opacity hover:opacity-90'
          >
            <PlusIcon className='size-4' />
            Registrar otro sitio
          </Link>
        </section>
      ) : null}
    </div>
  )
}
