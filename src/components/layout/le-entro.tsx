import { StoreIcon } from 'lucide-react'
import Link from 'next/link'

/** Owner entry kept separate from the rumbero journey on the public landing page. */
export function LeEntro() {
  return (
    <section
      id='le-entro'
      className='relative w-full scroll-mt-24 border-secondary border-y bg-surface-container-lowest px-margin-mobile py-section-gap lg:px-margin-desktop'
    >
      <div className='mx-auto max-w-5xl'>
        <article className='grid gap-8 rounded-xl border-2 border-primary bg-card p-8 md:grid-cols-[auto_1fr_auto] md:items-center lg:p-10'>
          <div className='flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground'>
            <StoreIcon className='size-7' />
          </div>

          <div>
            <h2 className='font-display font-black text-3xl uppercase leading-none tracking-tighter sm:text-headline-lg'>
              ¿Tienes un sitio? <span className='text-primary-text'>Mira qué ganas</span>
            </h2>
            <p className='mt-4 max-w-2xl text-pretty text-body-md text-muted-foreground'>
              Aparece en el mapa, pon un producto propio en la carta y deja prueba pública de cada
              entrega y de las compras de material. Empiezas con cuatro datos.
            </p>
          </div>

          <Link
            href='/registrar-sitio'
            className='inline-block justify-self-start rounded-xl bg-primary px-5 py-3 font-display text-label-lg text-primary-foreground uppercase transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime md:justify-self-end'
          >
            Ver cómo entrar
          </Link>
        </article>
      </div>
    </section>
  )
}
