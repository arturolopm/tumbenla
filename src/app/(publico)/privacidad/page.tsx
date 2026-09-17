import type { Metadata } from 'next'

import { getBrandConfig } from '@/config/branding'
import { generateMetadata as buildMetadata } from '@/lib/seo'

export const metadata: Metadata = buildMetadata({
  title: 'Privacidad',
  description: 'Qué datos recogemos para operar Tumbenla y cuáles no publicamos.',
  canonical: '/privacidad',
})

export default function PrivacidadPage() {
  const brand = getBrandConfig()

  return (
    <div className='mx-auto w-full max-w-3xl px-margin-mobile py-section-gap lg:px-margin-desktop'>
      <h1 className='text-balance font-display font-black text-4xl uppercase leading-none tracking-tighter sm:text-5xl'>
        Privacidad
      </h1>

      <div className='mt-6 rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm'>
        Esta política todavía no ha pasado por revisión legal. Describe lo que hacemos hoy, de forma
        honesta, pero no reemplaza un documento redactado por un abogado ni sustituye lo que exige
        la Ley 1581 de 2012.
      </div>

      <div className='mt-10 flex flex-col gap-8 text-muted-foreground leading-relaxed'>
        <Section title='Navegar no requiere cuenta'>
          Ver el mapa, los sitios, las cartas y las compras publicadas no requiere cuenta. No
          pedimos correo ni teléfono para consultar esa información.
        </Section>

        <Section title='Pedidos y cuentas'>
          Para un pedido pedimos nombre y correo. Puedes comprar como invitado o crear una cuenta;
          la cuenta es opcional y sirve para reunir pedidos y fotos reclamadas en “Mi historia”.
          Cuando corresponde, el correo verificado vincula un pedido de invitado con su cuenta.
        </Section>

        <Section title='Pagos'>
          Los pagos de la aplicación los procesa una pasarela externa. Tumbenla conserva los datos
          necesarios para identificar el pedido y conciliar su reparto, pero no almacena los datos
          completos de tu tarjeta. Los pedidos pagados en la barra también conservan la identidad
          que se entregó al crear el pedido.
        </Section>

        <Section title='Solicitudes de sitios'>
          El alta pública pide cuatro datos para verificar el control del sitio: nombre, ciudad,
          correo y usuario de Instagram. La solicitud no crea una cuenta ni publica el sitio por sí
          sola; usamos esos datos para contactarte y completar la verificación.
        </Section>

        <Section title='Comunicaciones de sitios (en desarrollo)'>
          Hoy no enviamos promociones a partir de tus pedidos. Si activamos esta función, será
          opcional y separada: solo recibirás mensajes de un sitio si autorizas esa comunicación,
          podrás retirarla y no entregaremos tu correo o teléfono como una lista automática al
          sitio. La configuración final dependerá del consentimiento, las reglas de privacidad y el
          acuerdo con cada sitio.
        </Section>

        <Section title='Fotos y evidencia pública'>
          Las fotos de fiestas solo se muestran públicamente cuando el sitio las aprueba. Las
          facturas y fotos de material se publican con la información necesaria para comprobar la
          compra, evitando direcciones exactas y nombres de quienes reciben el material. Una foto
          identificable no se publica sin permiso.
        </Section>

        <section className='flex flex-col gap-3'>
          <h2 className='font-semibold text-foreground text-xl'>
            Si quieres corregir o retirar algo
          </h2>
          <p className='max-w-prose text-pretty'>
            Escríbenos y revisamos la solicitud. No hace falta explicar por qué.
          </p>
          {brand.supportEmail ? (
            <p>
              <a
                href={`mailto:${brand.supportEmail}`}
                className='text-primary-text hover:underline'
              >
                {brand.supportEmail}
              </a>
            </p>
          ) : null}
        </section>
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
