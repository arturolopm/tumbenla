import type { Metadata } from 'next'
import Link from 'next/link'

import { generateMetadata as buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'Cómo funciona',
  description:
    'Por qué existe Tumbenla, cómo se pide el trago y dónde se comprueban las compras de material.',
  canonical: '/como-funciona',
})

/** Why, how and what for the person going out. Venue acquisition lives in /registrar-sitio. */
export default function NuestraCausaPage() {
  return (
    <div className='relative w-full overflow-hidden'>
      <div className='pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-destructive/10 via-background to-background' />
      <div className='pointer-events-none absolute top-[20%] -left-[10%] z-0 h-[40vw] w-[40vw] rounded-full bg-party/5 blur-3xl' />

      <section className='relative z-10 w-full px-margin-mobile pt-16 pb-section-gap lg:px-margin-desktop lg:pt-32'>
        <div className='mx-auto max-w-4xl'>
          <div className='mb-6 inline-flex items-center gap-2 rounded-full border border-secondary bg-popover px-4 py-2'>
            <span className='size-2 animate-pulse rounded-full bg-lime' />
            <span className='font-display text-label-lg text-lime uppercase tracking-widest'>
              Cómo funciona
            </span>
          </div>

          <h1 className='mb-6 text-balance font-display font-black text-4xl uppercase leading-none tracking-tighter sm:text-6xl lg:text-display'>
            La rumba puede dejar algo <span className='text-destructive'>visible</span>
          </h1>

          <p className='max-w-2xl text-pretty text-body-lg text-muted-foreground'>
            Salir sigue siendo salir. Tumbenla conecta una noche normal con material para volver a
            levantar, y deja la prueba abierta para que cualquiera la revise.
          </p>
        </div>
      </section>

      <section className='relative z-10 border-secondary border-y bg-muted px-margin-mobile py-section-gap lg:px-margin-desktop'>
        <div className='mx-auto grid max-w-5xl gap-6 md:grid-cols-3'>
          <Step number='1' title='Escoge'>
            Encuentra un sitio en el mapa y abre su carta de Tumbenla. Cada producto muestra su
            precio antes de que hagas el pedido.
          </Step>
          <Step number='2' title='Pide'>
            Ves el reparto en pesos: cuánto queda en el sitio y cuánto queda para reconstruir.
            Puedes pagar en la app o en la barra.
          </Step>
          <Step number='3' title='Comprueba'>
            El personal escanea el QR para registrar la entrega. Después puedes revisar las compras
            de material y sus facturas públicas.
          </Step>
        </div>
      </section>

      <section className='relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-12 px-margin-mobile py-section-gap lg:px-margin-desktop'>
        <Bloque titulo='Lo que queda fijado al pedir'>
          <p>
            El pedido conserva el producto, el precio y el reparto que viste. Si el sitio cambia su
            carta después, eso no reescribe tu pedido.
          </p>
          <p>
            La cifra final para reconstruir se concilia con las deducciones reales del pago. Las
            pruebas, los pedidos devueltos y los registros sin verificar no entran en los totales
            públicos.
          </p>
        </Bloque>

        <Bloque titulo='Qué verificamos'>
          <p>
            Tumbenla verifica el sitio antes de publicarlo. Un sitio aprobado publica sus propios
            productos cuando cumplen las reglas de la plataforma; no decimos que revisamos cada
            producto uno por uno.
          </p>
          <p>
            El escaneo registra la entrega. La compra de material cuenta cuando tiene evidencia
            verificada y queda publicada con su factura.
          </p>
        </Bloque>

        <Bloque titulo='Qué puedes ver'>
          <p>
            En transparencia puedes comparar cuánto está contabilizado para reconstruir, cuánto ya
            está convertido en material y cuánto sigue pendiente de una compra publicada.
          </p>
          <p>
            Las cuentas son colectivas: una compra concreta de material no se atribuye a un trago
            individual. Si una compra no tiene respaldo publicado, no la presentamos como hecha.
          </p>
          <Link href='/transparencia' className='text-primary-text hover:underline'>
            Ver las compras y sus facturas
          </Link>
        </Bloque>

        <Link
          href='/sitios'
          className='inline-block self-start rounded-xl bg-primary px-5 py-3 font-display text-label-lg text-primary-foreground uppercase transition-opacity hover:opacity-90'
        >
          Ver dónde salir
        </Link>
      </section>
    </div>
  )
}

function Step({
  number,
  title,
  children,
}: {
  number: string
  title: string
  children: React.ReactNode
}) {
  return (
    <article className='rounded-xl border border-secondary bg-card p-8'>
      <p className='font-display font-black text-5xl text-lime leading-none'>{number}</p>
      <h2 className='mt-6 font-display font-extrabold text-headline-md uppercase'>{title}</h2>
      <p className='mt-3 text-pretty text-body-md text-muted-foreground'>{children}</p>
    </article>
  )
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className='flex flex-col gap-4'>
      <h2 className='font-display font-extrabold text-headline-md uppercase'>{titulo}</h2>
      <div className='flex flex-col gap-4 text-pretty text-body-md text-muted-foreground leading-relaxed'>
        {children}
      </div>
    </section>
  )
}
