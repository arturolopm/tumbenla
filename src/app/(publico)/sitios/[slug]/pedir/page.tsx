import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

import { OrderCheckout } from '@/components/commerce/order-checkout'
import { auth } from '@/lib/auth/auth'
import { listarCartaPublica } from '@/lib/comercio/queries'
import { getVenueBySlug } from '@/lib/venues/queries'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ producto?: string | string[] }>
}) {
  const { slug } = await params
  const venue = await getVenueBySlug(slug)
  if (!venue) notFound()

  const requestHeaders = await headers()
  const [catalog, session, query] = await Promise.all([
    listarCartaPublica(venue.id),
    auth.api.getSession({ headers: requestHeaders }),
    searchParams,
  ])
  const seedProductSlug =
    typeof query.producto === 'string' && query.producto.length > 0 ? query.producto : null

  return (
    <div className='mx-auto max-w-2xl px-margin-mobile py-10 lg:px-margin-desktop'>
      <OrderCheckout
        venueId={venue.id}
        venueSlug={venue.slug}
        venueName={venue.name}
        seedProductSlug={seedProductSlug}
        catalog={catalog.map((product) => ({
          id: product.id,
          slug: product.slug,
          name: product.nombre,
          kind: product.kind,
          description: product.descripcion,
          unitPrice: product.precio,
          unitGrossMinor: Math.round(product.precio * 100),
          donationPercentage: product.porcentajeMaterial,
          donationBasisPoints: Math.round(product.porcentajeMaterial * 100),
          donationAmount: product.material,
          venueAmount: product.sitio,
          imageUrl: product.imagenUrl,
        }))}
        accountEmail={session?.user?.email ?? ''}
        accountName={session?.user?.name ?? ''}
        isGuest={!session}
      />
    </div>
  )
}
