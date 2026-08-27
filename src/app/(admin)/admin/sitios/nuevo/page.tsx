import { notFound } from 'next/navigation'

import { VenueForm } from '@/components/admin/venue-form'
import { urlInstagram } from '@/config/contacto'
import { getApplication } from '@/lib/venues/claims'

/**
 * Crear un sitio, a mano o aprobando una solicitud.
 *
 * Con ?solicitud=<id> el formulario llega prellenado con lo que el sitio ya
 * dijo, y guardar hace las tres cosas de una: crea el sitio, mete al
 * solicitante como dueno y cierra la solicitud. Se hace asi para que no exista
 * el estado intermedio "aprobada pero sin sitio", que dejaria a alguien
 * esperando un panel que nadie va a crear.
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
            <strong className='text-street-white'>el punto en el mapa</strong> y{' '}
            <strong className='text-street-white'>el compromiso</strong>. Al guardar, el sitio queda
            creado y el panel queda a nombre de quien lo pidió.
          </p>
          {solicitud.pledgeIdea ? (
            <p className='mt-2 text-body-md text-muted-foreground'>
              Lo que tenía en mente: “{solicitud.pledgeIdea}” — es una idea suya, no un compromiso.
            </p>
          ) : null}
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
