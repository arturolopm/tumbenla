import { notFound } from 'next/navigation'

import { VenueForm } from '@/components/admin/venue-form'
import { getVenueForPanel, requireVenueAccess } from '@/lib/auth/venue-access'
import { getVenueById } from '@/lib/venues/queries'

export const dynamic = 'force-dynamic'

export default async function PanelSitioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const cabecera = await getVenueForPanel(slug)
  if (!cabecera) notFound()

  await requireVenueAccess(cabecera.id, `/panel/${slug}/sitio`, ['owner'])

  const sitio = await getVenueById(cabecera.id)
  if (!sitio) notFound()

  return (
    <div className='flex flex-col gap-8'>
      <header>
        <h1 className='font-display font-black text-3xl uppercase leading-none tracking-tighter'>
          El sitio
        </h1>
        <p className='mt-2 max-w-prose text-body-md text-muted-foreground'>
          Esto es lo que ve la gente en tu perfil. El compromiso que declares acá es el que aparece
          en el mapa, así que cámbialo solo si de verdad cambió.
        </p>
      </header>

      <VenueForm venue={sitio} modo='panel' onSuccessHref={`/panel/${slug}/sitio`} />
    </div>
  )
}
