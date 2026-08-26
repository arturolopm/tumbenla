import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PledgeDetail } from '@/components/sitios/pledge-badge'
import { VolverASitios } from '@/components/sitios/volver-a-sitios'
import { listNightsForVenue } from '@/lib/fiestas/queries'
import { getVenueBySlug, listPublishedVenueSlugs } from '@/lib/venues/queries'
import { formatCOP, formatDate } from '@/lib/utils/format'
import { getVerifiedTotal, listVerifiedContributions } from '@/lib/venues/contributions'
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
    description: `${venue.name} pone ${pledgeLabel(venue.pledge)} en material de construcción.`,
    canonical: `/sitios/${venue.slug}`,
  })
}

export default async function VenuePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const venue = await getVenueBySlug(slug)

  if (!venue) notFound()

  // Esta consulta NO depende de la sesion —solo de noches publicadas y fotos
  // habilitadas— asi que la pagina sigue siendo estatica y conserva su ISR, del
  // que depende que la base de Neon duerma. El estado "¿ya reclame esta foto?"
  // si depende de quien mira, y por eso vive en /sitios/[slug]/noches/[id],
  // que es dinamica y de bajo volumen por diseno.
  const noches = await listNightsForVenue(venue.id)

  // Solo lo VERIFICADO, y el filtro vive dentro de la consulta, no aca. Un
  // aporte que el sitio reporto y nosotros no hemos confirmado no existe para
  // el publico: publicarlo seria afirmar bajo nuestro nombre algo que no
  // comprobamos.
  const aportes = await listVerifiedContributions(venue.id)
  const totalAportado = await getVerifiedTotal(venue.id)

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
    <article className="mx-auto w-full max-w-4xl px-margin-mobile py-section-gap lg:px-margin-desktop">
      <VolverASitios />

      <header className="mt-6 flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Chip>{TYPE_LABEL[venue.type] ?? venue.type}</Chip>
            {venue.neighborhood ? <Chip>{venue.neighborhood}</Chip> : null}
            <Chip>{venue.city}</Chip>
          </div>

          <h1 className="text-balance font-display font-black text-4xl uppercase leading-none tracking-tighter sm:text-6xl">
            {venue.name}
          </h1>

          {venue.tagline ? (
            <p className="text-pretty text-body-lg text-muted-foreground">{venue.tagline}</p>
          ) : null}
        </div>

        <PledgeDetail pledge={venue.pledge} />
      </header>

      {venue.coverImageUrl ? (
        <div className="halftone-overlay relative mt-8 overflow-hidden rounded-xl border-2 border-secondary bg-muted">
          {/* Plain <img>: remote image hosts are
              not configured in next.config yet. */}
          <img src={venue.coverImageUrl} alt="" className="w-full object-cover" />
        </div>
      ) : null}

      {venue.description ? (
        <div className="mt-8 max-w-prose text-pretty text-body-md leading-relaxed">
          {venue.description}
        </div>
      ) : null}

      <div className="mt-10 grid gap-8 border-secondary border-t-2 pt-8 sm:grid-cols-2">
        <Bloque titulo="Dónde queda">
          <p className="text-body-md text-muted-foreground">{venue.addressLine}</p>
          <p className="text-body-md text-muted-foreground">
            {venue.neighborhood ? `${venue.neighborhood}, ` : ''}
            {venue.city}
          </p>
          <a
            href={directionsHref}
            target="_blank"
            rel="noreferrer noopener"
            className="self-start text-body-md text-primary-text hover:underline"
          >
            Cómo llegar
          </a>
        </Bloque>

        {venue.openingHours ? (
          <Bloque titulo="Cuando abren">
            <p className="text-body-md text-muted-foreground">{venue.openingHours}</p>
          </Bloque>
        ) : null}

        {contactLinks.length > 0 ? (
          <Bloque titulo="Contacto">
            <ul className="flex flex-col gap-1">
              {contactLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-body-md text-muted-foreground transition-colors hover:text-street-white"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </Bloque>
        ) : null}

        {/* How the commitment was checked. The product vouches for this claim
            publicly, so how it was verified belongs on the page, not in a
            database column nobody reads. */}
        {venue.verified ? (
          <Bloque titulo="Cómo lo confirmamos">
            <p className="text-pretty text-body-md text-muted-foreground">
              {venue.verifiedNote ?? 'Confirmado directamente con el sitio.'}
            </p>
          </Bloque>
        ) : null}
      </div>

      {aportes.length > 0 ? (
        <section className="mt-10 rounded-xl border border-lime p-8">
          <h2 className="font-display font-extrabold text-headline-md uppercase">
            Lo que ya entregó
          </h2>
          <p className="mt-2 font-display font-black text-4xl text-lime leading-none tabular-nums">
            {formatCOP(totalAportado.total, totalAportado.currency)}
          </p>
          {/* La atribucion no es cortesia: la cifra la reporta el sitio y la
              confirmamos nosotros, y decir las dos cosas es la diferencia entre
              un dato y una afirmacion nuestra sin respaldo. */}
          <p className="mt-3 max-w-prose text-pretty text-body-md text-muted-foreground">
            Reportado por el sitio y confirmado por nosotros. Cada entrega va con la fecha en
            que la confirmamos.
          </p>

          <ul className="mt-6 flex flex-col gap-2">
            {aportes.map((aporte) => (
              <li
                key={aporte.id}
                className="flex flex-wrap items-baseline justify-between gap-2 border-border border-t pt-2 text-body-md"
              >
                <span className="text-muted-foreground">
                  {formatDate(aporte.periodStart)} – {formatDate(aporte.periodEnd)}
                </span>
                <span className="tabular-nums">
                  {formatCOP(Number.parseFloat(aporte.amount), aporte.currency)}
                </span>
                {aporte.purchaseSlug ? (
                  <Link
                    href={`/transparencia/${aporte.purchaseSlug}`}
                    className="w-full text-primary-text text-sm hover:underline sm:w-auto"
                  >
                    Se fue en {aporte.purchaseTitle} →
                  </Link>
                ) : (
                  <span className="w-full text-muted-foreground text-sm sm:w-auto">
                    Todavía sin gastar
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {noches.length > 0 ? (
        <section className="mt-10">
          <h2 className="font-display font-extrabold text-headline-md uppercase">
            Las noches
          </h2>
          <p className="mt-2 max-w-prose text-pretty text-body-md text-muted-foreground">
            Si saliste acá, búscate. Guardar tus fotos es lo que hace que esa noche cuente en
            tu historia.
          </p>

          <ul className="mt-6 flex flex-col gap-2">
            {noches.map((noche) => (
              <li key={noche.id}>
                <Link
                  href={`/sitios/${venue.slug}/noches/${noche.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary"
                >
                  <span className="min-w-0">
                    <span className="block font-display font-bold uppercase">
                      {noche.title || formatDate(noche.happenedAt)}
                    </span>
                    <span className="block text-muted-foreground text-sm">
                      {formatDate(noche.happenedAt)}
                    </span>
                  </span>
                  <span className="shrink-0 text-muted-foreground text-sm">
                    {noche.photoCount} {noche.photoCount === 1 ? 'foto' : 'fotos'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-10 rounded-xl border-2 border-primary bg-primary/5 p-8">
        <h2 className="font-display font-extrabold text-headline-md uppercase">
          Y esa plata, en qué se va
        </h2>
        <p className="mt-2 text-pretty text-body-md text-muted-foreground">
          En cemento, bloques y tejas. Publicamos el recibo de cada compra.
        </p>
        <Link
          href="/transparencia"
          className="mt-6 inline-block rounded-xl bg-primary px-5 py-3 font-display text-label-lg text-primary-foreground uppercase transition-opacity hover:opacity-90"
        >
          Ver los recibos
        </Link>
      </div>
    </article>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded border border-secondary px-2 py-1 font-display text-label-sm text-muted-foreground">
      {children}
    </span>
  )
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-label-lg text-lime uppercase tracking-widest">
        {titulo}
      </h2>
      {children}
    </section>
  )
}
