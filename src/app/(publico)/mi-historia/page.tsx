import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { MiHistoriaGaleria } from '@/components/fiestas/mi-historia-galeria'
import { auth } from '@/lib/auth/auth'
import { getHistorySummary, listMyClaimedPhotos } from '@/lib/fiestas/queries'
import { generateMetadata as buildMetadata } from '@/lib/seo'
import { formatCOP, formatNumber } from '@/lib/utils/format'

export const metadata: Metadata = {
  ...buildMetadata({
    title: 'Mi historia',
    description: 'Tus noches, tus fotos y tu aporte estimado.',
    canonical: '/mi-historia',
  }),
  // Es una pagina personal. No tiene nada que hacer en un indice.
  robots: { index: false, follow: false },
}

export default async function MiHistoriaPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/login?redirectAfter=/mi-historia')

  const [resumen, fotos] = await Promise.all([
    getHistorySummary(session.user.id),
    listMyClaimedPhotos(session.user.id),
  ])

  return (
    <div className="w-full px-margin-mobile py-section-gap lg:px-margin-desktop">
      <header className="mx-auto flex max-w-5xl flex-col gap-4">
        <p className="inline-flex w-fit items-center gap-2 rounded-full border border-secondary bg-popover px-4 py-2">
          <span className="size-2 animate-pulse rounded-full bg-lime" />
          <span className="font-display text-label-lg text-lime uppercase tracking-widest">
            Le entraste
          </span>
        </p>

        <h1 className="text-balance font-display font-black text-4xl uppercase leading-none tracking-tighter sm:text-6xl">
          Mi <span className="text-primary-text">historia</span>
        </h1>

        <p className="max-w-2xl text-pretty text-body-lg text-muted-foreground">
          Las noches que has salido en la red, y lo que esas noches pusieron en material.
        </p>
      </header>

      {resumen.nights === 0 ? (
        <div className="mx-auto mt-12 max-w-5xl rounded-xl border border-border border-dashed p-8">
          <p className="font-display font-bold text-headline-md uppercase">
            Todavia no tienes noches guardadas.
          </p>
          <p className="mt-2 text-body-md text-muted-foreground">
            Cuando salgas a uno de los sitios de la red y subamos las fotos de esa noche,
            entras aca, buscas las tuyas y las guardas. Cada noche que guardes suma a tu
            historia.
          </p>
          <Link
            href="/sitios"
            className="mt-6 inline-block rounded-xl bg-primary px-5 py-3 font-display text-label-lg text-primary-foreground uppercase transition-opacity hover:opacity-90"
          >
            Ver el mapa
          </Link>
        </div>
      ) : (
        <>
          <section className="mx-auto mt-12 grid max-w-5xl gap-4 sm:grid-cols-3">
            <Dato label="Noches" valor={formatNumber(resumen.nights)} />
            <Dato label="Sitios" valor={formatNumber(resumen.venues)} />
            <Dato label="Fotos guardadas" valor={formatNumber(resumen.photos)} />
          </section>

          <section className="mx-auto mt-4 max-w-5xl rounded-xl border-2 border-primary bg-primary/5 p-8">
            <p className="font-display text-label-lg text-muted-foreground uppercase tracking-widest">
              Aporte estimado
            </p>
            <p className="mt-2 font-display font-black text-5xl text-primary-text leading-none tabular-nums">
              {formatCOP(resumen.estimatedAmount, resumen.currency)}
            </p>

            {/* La honestidad de esta cifra es el producto. Se dice como se
                calcula, ahi mismo, sin obligar a nadie a buscarlo. */}
            <p className="mt-4 max-w-prose text-pretty text-body-md text-muted-foreground">
              Es un <strong className="text-street-white">estimado</strong>, no un recibo. Sale
              de multiplicar cada noche que guardaste por lo que ese sitio declara poner por
              persona. Todavia no medimos lo que consumiste tu.
              {resumen.estimateIsPartial ? (
                <>
                  {' '}
                  Ademas se queda corto:{' '}
                  <strong className="text-street-white">
                    {resumen.nightsWithoutEstimate === 1
                      ? '1 noche fue en un sitio'
                      : `${resumen.nightsWithoutEstimate} noches fueron en sitios`}
                  </strong>{' '}
                  que todavia no declara cuanto pone por persona, asi que no suma aca.
                </>
              ) : null}
            </p>

            <Link
              href="/transparencia"
              className="mt-6 inline-block font-display text-label-lg text-primary-text uppercase tracking-widest hover:underline"
            >
              Ver en que se fue la plata →
            </Link>
          </section>

          <MiHistoriaGaleria fotos={fotos} />
        </>
      )}
    </div>
  )
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <p className="font-display text-label-sm text-muted-foreground uppercase tracking-widest">
        {label}
      </p>
      <p className="mt-1 font-display font-black text-4xl tabular-nums">{valor}</p>
    </div>
  )
}
