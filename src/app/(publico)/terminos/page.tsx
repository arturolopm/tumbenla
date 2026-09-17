import type { Metadata } from 'next'

import { getBrandConfig } from '@/config/branding'
import { generateMetadata as buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'Términos',
  description: 'Qué es Tumbenla, cómo funciona y qué responsabilidades tiene cada parte.',
  canonical: '/terminos',
})

export default function TerminosPage() {
  const brand = getBrandConfig()

  return (
    <div className='mx-auto w-full max-w-3xl px-margin-mobile py-section-gap lg:px-margin-desktop'>
      <h1 className='text-balance font-display font-black text-4xl uppercase leading-none tracking-tighter sm:text-5xl'>
        Términos
      </h1>

      <div className='mt-6 rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm'>
        Estos términos todavía no han pasado por revisión legal. Describen lo que hacemos hoy, de
        forma honesta, pero no reemplazan un documento redactado por un abogado.
      </div>

      <div className='mt-10 flex flex-col gap-8 text-muted-foreground leading-relaxed'>
        <Section title='Qué es Tumbenla'>
          Tumbenla publica sitios que ofrecen un producto concreto con un reparto visible: una parte
          queda en el sitio y otra se contabiliza para reconstruir. También registra las entregas y
          publica las compras de material que tienen evidencia verificada.
        </Section>

        <Section title='Pedidos y pagos'>
          Antes de pedir ves el producto, el precio y su reparto. Puedes pagar en la aplicación o en
          la barra, según la opción disponible. Cuando pagas en la aplicación, el cobro lo gestiona
          una pasarela externa; Tumbenla no almacena los datos de tu tarjeta. El QR es de un solo
          uso y el escaneo registra la entrega del pedido.
        </Section>

        <Section title='Reparto y cifras públicas'>
          El producto, el precio y el porcentaje quedan fijados al crear el pedido. El valor final
          en pesos para reconstruir se concilia con las deducciones reales del pago. Los pedidos de
          prueba, devueltos o sin verificar no entran en los totales reales. Las compras de material
          se publican con su respaldo; las cuentas son colectivas y no atribuimos una compra
          concreta a un trago individual.
        </Section>

        <Section title='Sitios y productos'>
          Tumbenla verifica el sitio antes de publicarlo. Un sitio aprobado administra y publica sus
          productos cuando cumplen las reglas vigentes, incluido el reparto mínimo para reconstruir.
          La plataforma puede pausar o retirar un sitio, producto o contenido que incumpla esas
          reglas o presente información engañosa.
        </Section>

        <Section title='Contenido y evidencia'>
          Los nombres, logos y fotos de cada sitio pertenecen a sus titulares. Las facturas y
          fotografías públicas deben proteger los datos que no corresponde divulgar. Si eres titular
          de contenido y necesitas corregirlo o retirarlo, escríbenos.
        </Section>

        {brand.supportEmail ? (
          <section className='flex flex-col gap-3'>
            <h2 className='font-semibold text-foreground text-xl'>Contacto</h2>
            <p>
              <a
                href={`mailto:${brand.supportEmail}`}
                className='text-primary-text hover:underline'
              >
                {brand.supportEmail}
              </a>
            </p>
          </section>
        ) : null}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className='flex flex-col gap-3'>
      <h2 className='font-semibold text-foreground text-xl'>{title}</h2>
      <p className='max-w-prose text-pretty'>{children}</p>
    </section>
  )
}
