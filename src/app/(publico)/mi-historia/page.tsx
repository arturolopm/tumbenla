import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { MisPedidos } from '@/components/comercio/mis-pedidos'
import { MiHistoriaGaleria } from '@/components/fiestas/mi-historia-galeria'
import { db } from '@/database'
import { auth } from '@/lib/auth/auth'
import { misPedidos } from '@/lib/comercio/queries'
import { getCustomerContributionStages } from '@/lib/commerce/transparency-service'
import { vincularPedidosDeInvitado } from '@/lib/comercio/vincular'
import { getHistorySummary, listMyClaimedPhotos } from '@/lib/fiestas/queries'
import { generateMetadata as buildMetadata } from '@/lib/seo'
import { formatCOP, formatNumber } from '@/lib/utils/format'

export const metadata: Metadata = {
  ...buildMetadata({
    title: 'Mi historia',
    description: 'Tus noches, tus fotos y lo que has puesto para reconstruir.',
    canonical: '/mi-historia',
  }),
  // Es una pagina personal. No tiene nada que hacer en un indice.
  robots: { index: false, follow: false },
}

export default async function MiHistoriaPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/login?redirectAfter=/mi-historia')

  // Antes de leer nada: amarrar los pedidos que hizo como invitado con este
  // mismo correo. Es lo que hace que "seguir como invitado" no sea un callejon
  // sin salida — y exige el correo verificado, porque el correo de un pedido lo
  // escribe cualquiera en un formulario publico.
  await vincularPedidosDeInvitado({
    id: session.user.id,
    email: session.user.email,
    emailVerified: session.user.emailVerified,
  })

  const [resumen, fotos, pedidos, aporte] = await Promise.all([
    getHistorySummary(session.user.id),
    listMyClaimedPhotos(session.user.id),
    misPedidos(session.user.id),
    getCustomerContributionStages(db, session.user.id),
  ])

  return (
    <div className='w-full px-margin-mobile py-section-gap lg:px-margin-desktop'>
      <header className='mx-auto flex max-w-5xl flex-col gap-4'>
        <p className='inline-flex w-fit items-center gap-2 rounded-full border border-secondary bg-popover px-4 py-2'>
          <span className='size-2 animate-pulse rounded-full bg-lime' />
          <span className='font-display text-label-lg text-lime uppercase tracking-widest'>
            Le entraste
          </span>
        </p>

        <h1 className='text-balance font-display font-black text-4xl uppercase leading-none tracking-tighter sm:text-6xl'>
          Mi <span className='text-primary-text'>historia</span>
        </h1>

        <p className='max-w-2xl text-pretty text-body-lg text-muted-foreground'>
          Las noches que has salido en la red y lo que tus pedidos han puesto para reconstruir.
        </p>
      </header>

      {/* La condicion mira TAMBIEN los pedidos. Con solo `nights === 0`, quien
          acaba de crear su cuenta para guardar el trago que compro hace un
          minuto entraba aca y leia "todavia no tienes nada" — justo despues de
          que le prometimos lo contrario. */}
      {resumen.nights === 0 && pedidos.length === 0 ? (
        <div className='mx-auto mt-12 max-w-5xl rounded-xl border border-border border-dashed p-8'>
          <p className='font-display font-bold text-headline-md uppercase'>
            Todavía no tienes noches guardadas.
          </p>
          <p className='mt-2 text-body-md text-muted-foreground'>
            Pide algo de la carta de un sitio, o busca tus fotos cuando subamos las de esa noche.
            Las dos cosas suman a tu historia.
          </p>
          <Link
            href='/sitios'
            className='mt-6 inline-block rounded-xl bg-primary px-5 py-3 font-display text-label-lg text-primary-foreground uppercase transition-opacity hover:opacity-90'
          >
            Ver el mapa
          </Link>
        </div>
      ) : (
        <>
          <section className='mx-auto mt-12 grid max-w-5xl gap-4 sm:grid-cols-3'>
            <Dato label='Noches' valor={formatNumber(resumen.nights)} />
            <Dato label='Sitios' valor={formatNumber(resumen.venues)} />
            <Dato label='Fotos guardadas' valor={formatNumber(resumen.photos)} />
          </section>

          <section className='mx-auto mt-4 max-w-5xl rounded-xl border-2 border-primary bg-primary/5 p-8'>
            <p className='font-display text-label-lg text-muted-foreground uppercase tracking-widest'>
              Tu aporte a reconstruir
            </p>
            <div className='mt-3 grid gap-4 sm:grid-cols-2'>
              <DatoDeAporte
                label='Reparto final'
                value={formatCOP(Number(aporte.finalDonationMinor) / 100)}
              />
              <DatoDeAporte
                label='Ya transferido'
                value={formatCOP(Number(aporte.transferredMinor) / 100)}
              />
            </div>

            <p className='mt-4 max-w-prose text-pretty text-body-md text-muted-foreground'>
              El reparto final cuenta únicamente unidades entregadas con cálculo financiero
              terminado. Lo transferido exige confirmación bancaria y puede ir detrás del reparto.
            </p>

            {aporte.pendingAllocationUnits > 0 ? (
              <p className='mt-3 rounded-lg border border-border bg-card px-3 py-2 text-body-md'>
                {aporte.pendingAllocationUnits === 1
                  ? 'Tienes 1 entrega esperando reparto final.'
                  : `Tienes ${aporte.pendingAllocationUnits} entregas esperando reparto final.`}
              </p>
            ) : null}

            <Link
              href='/transparencia'
              className='mt-6 inline-block font-display text-label-lg text-primary-text uppercase tracking-widest hover:underline'
            >
              Ver en qué se fue la plata →
            </Link>
          </section>

          <MisPedidos pedidos={pedidos.map((p) => ({ ...p, fecha: p.fecha.toISOString() }))} />

          <MiHistoriaGaleria fotos={fotos} />
        </>
      )}
    </div>
  )
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div className='rounded-xl border border-border bg-card p-6'>
      <p className='font-display text-label-sm text-muted-foreground uppercase tracking-widest'>
        {label}
      </p>
      <p className='mt-1 font-display font-black text-4xl tabular-nums'>{valor}</p>
    </div>
  )
}

function DatoDeAporte({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className='font-display text-label-sm text-muted-foreground uppercase tracking-widest'>
        {label}
      </p>
      <p className='mt-1 font-display font-black text-3xl text-primary-text tabular-nums'>
        {value}
      </p>
    </div>
  )
}
