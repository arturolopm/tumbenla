import { headers } from 'next/headers';
import Link from 'next/link';

import { AltaDeSitio } from '@/components/sitios/alta-de-sitio';
import { auth } from '@/lib/auth/auth';
import { listMyVenues } from '@/lib/auth/venue-access';
import {
  buscarSitiosParaReclamar,
  getLiveApplication,
  listMyApplications,
} from '@/lib/venues/claims';

/**
 * Search before creating: many venues already exist in the map. The search avoids duplicates but
 * never blocks the four-field application when there is no match.
 */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Registrar mi sitio',
  robots: { index: false, follow: false },
};

export default async function RegistrarSitioPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [session, params] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    searchParams,
  ]);

  // No session gate (decision 35). Account-dependent states are simply skipped for visitors.
  const termino = (params.q ?? '').trim();
  const [resultados, viva, historial, misSitios] = await Promise.all([
    termino.length >= 2 ? buscarSitiosParaReclamar(termino) : Promise.resolve([]),
    session ? getLiveApplication(session.user.id) : Promise.resolve(null),
    session ? listMyApplications(session.user.id) : Promise.resolve([]),
    session ? listMyVenues(session.user.id) : Promise.resolve([]),
  ]);

  const resueltas = historial.filter((s) => s.status === 'approved' || s.status === 'rejected');
  const isNewVisitor = !viva && historial.length === 0 && misSitios.length === 0;

  return (
    <div className='mx-auto w-full max-w-3xl px-margin-mobile py-section-gap lg:px-margin-desktop'>
      {isNewVisitor ? (
        <header>
          <p className='font-display text-label-lg text-lime uppercase tracking-widest'>
            Para bares y discotecas
          </p>
          <h1 className='mt-4 text-balance font-display font-black text-4xl uppercase leading-none tracking-tighter sm:text-6xl'>
            Que te vean. <span className='text-primary-text'>Que se sepa que cumpliste.</span>
          </h1>
          <p className='mt-6 max-w-2xl text-pretty text-body-lg text-muted-foreground'>
            Tumbenla le da a tu sitio una forma visible de participar: un producto propio, cada
            entrega registrada y las compras de material abiertas para todos.
          </p>

          <section
            className='mt-10 grid gap-4 sm:grid-cols-2'
            aria-labelledby='beneficios-title'
          >
            <h2
              id='beneficios-title'
              className='sr-only'
            >
              Qué gana tu sitio
            </h2>
            {[
              ['Visibilidad en el mapa', 'Tu sitio aparece en la red pública de Tumbenla.'],
              ['Un producto propio', 'Tú defines qué producto pones, su precio y su reparto.'],
              ['Cada entrega registrada', 'El escaneo deja constancia de los pedidos entregados.'],
              ['Prueba pública', 'Las compras de material y sus facturas quedan abiertas.'],
            ].map(([title, body]) => (
              <article
                key={title}
                className='rounded-xl border border-border bg-card p-5'
              >
                <h3 className='font-display font-bold text-lg uppercase'>{title}</h3>
                <p className='mt-2 text-body-md text-muted-foreground'>{body}</p>
              </article>
            ))}
          </section>

          <section className='mt-10 rounded-xl border border-party/50 bg-party/5 p-6'>
            <p className='font-display text-label-sm text-party uppercase tracking-widest'>
              Capacidades en desarrollo
            </p>
            <h2 className='mt-3 font-display font-bold text-headline-md uppercase'>
              La relación no termina cuando se acaba el trago
            </h2>
            <p className='mt-3 max-w-2xl text-pretty text-body-md text-muted-foreground'>
              La primera compra puede ser el comienzo de una relación con tu sitio. Cuando estas
              herramientas estén activas y la persona lo autorice, Tumbenla podrá ayudarte a:
            </p>
            <div className='mt-6 grid gap-4 sm:grid-cols-2'>
              {[
                [
                  'Volver a hablarle a tu gente',
                  'Enviar promociones, invitaciones y novedades a quienes ya te visitaron y aceptaron recibirlas.',
                ],
                [
                  'Llenar una noche especial',
                  'Activar la red para anunciar un evento, una noche temática, un cóctel nuevo o una oferta limitada.',
                ],
                [
                  'Entender qué funciona',
                  'Ver datos agregados sobre productos, campañas y noches: qué atrae atención y qué genera otra visita.',
                ],
                [
                  'Convertir cada visita en historia',
                  'Conectar tu experiencia, el pedido y la prueba pública de donación en un relato que la gente puede comprobar.',
                ],
              ].map(([title, body]) => (
                <article
                  key={title}
                  className='rounded-lg border border-border bg-card p-4'
                >
                  <h3 className='font-display font-bold text-lg uppercase'>{title}</h3>
                  <p className='mt-2 text-body-md text-muted-foreground'>{body}</p>
                </article>
              ))}
            </div>
            <p className='mt-5 text-body-sm text-muted-foreground'>
              Las comunicaciones dependen del consentimiento de cada persona, las reglas de
              privacidad, la configuración final y el acuerdo con tu sitio.
            </p>
          </section>

          <section className='mt-10 rounded-xl border-2 border-primary bg-primary/5 p-6'>
            <h2 className='font-display font-bold text-headline-md uppercase'>Así empiezas</h2>
            <ol className='mt-4 grid gap-3 text-body-md text-muted-foreground sm:grid-cols-2'>
              <li>1. Dejas cuatro datos. No necesitas cuenta.</li>
              <li>2. Confirmamos el control del sitio por DM.</li>
              <li>3. Configuras el producto y su reparto.</li>
              <li>4. Tu equipo escanea cada entrega.</li>
            </ol>
          </section>
        </header>
      ) : (
        <header>
          <h1 className='text-balance font-display font-black text-4xl uppercase leading-none tracking-tighter'>
            Tu sitio en <span className='text-primary-text'>Tumbenla</span>
          </h1>
          <p className='mt-4 max-w-prose text-pretty text-body-lg text-muted-foreground'>
            Revisa lo que ya tienes o registra otro sitio con cuatro datos.
          </p>
        </header>
      )}

      {misSitios.length > 0 ? (
        <p className='mt-6 rounded-xl border border-border p-4 text-body-md text-muted-foreground'>
          Ya manejas{' '}
          {misSitios.map((sitio, i) => (
            <span key={sitio.slug}>
              {i > 0 ? ', ' : ''}
              <Link
                href={`/panel/${sitio.slug}`}
                className='text-primary-text hover:underline'
              >
                {sitio.nombre}
              </Link>
            </span>
          ))}
          .
        </p>
      ) : null}

      {/* A live application replaces the form to prevent duplicate submissions. */}
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
          correoDeLaCuenta={session?.user.email ?? ''}
        />
      )}

      {resueltas.length > 0 ? (
        <section className='mt-12'>
          <h2 className='font-display font-bold text-headline-md uppercase'>
            Solicitudes anteriores
          </h2>
          <ul className='mt-3 flex flex-col gap-2'>
            {resueltas.map((solicitud) => (
              <li
                key={solicitud.id}
                className='rounded-xl border border-border bg-card p-4'
              >
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
  );
}
