import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { CopiarTexto } from '@/components/sitios/copiar-texto'
import { CORREO_CONTACTO, INSTAGRAM_VERIFICACION, urlInstagram } from '@/config/contacto'
import { auth } from '@/lib/auth/auth'
import { getLiveApplication } from '@/lib/venues/claims'

/**
 * Qué sigue después de mandar la solicitud.
 *
 * ESTA PANTALLA ES LA VERIFICACION. Sin ella el formulario no servia de nada:
 * la persona mandaba sus datos y no pasaba nada mas, ni sabia que esperar.
 *
 * Y pide DOS cosas, que no son la misma:
 *   1. que el mensaje salga de la cuenta del SITIO  -> prueba que controla la cuenta
 *   2. que el mensaje CITE su correo                -> prueba que es quien lleno el formulario
 * Sin la segunda, quien maneja las redes del bar podria quedarse con el sitio
 * de otro. Por eso el correo va copiable y no solo escrito.
 */
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Qué sigue',
  robots: { index: false, follow: false },
}

export default async function EnviadaPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const [session, params] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    searchParams,
  ])

  if (!session) redirect('/login?redirectAfter=/registrar-sitio')

  // getLiveApplication filtra por userId, asi que poner el id de la solicitud
  // de otra persona en la URL no muestra nada.
  const solicitud = await getLiveApplication(session.user.id, params.id)
  if (!solicitud) notFound()

  const mensaje = `Hola, soy de ${solicitud.name} y quiero registrarlo en Tumbenla. Mi correo es ${solicitud.contactEmail}`

  return (
    <div className='mx-auto w-full max-w-2xl px-margin-mobile py-section-gap lg:px-margin-desktop'>
      <p className='inline-flex w-fit items-center gap-2 rounded-full border border-secondary bg-popover px-4 py-2'>
        <span className='size-2 animate-pulse rounded-full bg-lime' />
        <span className='font-display text-label-lg text-lime uppercase tracking-widest'>
          Solicitud recibida
        </span>
      </p>

      <h1 className='mt-4 text-balance font-display font-black text-4xl uppercase leading-none tracking-tighter'>
        Falta un paso
      </h1>

      <p className='mt-4 text-pretty text-body-lg text-muted-foreground'>
        Tenemos los datos de <strong className='text-street-white'>{solicitud.name}</strong>. Ahora
        necesitamos comprobar que el sitio es tuyo, y para eso basta un mensaje.
      </p>

      <ol className='mt-8 flex flex-col gap-6'>
        <Paso numero={1} titulo={`Escríbenos desde @${solicitud.instagram}`}>
          <p className='text-body-md text-muted-foreground'>
            Manda un mensaje directo a{' '}
            <a
              href={urlInstagram(INSTAGRAM_VERIFICACION)}
              target='_blank'
              rel='noopener noreferrer'
              className='text-primary-text hover:underline'
            >
              @{INSTAGRAM_VERIFICACION}
            </a>{' '}
            <strong className='text-street-white'>
              desde la cuenta del sitio, no desde la tuya personal
            </strong>
            . Eso es lo que nos dice que la cuenta es de ustedes.
          </p>
        </Paso>

        <Paso numero={2} titulo='Incluye tu correo en el mensaje'>
          <p className='text-body-md text-muted-foreground'>
            El mensaje tiene que decir{' '}
            <strong className='text-street-white'>{solicitud.contactEmail}</strong>. Sin eso sabemos
            que la cuenta es del bar, pero no que quien escribe eres tú.
          </p>
          <CopiarTexto texto={mensaje} etiqueta='Copiar el mensaje' />
        </Paso>

        <Paso numero={3} titulo='Nosotros hacemos el resto'>
          <p className='text-body-md text-muted-foreground'>
            Cuando llegue tu mensaje te escribimos a{' '}
            <strong className='text-street-white'>{solicitud.contactEmail}</strong> para acordar
            cuánto vas a poner. Ahí te damos el panel y publicamos el sitio.
          </p>
        </Paso>
      </ol>

      <div className='mt-10 rounded-xl border border-border border-dashed p-6'>
        <p className='font-display font-bold text-headline-md uppercase'>
          ¿El sitio no tiene Instagram?
        </p>
        <p className='mt-2 text-body-md text-muted-foreground'>
          Escríbenos a{' '}
          <a href={`mailto:${CORREO_CONTACTO}`} className='text-primary-text hover:underline'>
            {CORREO_CONTACTO}
          </a>{' '}
          y lo resolvemos de otra forma. Es el único caso que no podemos confirmar solos.
        </p>
      </div>

      <div className='mt-8 flex flex-wrap gap-4'>
        <Link
          href='/registrar-sitio'
          className='font-display text-label-lg text-primary-text uppercase hover:underline'
        >
          Corregir los datos
        </Link>
        <Link
          href='/sitios'
          className='font-display text-label-lg text-muted-foreground uppercase hover:text-street-white'
        >
          Ver el mapa
        </Link>
      </div>
    </div>
  )
}

function Paso({
  numero,
  titulo,
  children,
}: {
  numero: number
  titulo: string
  children: React.ReactNode
}) {
  return (
    <li className='flex gap-4'>
      <span className='flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-primary font-display font-black text-primary-text'>
        {numero}
      </span>
      <div className='min-w-0 flex-1'>
        <p className='font-display font-bold text-headline-md uppercase'>{titulo}</p>
        <div className='mt-1 flex flex-col gap-3'>{children}</div>
      </div>
    </li>
  )
}
