import type { Metadata } from 'next'

import { QuieroPonerForm } from '@/components/layout/quiero-poner-form'
import { generateMetadata as buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'Quiero poner',
  description:
    'Si tienes un bar o una discoteca, esto es lo que hay que hacer para entrar a la red.',
  canonical: '/quiero-poner',
})

export default function QuieroPonerPage() {
  return (
    <div className="w-full px-margin-mobile py-section-gap lg:px-margin-desktop">
      <header className="mx-auto flex max-w-5xl flex-col gap-4">
        <p className="inline-flex w-fit items-center gap-2 rounded-full border border-secondary bg-popover px-4 py-2">
          <span className="size-2 animate-pulse rounded-full bg-primary" />
          <span className="font-display text-label-lg text-primary-text uppercase tracking-widest">
            Para sitios
          </span>
        </p>

        <h1 className="text-balance font-display font-black text-4xl uppercase leading-none tracking-tighter sm:text-6xl">
          Quiero <span className="text-primary-text">poner</span>
        </h1>

        <p className="max-w-2xl text-pretty text-body-lg text-muted-foreground">
          Tú decides cuánto pones y sobre qué. Llena esto y te escribimos. No hay cuota de
          entrada, no cobramos comisión, y la plata nunca pasa por nosotros como pago.
        </p>
      </header>

      <div className="mx-auto mt-12 max-w-5xl">
        <QuieroPonerForm />
      </div>

      <section className="mx-auto mt-16 max-w-5xl rounded-xl border border-border p-8">
        <h2 className="font-display font-extrabold text-headline-md uppercase">
          Qué pasa después
        </h2>
        <ol className="mt-4 flex flex-col gap-3 text-body-md text-muted-foreground">
          <li>1. Te escribimos para confirmar el compromiso y los datos del sitio.</li>
          <li>2. Lo dejamos por escrito y publicamos tu sitio en el mapa.</li>
          <li>3. Entregas tu parte, compramos material y publicamos la factura.</li>
        </ol>
      </section>
    </div>
  )
}
