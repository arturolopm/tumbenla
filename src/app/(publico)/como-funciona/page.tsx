import type { Metadata } from 'next'
import Link from 'next/link'

import { generateMetadata as buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'Nuestra Causa',
  description:
    'Un trago con su precio y su reparto en pesos, una entrega con QR y las facturas del material que compramos.',
  canonical: '/como-funciona',
})

/**
 * Nuestra Causa, siguiendo la pantalla de Stitch: hero con la pastilla de
 * estado, la reja tecnica al lado, y el reparto 90/10 entre Alma y Tecnica.
 *
 * El 90/10 es una declaracion de caracter, no un reparto de plata. La plata se
 * cuenta en /transparencia con facturas, y el copy de abajo lo dice explicito
 * para que nadie lea "90% Alma" como si fuera un rubro del presupuesto.
 */
export default function NuestraCausaPage() {
  return (
    <div className="relative w-full overflow-hidden">
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top_right,var(--tw-gradient-stops))] from-destructive/10 via-background to-background" />
      <div className="pointer-events-none absolute top-[20%] -left-[10%] z-0 h-[40vw] w-[40vw] rounded-full bg-party/5 blur-3xl" />

      <section className="relative z-10 w-full px-margin-mobile pt-16 pb-section-gap lg:px-margin-desktop lg:pt-32">
        <div className="relative grid grid-cols-1 gap-gutter lg:grid-cols-12">
          <div className="relative z-20 lg:col-span-8">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-secondary bg-popover px-4 py-2">
              <span className="size-2 animate-pulse rounded-full bg-lime" />
              <span className="font-display text-label-lg text-lime uppercase tracking-widest">
                Nuestra Causa
              </span>
            </div>

            <h1 className="mb-6 text-balance font-display font-black text-4xl uppercase leading-none tracking-tighter sm:text-6xl lg:text-display">
              Del ruido a la <span className="text-destructive">reconstrucción</span>
            </h1>

            <p className="max-w-2xl text-pretty text-body-lg text-muted-foreground">
              No somos una institución, somos el combo. Salir sigue siendo salir; lo nuevo es
              que ahora la cuenta también pone ladrillos. Esta es la radiografía de cómo
              funciona.
            </p>
          </div>

          {/* La reja de la maqueta. Decorativa, con aria-hidden: no dice nada
              que un lector de pantalla necesite. */}
          <div aria-hidden className="relative z-10 mt-8 hidden lg:col-span-4 lg:mt-0 lg:block">
            <div className="relative h-full min-h-[300px] overflow-hidden border border-secondary/50 bg-card/20">
              <div className="halftone-overlay absolute inset-0 opacity-30" />
              <svg
                className="absolute inset-0 h-full w-full text-lime/20"
                preserveAspectRatio="none"
                viewBox="0 0 100 100"
              >
                <defs>
                  <pattern id="reja" width="10" height="10" patternUnits="userSpaceOnUse">
                    <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="100" height="100" fill="url(#reja)" />
                <circle cx="20" cy="30" r="1.5" fill="currentColor" className="animate-ping" />
                <circle cx="80" cy="70" r="1.5" fill="currentColor" className="animate-ping" />
                <path
                  d="M 20 30 L 80 70"
                  stroke="currentColor"
                  strokeDasharray="2,2"
                  strokeWidth="0.5"
                />
              </svg>
              <div className="absolute right-4 bottom-4 left-4 border-lime border-l-2 bg-popover p-4">
                <p className="font-mono text-label-sm text-muted-foreground">
                  {/* Como string y no como texto suelto: Biome lee el // de en
                      medio como un comentario y su autofix se come la mitad. */}
                  {'SYS_STATUS: ACTIVE // COMBO_POWER: 100%'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 90 / 10 */}
      <section className="relative z-10 w-full border-secondary border-y bg-muted px-margin-mobile py-section-gap lg:px-margin-desktop">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="relative flex min-h-[420px] flex-col justify-end overflow-hidden rounded-xl bg-card p-8 lg:p-16">
            <div className="halftone-overlay absolute inset-0 text-destructive" />
            <div className="relative">
              <div className="mb-4">
                <span className="font-display font-black text-6xl text-destructive lg:text-display">
                  90%
                </span>
                <span className="ml-2 font-display font-extrabold text-headline-md uppercase">
                  Alma
                </span>
              </div>
              <p className="max-w-md text-pretty text-body-lg text-muted-foreground">
                La rumba, el sudor, la gente que atiende la barra y la que se para a bailar.
                Es la fuerza humana que ninguna métrica calcula, y es la que de verdad mueve
                esto.
              </p>
            </div>
          </div>

          <div className="relative flex min-h-[420px] flex-col justify-end overflow-hidden rounded-xl border border-secondary bg-surface-container-lowest p-8 lg:p-16">
            <div className="relative">
              <div className="mb-4">
                <span className="font-display font-black text-6xl text-lime lg:text-display">
                  10%
                </span>
                <span className="ml-2 font-display font-extrabold text-headline-md uppercase">
                  Técnica
                </span>
              </div>
              <p className="max-w-md text-pretty text-body-lg text-muted-foreground">
                La disciplina aburrida: revisar cada producto, guardar cada factura y
                publicarla. Es el esqueleto que sostiene lo otro sin apagarle el ruido.
              </p>
            </div>
          </div>
        </div>

        <p className="mt-8 text-body-md text-muted-foreground">
          Eso es carácter, no presupuesto. El reparto de la plata, con facturas, está en{' '}
          <Link href="/transparencia" className="text-primary-text underline underline-offset-2">
            A dónde va la plata
          </Link>
          .
        </p>
      </section>

      <section className="relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-12 px-margin-mobile py-section-gap lg:px-margin-desktop">
        <Bloque titulo="Para el que sale">
          <p>
            Escoges un sitio y un producto de su carta. Antes de pedirlo ves el precio y el
            reparto en pesos: cuánto va a material y cuánto se queda en el sitio.
          </p>
          <p>
            Puedes pedirlo como invitado o con cuenta. En la barra muestras el QR: el personal
            lo escanea y te entrega el trago. La confirmación aparece en tu pantalla.
          </p>
        </Bloque>

        <Bloque titulo="Qué revisamos antes de publicar">
          <p>
            Confirmamos los datos del sitio y revisamos cada producto antes de publicarlo:
            qué vas a pedir, cuánto cuesta y cómo se reparte el precio.
          </p>
          <p>
            El pedido conserva el precio y el reparto que viste. El escaneo registra la entrega.
            La plata para material entra a lo que pone el sitio; las compras se publican con
            factura en transparencia.
          </p>
        </Bloque>

        <Bloque titulo="Qué pasa con la plata">
          <p>
            El pago corresponde al producto que escogiste, con su reparto declarado. Si pagas
            en la app, el escaneo confirma la entrega. Si pagas en la barra, el personal
            escanea primero y después cobra. Nosotros compramos el material y publicamos
            la factura.
          </p>
          <p>
            Cada compra queda publicada con su fecha, el detalle de lo que se compró y la
            factura. Si una compra no tiene respaldo publicado, es porque no la hemos hecho.
          </p>
          <Link href="/transparencia" className="text-primary-text hover:underline">
            Ver las compras
          </Link>
        </Bloque>
      </section>

      <section
        id="para-sitios"
        className="relative z-10 mx-auto w-full max-w-3xl scroll-mt-24 px-margin-mobile pb-section-gap lg:px-margin-desktop"
      >
        <div className="rounded-xl border-2 border-primary bg-primary/5 p-8">
          <h2 className="font-display font-extrabold text-headline-md uppercase">
            Si tienes un bar o una discoteca
          </h2>
          <p className="mt-3 text-pretty text-body-md text-muted-foreground">
            Armas un producto: un cóctel, una cerveza, un combo o una botella. Defines el precio
            y qué parte va para reconstruir. El mínimo es 40%; desde 50% aparece destacado en la
            carta pública.
          </p>

          <ol className="mt-6 flex flex-col gap-3 text-body-md text-muted-foreground">
            <li>1. Registras tu sitio para que confirmemos sus datos.</li>
            <li>2. Armas el producto, defines un reparto de mínimo 40% y lo publicas en tu carta.</li>
            <li>3. Tu personal escanea cada entrega. Compramos material y publicamos la factura.</li>
          </ol>

          <Link
            href="/registrar-sitio"
            className="mt-6 inline-block rounded-xl bg-primary px-5 py-3 font-display text-label-lg text-primary-foreground uppercase transition-opacity hover:opacity-90"
          >
            Quiero poner
          </Link>
        </div>
      </section>
    </div>
  )
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display font-extrabold text-headline-md uppercase">{titulo}</h2>
      <div className="flex flex-col gap-4 text-pretty text-body-md text-muted-foreground leading-relaxed">
        {children}
      </div>
    </section>
  )
}
