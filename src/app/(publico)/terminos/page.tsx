import type { Metadata } from 'next'

import { getBrandConfig } from '@/config/branding'
import { generateMetadata as buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'Terminos',
  description: 'Que es Tumbenla, que hace y que no hace.',
  canonical: '/terminos',
})

export default function TerminosPage() {
  const brand = getBrandConfig()

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-balance font-semibold text-4xl tracking-tight">Terminos</h1>

      <div className="mt-6 rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm">
        Estos terminos todavia no han pasado por revision legal. Describen lo que hacemos hoy,
        de forma honesta, pero no reemplazan un documento redactado por un abogado.
      </div>

      <div className="mt-10 flex flex-col gap-8 leading-relaxed text-muted-foreground">
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold text-foreground text-xl">Que es esto</h2>
          <p className="max-w-prose text-pretty">
            Tumbenla es un directorio. Publicamos que bares y discotecas se comprometieron a
            destinar una parte de sus ventas a comprar material de construccion, y publicamos
            las compras que hacemos con esa plata.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-semibold text-foreground text-xl">Que no hacemos</h2>
          <p className="max-w-prose text-pretty">
            No procesamos pagos, no cobramos comisiones y no recibimos dinero de los
            visitantes de esta pagina. No guardamos datos de tarjetas porque no hay ningun
            cobro en el sitio.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-semibold text-foreground text-xl">Sobre los compromisos publicados</h2>
          <p className="max-w-prose text-pretty">
            El compromiso de cada sitio lo hace el sitio, no nosotros. Confirmamos cada uno
            antes de publicarlo y decimos como lo confirmamos, pero hoy no auditamos las
            ventas de nadie. Si un sitio deja de cumplir, lo quitamos de la lista.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-semibold text-foreground text-xl">Sobre el contenido</h2>
          <p className="max-w-prose text-pretty">
            Los nombres, logos y fotos de cada sitio pertenecen a cada sitio. Si eres el dueno
            y quieres que quitemos algo, escribenos y lo quitamos.
          </p>
        </section>

        {brand.supportEmail ? (
          <section className="flex flex-col gap-3">
            <h2 className="font-semibold text-foreground text-xl">Contacto</h2>
            <p>
              <a href={`mailto:${brand.supportEmail}`} className="text-primary hover:underline">
                {brand.supportEmail}
              </a>
            </p>
          </section>
        ) : null}
      </div>
    </div>
  )
}
