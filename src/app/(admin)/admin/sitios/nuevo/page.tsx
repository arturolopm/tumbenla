import { notFound } from 'next/navigation'

import { VenueForm } from '@/components/admin/venue-form'
import { urlInstagram } from '@/config/contacto'
import { getApplication } from '@/lib/venues/claims'

/**
 * Crear un sitio, a mano o aprobando una solicitud.
 *
 * Con ?solicitud=<id> el formulario llega prellenado con lo que el sitio ya
 * dijo, y guardar cierra la solicitud junto con el sitio. Si ya hay una cuenta
 * que verificó el mismo correo, recibe el panel en esa transacción; si no, lo
 * reclama cuando verifique ese correo después de la aprobación.
 */
export const dynamic = 'force-dynamic'

export default async function NuevoSitioPage({
  searchParams,
}: {
  searchParams: Promise<{ solicitud?: string }>
}) {
  const { solicitud: solicitudId } = await searchParams
  const solicitud = solicitudId ? await getApplication(solicitudId) : null

  if (solicitudId && !solicitud) notFound()

  return (
    <div className='flex flex-col gap-6'>
      <div>
        <h1 className='font-display font-extrabold text-3xl'>
          {solicitud ? `Aprobar ${solicitud.name}` : 'Agregar un sitio'}
        </h1>
        <p className='text-muted-foreground text-sm'>
          Queda en borrador hasta que lo pongas en publicado.
        </p>
      </div>

      {solicitud ? (
        <div className='rounded-xl border border-primary bg-primary/5 p-4'>
          <p className='font-display font-bold uppercase'>Antes de guardar</p>
          <p className='mt-1 text-body-md text-muted-foreground'>
            Confirma que te llegó el DM desde{' '}
            <a
              href={urlInstagram(solicitud.instagram)}
              target='_blank'
              rel='noopener noreferrer'
              className='text-primary-text hover:underline'
            >
              @{solicitud.instagram}
            </a>{' '}
            citando <strong className='text-street-white'>{solicitud.contactEmail}</strong>.
          </p>
          <p className='mt-2 text-body-md text-muted-foreground'>
            Falta lo que la solicitud no pide:{' '}
            <strong className='text-street-white'>
              el tipo, la dirección y el punto en el mapa
            </strong>
            . Sácalos del Instagram del bar, que es donde ya estás mirando para verificar el DM. Al
            guardar, el sitio queda creado. Si esa persona ya verificó el correo citado, recibe el
            panel de una; si no, el correo de aprobación le explica cómo reclamarlo sin invitación.
          </p>
        </div>
      ) : null}

      <VenueForm
        prefill={
          solicitud
            ? {
                solicitudId: solicitud.id,
                name: solicitud.name,
                type: solicitud.type,
                city: solicitud.city,
                addressLine: solicitud.addressLine,
                neighborhood: solicitud.neighborhood,
                instagram: solicitud.instagram,
                tiktok: solicitud.tiktok,
                email: solicitud.contactEmail,
                whatsapp: solicitud.whatsapp,
                phone: solicitud.phone,
                website: solicitud.website,
                openingHours: solicitud.openingHours,
                description: solicitud.description,
              }
            : undefined
        }
      />
    </div>
  )
}
