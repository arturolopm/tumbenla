import { notFound } from 'next/navigation'

import { CartaPanel } from '@/components/panel/carta-panel'
import { getVenueForPanel, requireVenueAccess } from '@/lib/auth/venue-access'
import { contarOrdenesPorProducto, listarCartaDelPanel } from '@/lib/comercio/queries'

export const dynamic = 'force-dynamic'

export default async function CartaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const sitio = await getVenueForPanel(slug)
  if (!sitio) notFound()

  await requireVenueAccess(sitio.id, `/panel/${slug}/carta`)

  const [productos, ordenes] = await Promise.all([
    listarCartaDelPanel(sitio.id),
    contarOrdenesPorProducto(sitio.id),
  ])

  return (
    <div className='flex max-w-3xl flex-col gap-8'>
      <header>
        <h1 className='font-display font-black text-3xl uppercase leading-none tracking-tighter'>
          La carta
        </h1>
        <p className='mt-2 max-w-prose text-body-md text-muted-foreground'>
          Lo que vendes con una parte que se va en material. Puede ser un cóctel que te inventes o
          algo que ya tengas: una cerveza, un combo, una botella. Tú pones el precio y cuánto se va
          en material; nosotros lo revisamos antes de que se pueda pedir.
        </p>
      </header>

      <CartaPanel
        venueId={sitio.id}
        productos={productos.map((p) => ({ ...p, creadoEn: p.creadoEn.toISOString() }))}
        ordenesPorProducto={ordenes}
      />
    </div>
  )
}
