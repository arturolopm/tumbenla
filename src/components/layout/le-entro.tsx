import { BeerIcon, StoreIcon } from 'lucide-react'
import Link from 'next/link'

/**
 * La bifurcacion del producto.
 *
 * Hasta aca todo el sitio le habla a una sola persona. Este bloque es donde se
 * separan las dos que existen de verdad: quien sale de rumba y quiere ver que
 * su plata llego a algun lado, y quien tiene un bar y quiere entrar a la red.
 * Antes las dos compartian un unico CTA "Quiero poner", que en la practica solo
 * le servia a la segunda.
 *
 * Las dos tarjetas tienen el mismo peso visual a proposito. La red no existe
 * sin ninguno de los dos lados.
 */
export function LeEntro() {
  return (
    <section
      id="le-entro"
      className="relative w-full scroll-mt-24 border-secondary border-y bg-surface-container-lowest px-margin-mobile py-section-gap lg:px-margin-desktop"
    >
      <div className="mx-auto max-w-5xl">
        <div className="max-w-2xl">
          <h2 className="font-display font-black text-4xl uppercase leading-none tracking-tighter sm:text-headline-lg">
            Le <span className="text-lime">entro</span>
          </h2>
          <p className="mt-4 text-body-lg text-muted-foreground">
            Hay dos maneras de estar en esto. Escoge la tuya.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <article className="group flex flex-col rounded-xl border-2 border-secondary bg-card p-8 transition-colors hover:border-lime">
            <div className="mb-6 flex size-14 items-center justify-center rounded-full bg-lime text-background">
              <BeerIcon className="size-7" />
            </div>

            <h3 className="font-display font-bold text-headline-md uppercase">Salgo de rumba</h3>
            <p className="mt-3 flex-1 text-pretty text-body-md text-muted-foreground">
              Sales a los sitios de la red como sales siempre. Guardas las fotos de tus noches,
              y ves cuánto pusieron esas noches en material. Sin donar aparte y sin cuotas.
            </p>

            <Link
              href="/sitios"
              className="mt-8 inline-block self-start rounded-xl bg-lime px-5 py-3 font-display text-background text-label-lg uppercase transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-street-white"
            >
              Ver dónde salir
            </Link>
          </article>

          <article className="group flex flex-col rounded-xl border-2 border-secondary bg-card p-8 transition-colors hover:border-primary">
            <div className="mb-6 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <StoreIcon className="size-7" />
            </div>

            <h3 className="font-display font-bold text-headline-md uppercase">Tengo un sitio</h3>
            <p className="mt-3 flex-1 text-pretty text-body-md text-muted-foreground">
              Tú decides cuánto pones y sobre qué: un porcentaje de la noche, o una plata fija
              por trago. Lo dejamos por escrito, publicamos tu sitio en el mapa, y cada compra
              queda con su factura.
            </p>

            <Link
              href="/registrar-sitio"
              className="mt-8 inline-block self-start rounded-xl bg-primary px-5 py-3 font-display text-label-lg text-primary-foreground uppercase transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
            >
              Quiero poner
            </Link>
          </article>
        </div>
      </div>
    </section>
  )
}
