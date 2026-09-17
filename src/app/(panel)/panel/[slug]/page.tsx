import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { getVenueForPanel, requireVenueAccess } from '@/lib/auth/venue-access'

export const dynamic = 'force-dynamic'

const STATUS_TEXT: Record<string, string> = {
  draft: 'En borrador — todavía no se ve en el mapa',
  published: 'Publicado — se ve en el mapa',
  paused: 'En pausa — no se ve en el mapa',
  archived: 'Archivado',
}

/**
 * The venue's home, and it is NOT the same home for everybody.
 *
 * STAFF NEVER SEE THIS PAGE. Whoever tends the bar goes straight to the
 * scanner, because that is the entire job: someone is standing at the counter
 * holding up a QR. This summary is about the venue's profile, its status on the
 * map and its team — owner work, done sitting down and during the day. Landing
 * a waiter on "Nombre, dirección, contacto" with no mention of scanning is what
 * made the panel unreadable for them: the one screen they need was behind a
 * collapsed sidebar on a phone.
 *
 * The owner keeps the summary, but the scanner leads it. An owner covers the
 * bar on a busy night too, and a card is cheaper than remembering where it is.
 */
export default async function PanelSummaryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const venue = await getVenueForPanel(slug)
  if (!venue) notFound()

  const access = await requireVenueAccess(venue.id, `/panel/${slug}`)
  const isOwner = access.esPlataforma || access.role === 'owner'

  if (!isOwner) redirect(`/panel/${slug}/escanear`)

  return (
    <div className='flex flex-col gap-8'>
      <header>
        <h1 className='font-display font-black text-3xl uppercase leading-none tracking-tighter'>
          {venue.nombre}
        </h1>
        <p className='mt-2 text-body-md text-muted-foreground'>
          {STATUS_TEXT[venue.status] ?? venue.status}
        </p>
      </header>

      {/* Whether a venue is published is the platform's call, not the venue's.
          Saying it here heads off the obvious question of why there is no
          button. */}
      {venue.status !== 'published' ? (
        <p className='rounded-xl border border-primary border-dashed p-4 text-body-md text-muted-foreground'>
          Mientras el sitio esté en borrador no aparece en el mapa. Lo publicamos nosotros cuando
          confirmamos el compromiso contigo; mientras tanto puedes ir dejando el perfil listo.
        </p>
      ) : null}

      {/* Scanning is the only thing here that happens with someone waiting, so
          it is the only thing that gets the loud treatment. */}
      <Link
        href={`/panel/${slug}/escanear`}
        className='rounded-xl border-2 border-lime bg-card p-6 transition-opacity hover:opacity-80'
      >
        <p className='font-display font-black text-2xl text-lime uppercase tracking-tighter'>
          Escanear un trago
        </p>
        <p className='mt-1 text-body-md text-muted-foreground'>
          Abre la cámara para entregar un pedido. Es lo que se hace con alguien esperando en la
          barra.
        </p>
      </Link>

      <nav className='grid gap-3 sm:grid-cols-2'>
        <Card
          href={`/panel/${slug}/carta`}
          title='La carta'
          text='Los tragos que la gente puede pedir y pagar desde tu perfil.'
        />
        <Card
          href={`/panel/${slug}/cuenta`}
          title='La cuenta'
          text='Lo que nos debes o te debemos, y las liquidaciones que ya se hicieron.'
        />
        <Card
          href={`/panel/${slug}/sitio`}
          title='El sitio'
          text='Nombre, dirección, contacto y el compromiso que aparece en tu perfil.'
        />
        <Card
          href={`/panel/${slug}/equipo`}
          title='Equipo'
          text='Invita a tu gente por correo para que no tengas que hacerlo todo tú.'
        />
      </nav>

      {venue.status === 'published' ? (
        <Link
          href={`/sitios/${slug}`}
          className='font-display text-label-lg text-primary-text uppercase hover:underline'
        >
          Ver cómo se ve tu perfil →
        </Link>
      ) : null}
    </div>
  )
}

function Card({ href, title, text }: { href: string; title: string; text: string }) {
  return (
    <Link
      href={href}
      className='rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary'
    >
      <p className='font-display font-bold text-headline-md uppercase'>{title}</p>
      <p className='mt-1 text-body-md text-muted-foreground'>{text}</p>
    </Link>
  )
}
