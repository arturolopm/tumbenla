import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PledgeDetail } from '@/components/sitios/pledge-badge'
import { getVenueBySlug, listPublishedVenueSlugs } from '@/lib/venues/queries'
import { generateMetadata as buildMetadata } from '@/lib/seo'
import { pledgeLabel } from '@/components/sitios/pledge-badge'

export const revalidate = 300

/**
 * Do NOT add a loading.tsx to this segment or to sitios/ above it.
 *
 * loading.tsx creates a Suspense boundary covering the segment AND its
 * children, and once Next starts streaming a response the HTTP status is
 * already committed as 200. notFound() would still render the correct
 * not-found UI, but it could no longer set the status, so every unpublished or
 * missing venue would answer 200 and be indexable. Verified: with a loading.tsx
 * present this route returned 200 for a draft venue; without it, 404.
 *
 * If a skeleton is ever wanted here, put a <Suspense> inside the page body
 * around the slow part only, never a route-level loading.tsx.
 */

const TYPE_LABEL: Record<string, string> = {
  bar: 'Bar',
  discoteca: 'Discoteca',
  club: 'Club',
  terraza: 'Terraza',
  restobar: 'Restobar',
  billar: 'Billar',
}

export async function generateStaticParams() {
  const slugs = await listPublishedVenueSlugs()
  return slugs.map(({ slug }) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const venue = await getVenueBySlug(slug)

  if (!venue) notFound()

  return buildMetadata({
    title: `${venue.name}, ${venue.city}`,
    description: `${venue.name} pone ${pledgeLabel(venue.pledge)} en material de construccion.`,
    canonical: `/sitios/${venue.slug}`,
  })
}

export default async function VenuePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const venue = await getVenueBySlug(slug)

  if (!venue) notFound()

  const contactLinks = [
    venue.instagram
      ? {
          label: `@${venue.instagram}`,
          href: `https://instagram.com/${venue.instagram}`,
        }
      : null,
    venue.whatsapp
      ? {
          label: 'WhatsApp',
          href: `https://wa.me/${venue.whatsapp.replace(/\D/g, '')}`,
        }
      : null,
    venue.website ? { label: 'Sitio web', href: venue.website } : null,
    venue.phone ? { label: venue.phone, href: `tel:${venue.phone}` } : null,
  ].filter(Boolean) as { label: string; href: string }[]

  // Deep link straight into the phone's map app rather than embedding a second
  // map on a page that already has the address.
  const directionsHref = `https://www.openstreetmap.org/?mlat=${venue.lat}&mlon=${venue.lng}#map=18/${venue.lat}/${venue.lng}`

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <Link
        href="/sitios"
        className="text-muted-foreground text-sm hover:text-foreground"
      >
        Volver a los sitios
      </Link>

      <header className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-sm">
            {TYPE_LABEL[venue.type] ?? venue.type}
            {venue.neighborhood ? ` en ${venue.neighborhood}` : ''}
            {`, ${venue.city}`}
          </p>
          <h1 className="text-balance font-semibold text-4xl tracking-tight">{venue.name}</h1>
          {venue.tagline ? (
            <p className="text-pretty text-lg text-muted-foreground">{venue.tagline}</p>
          ) : null}
        </div>

        <PledgeDetail pledge={venue.pledge} />
      </header>

      {venue.coverImageUrl ? (
        <div className="mt-8 overflow-hidden rounded-3xl bg-muted">
          {/* Plain <img>: remote image hosts are
              not configured in next.config yet. */}
          <img src={venue.coverImageUrl} alt="" className="w-full object-cover" />
        </div>
      ) : null}

      {venue.description ? (
        <div className="mt-8 max-w-prose text-pretty leading-relaxed">{venue.description}</div>
      ) : null}

      <div className="mt-10 grid gap-8 border-border border-t pt-8 sm:grid-cols-2">
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">Donde queda</h2>
          <p className="text-muted-foreground">{venue.addressLine}</p>
          <p className="text-muted-foreground">
            {venue.neighborhood ? `${venue.neighborhood}, ` : ''}
            {venue.city}
          </p>
          <a
            href={directionsHref}
            target="_blank"
            rel="noreferrer noopener"
            className="self-start text-primary text-sm hover:underline"
          >
            Como llegar
          </a>
        </section>

        {venue.openingHours ? (
          <section className="flex flex-col gap-2">
            <h2 className="font-semibold">Cuando abren</h2>
            <p className="text-muted-foreground">{venue.openingHours}</p>
          </section>
        ) : null}

        {contactLinks.length > 0 ? (
          <section className="flex flex-col gap-2">
            <h2 className="font-semibold">Contacto</h2>
            <ul className="flex flex-col gap-1">
              {contactLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* How the commitment was checked. The product vouches for this claim
            publicly, so how it was verified belongs on the page, not in a
            database column nobody reads. */}
        {venue.verified ? (
          <section className="flex flex-col gap-2">
            <h2 className="font-semibold">Como lo confirmamos</h2>
            <p className="text-pretty text-muted-foreground">
              {venue.verifiedNote ?? 'Confirmado directamente con el sitio.'}
            </p>
          </section>
        ) : null}
      </div>

      <div className="mt-10 rounded-3xl border border-border bg-card p-6">
        <h2 className="font-semibold text-lg">Y esa plata, en que se va</h2>
        <p className="mt-2 text-pretty text-muted-foreground">
          En cemento, bloques y tejas. Publicamos el recibo de cada compra.
        </p>
        <Link
          href="/transparencia"
          className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-opacity hover:opacity-90"
        >
          Ver los recibos
        </Link>
      </div>
    </article>
  )
}
