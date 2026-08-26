import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { BuscadorDeSitios } from '@/components/sitios/buscador-de-sitios'
import { auth } from '@/lib/auth/auth'
import { listMyVenues } from '@/lib/auth/venue-access'
import { buscarSitiosParaReclamar, listMyClaimRequests } from '@/lib/venues/claims'

/**
 * "Tengo un sitio y quiero manejarlo."
 *
 * Se busca antes de crear a proposito. La mayoria de los sitios que un dueno
 * viene a registrar YA estan cargados —los cargamos nosotros al armar el mapa—
 * y si la pagina empezara con un formulario en blanco terminariamos con el
 * mismo bar dos veces: uno con historia y otro con su dueno.
 */
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Registrar mi sitio',
  robots: { index: false, follow: false },
}

export default async function RegistrarSitioPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const [session, params] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    searchParams,
  ])

  if (!session) redirect('/login?redirectAfter=/registrar-sitio')

  const termino = (params.q ?? '').trim()
  const [resultados, misSolicitudes, misSitios] = await Promise.all([
    termino.length >= 2 ? buscarSitiosParaReclamar(termino) : Promise.resolve([]),
    listMyClaimRequests(session.user.id),
    listMyVenues(session.user.id),
  ])

  return (
    <div className="mx-auto w-full max-w-3xl px-margin-mobile py-section-gap lg:px-margin-desktop">
      <header>
        <h1 className="text-balance font-display font-black text-4xl uppercase leading-none tracking-tighter">
          Registra tu <span className="text-primary-text">sitio</span>
        </h1>
        <p className="mt-4 max-w-prose text-pretty text-body-lg text-muted-foreground">
          Busca tu bar acá primero: puede que ya esté cargado. Si lo encuentras, pídelo; si no
          está, lo registras tú.
        </p>
      </header>

      {misSitios.length > 0 ? (
        <p className="mt-6 rounded-xl border border-border p-4 text-body-md text-muted-foreground">
          Ya manejas{' '}
          {misSitios.map((sitio, i) => (
            <span key={sitio.slug}>
              {i > 0 ? ', ' : ''}
              <Link href={`/panel/${sitio.slug}`} className="text-primary-text hover:underline">
                {sitio.nombre}
              </Link>
            </span>
          ))}
          .
        </p>
      ) : null}

      <BuscadorDeSitios termino={termino} resultados={resultados} />

      <div className="mt-10 rounded-xl border border-border border-dashed p-6">
        <p className="font-display font-bold text-headline-md uppercase">¿No aparece?</p>
        <p className="mt-1 text-body-md text-muted-foreground">
          Regístralo tú. Queda en borrador, sin salir en el mapa, hasta que hablemos contigo y
          confirmemos lo que vas a poner.
        </p>
        <Link
          href="/registrar-sitio/nuevo"
          className="mt-4 inline-block rounded-xl bg-primary px-5 py-3 font-display text-label-lg text-primary-foreground uppercase transition-opacity hover:opacity-90"
        >
          Registrar un sitio nuevo
        </Link>
      </div>

      {misSolicitudes.length > 0 ? (
        <section className="mt-10">
          <h2 className="font-display font-bold text-headline-md uppercase">Tus solicitudes</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {misSolicitudes.map((solicitud) => (
              <li
                key={solicitud.id}
                className="rounded-xl border border-border bg-card p-4"
              >
                <p className="font-medium">{solicitud.venueNombre}</p>
                <p className="text-muted-foreground text-sm">
                  {solicitud.status === 'pending'
                    ? 'Pendiente de que la revisemos.'
                    : solicitud.status === 'approved'
                      ? 'Aprobada.'
                      : 'No la aprobamos.'}
                  {solicitud.reviewNote ? ` ${solicitud.reviewNote}` : ''}
                </p>
                {solicitud.status === 'approved' ? (
                  <Link
                    href={`/panel/${solicitud.venueSlug}`}
                    className="mt-2 inline-block font-display text-label-lg text-primary-text uppercase hover:underline"
                  >
                    Ir a su panel →
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
