import Link from 'next/link'
import { notFound } from 'next/navigation'

import { getVenueForPanel, requireVenueAccess } from '@/lib/auth/venue-access'

export const dynamic = 'force-dynamic'

const ESTADO_TEXTO: Record<string, string> = {
  draft: 'En borrador — todavía no se ve en el mapa',
  published: 'Publicado — se ve en el mapa',
  paused: 'En pausa — no se ve en el mapa',
  archived: 'Archivado',
}

export default async function PanelResumenPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const sitio = await getVenueForPanel(slug)
  if (!sitio) notFound()

  const acceso = await requireVenueAccess(sitio.id, `/panel/${slug}`)
  const esDueno = acceso.esPlataforma || acceso.role === 'owner'

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-display font-black text-3xl uppercase leading-none tracking-tighter">
          {sitio.nombre}
        </h1>
        <p className="mt-2 text-body-md text-muted-foreground">
          {ESTADO_TEXTO[sitio.status] ?? sitio.status}
        </p>
      </header>

      {/* Que un sitio este publicado o no lo decide la plataforma, no el sitio.
          Decirlo aca evita la pregunta obvia de por que no hay un boton. */}
      {sitio.status !== 'published' ? (
        <p className="rounded-xl border border-primary border-dashed p-4 text-body-md text-muted-foreground">
          Mientras el sitio esté en borrador no aparece en el mapa. Lo publicamos nosotros
          cuando confirmamos el compromiso contigo; mientras tanto puedes ir dejando el perfil
          listo.
        </p>
      ) : null}

      <nav className="grid gap-3 sm:grid-cols-2">
        <Tarjeta
          href={`/panel/${slug}/sitio`}
          titulo="El sitio"
          texto="Nombre, dirección, contacto y el compromiso que aparece en tu perfil."
        />
        {esDueno ? (
          <Tarjeta
            href={`/panel/${slug}/equipo`}
            titulo="Equipo"
            texto="Invita a tu gente por correo para que no tengas que hacerlo todo tú."
          />
        ) : null}
      </nav>

      {sitio.status === 'published' ? (
        <Link
          href={`/sitios/${slug}`}
          className="font-display text-label-lg text-primary-text uppercase hover:underline"
        >
          Ver cómo se ve tu perfil →
        </Link>
      ) : null}
    </div>
  )
}

function Tarjeta({ href, titulo, texto }: { href: string; titulo: string; texto: string }) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary"
    >
      <p className="font-display font-bold text-headline-md uppercase">{titulo}</p>
      <p className="mt-1 text-body-md text-muted-foreground">{texto}</p>
    </Link>
  )
}
