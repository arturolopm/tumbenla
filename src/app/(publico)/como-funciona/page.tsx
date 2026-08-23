import type { Metadata } from 'next'
import Link from 'next/link'

import { getBrandConfig } from '@/config/branding'
import { generateMetadata as buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'Como funciona',
  description:
    'Como escogemos los sitios, como confirmamos lo que prometen, y como publicamos en que se fue la plata.',
  canonical: '/como-funciona',
})

export default function ComoFuncionaPage() {
  const brand = getBrandConfig()

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-balance font-semibold text-4xl tracking-tight">Como funciona</h1>
      <p className="mt-3 max-w-xl text-pretty text-lg text-muted-foreground">
        Sin vueltas: quien pone, cuanto pone, y en que se gasto.
      </p>

      <section className="mt-12 flex flex-col gap-4">
        <h2 className="font-semibold text-2xl">Para el que sale</h2>
        <p className="max-w-prose text-pretty leading-relaxed text-muted-foreground">
          Entras a la lista de sitios, escoges uno y vas. Ya esta. No tienes que donar nada
          aparte ni registrarte: el sitio pone su parte de lo que vendio esa noche.
        </p>
        <p className="max-w-prose text-pretty leading-relaxed text-muted-foreground">
          Cada tarjeta dice exactamente cuanto pone ese sitio. Unos ponen un porcentaje de la
          noche, otros una plata fija por cada trago o botella.
        </p>
      </section>

      <section className="mt-12 flex flex-col gap-4">
        <h2 className="font-semibold text-2xl">Como confirmamos lo que dicen</h2>
        <p className="max-w-prose text-pretty leading-relaxed text-muted-foreground">
          Hablamos con cada sitio antes de publicarlo y dejamos escrito como lo confirmamos.
          Eso aparece en la pagina del sitio, en la seccion Como lo confirmamos.
        </p>
        <p className="max-w-prose text-pretty leading-relaxed text-muted-foreground">
          Somos honestos con el limite: hoy verificamos el compromiso, no cada peso. La
          verificacion automatica de cuanto entrego cada sitio es lo siguiente que vamos a
          construir, y cuando este lista lo vas a ver aca.
        </p>
      </section>

      <section className="mt-12 flex flex-col gap-4">
        <h2 className="font-semibold text-2xl">Que pasa con la plata</h2>
        <p className="max-w-prose text-pretty leading-relaxed text-muted-foreground">
          La plata no pasa por esta pagina. No cobramos, no procesamos pagos y no guardamos
          tarjetas. Los sitios entregan su parte y nosotros compramos el material de
          construccion.
        </p>
        <p className="max-w-prose text-pretty leading-relaxed text-muted-foreground">
          Cada compra queda publicada con su fecha, el detalle de lo que se compro y la
          factura. Si una compra no tiene respaldo publicado, es porque no la hemos hecho.
        </p>
        <Link
          href="/transparencia"
          className="self-start text-primary hover:underline"
        >
          Ver las compras
        </Link>
      </section>

      <section id="para-sitios" className="mt-12 scroll-mt-20 rounded-3xl border border-primary/25 bg-primary/5 p-8">
        <h2 className="font-semibold text-2xl">Si tienes un bar o una discoteca</h2>
        <p className="mt-3 max-w-prose text-pretty leading-relaxed text-muted-foreground">
          Tu decides cuanto pones y sobre que. Puede ser un porcentaje de la noche, o una
          plata fija por cerveza, por coctel o por botella. Lo unico que pedimos es que sea
          claro y que lo puedas sostener.
        </p>

        <ol className="mt-6 flex flex-col gap-3 text-muted-foreground">
          <li>1. Nos escribes y nos cuentas cuanto quieres poner.</li>
          <li>2. Lo dejamos por escrito y confirmamos los datos del sitio.</li>
          <li>3. Publicamos tu sitio en la lista y en el mapa.</li>
          <li>4. Entregas tu parte y nosotros compramos material y publicamos la factura.</li>
        </ol>

        {brand.supportEmail ? (
          <a
            href={`mailto:${brand.supportEmail}?subject=Quiero poner`}
            className="mt-6 inline-block rounded-xl bg-primary px-5 py-2.5 font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Quiero poner
          </a>
        ) : null}
      </section>
    </div>
  )
}
