import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { AltaDeSitio } from '@/components/sitios/alta-de-sitio'
import { auth } from '@/lib/auth/auth'
import { listMyVenues } from '@/lib/auth/venue-access'
import {
  buscarSitiosParaReclamar,
  getLiveApplication,
  listMyApplications,
} from '@/lib/venues/claims'

/**
 * "Tengo un sitio y quiero manejarlo."
 *
 * SE BUSCA ANTES DE CREAR. La mayoria de los sitios que un dueno viene a
 * registrar YA estan cargados —los cargamos nosotros al armar el mapa— y si la
 * pagina empezara con un formulario en blanco terminariamos con el mismo bar
 * dos veces: uno con historia y otro con dueno. Pero buscar no bloquea: si no
 * aparece, el formulario esta ahi mismo.
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
  const [resultados, viva, historial, misSitios] = await Promise.all([
    termino.length >= 2 ? buscarSitiosParaReclamar(termino) : Promise.resolve([]),
    getLiveApplication(session.user.id),
    listMyApplications(session.user.id),
    listMyVenues(session.user.id),
  ])

  const resueltas = historial.filter((s) => s.status === 'approved' || s.status === 'rejected')

  return (
    <div className='mx-auto w-full max-w-3xl px-margin-mobile py-section-gap lg:px-margin-desktop'>
      <header>
        <h1 className='text-balance font-display font-black text-4xl uppercase leading-none tracking-tighter'>
          Registra tu <span className='text-primary-text'>sitio</span>
        </h1>
        <p className='mt-4 max-w-prose text-pretty text-body-lg text-muted-foreground'>
          Son seis datos. Después te pedimos un mensaje desde el Instagram del sitio para confirmar
          que es tuyo, hablamos de cuánto vas a poner, y lo publicamos.
        </p>
      </header>

      {misSitios.length > 0 ? (
        <p className='mt-6 rounded-xl border border-border p-4 text-body-md text-muted-foreground'>
          Ya manejas{' '}
          {misSitios.map((sitio, i) => (
            <span key={sitio.slug}>
              {i > 0 ? ', ' : ''}
              <Link href={`/panel/${sitio.slug}`} className='text-primary-text hover:underline'>
                {sitio.nombre}
              </Link>
            </span>
          ))}
          .
        </p>
      ) : null}

      {/* Con una solicitud viva no se pinta el formulario otra vez: se le
          recuerda donde va y como terminarla. Volver a empezar de cero seria
          invitar a mandar la misma dos veces. */}
      {viva ? (
        <section className='mt-8 rounded-xl border-2 border-primary bg-primary/5 p-6'>
          <p className='font-display font-bold text-headline-md uppercase'>
            Tu solicitud para {viva.name} va en camino
          </p>
          <p className='mt-2 text-body-md text-muted-foreground'>
            {viva.status === 'verifying'
              ? 'Estamos esperando tu mensaje por Instagram.'
              : 'La estamos mirando. Te escribimos al correo que dejaste.'}
          </p>
          <Link
            href={`/registrar-sitio/enviada?id=${viva.id}`}
            className='mt-4 inline-block rounded-xl bg-primary px-5 py-3 font-display text-label-lg text-primary-foreground uppercase'
          >
            Ver qué sigue
          </Link>
        </section>
      ) : (
        <AltaDeSitio
          termino={termino}
          resultados={resultados}
          correoDeLaCuenta={session.user.email}
        />
      )}

      {resueltas.length > 0 ? (
        <section className='mt-12'>
          <h2 className='font-display font-bold text-headline-md uppercase'>
            Solicitudes anteriores
          </h2>
          <ul className='mt-3 flex flex-col gap-2'>
            {resueltas.map((solicitud) => (
              <li key={solicitud.id} className='rounded-xl border border-border bg-card p-4'>
                <p className='font-medium'>{solicitud.name}</p>
                <p className='text-muted-foreground text-sm'>
                  {solicitud.status === 'approved' ? 'Aprobada.' : 'No la aprobamos.'}
                  {solicitud.reviewNote ? ` ${solicitud.reviewNote}` : ''}
                </p>
                {solicitud.status === 'approved' && solicitud.venueSlug ? (
                  <Link
                    href={`/panel/${solicitud.venueSlug}`}
                    className='mt-2 inline-block font-display text-label-lg text-primary-text uppercase hover:underline'
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
