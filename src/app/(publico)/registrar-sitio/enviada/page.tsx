import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { CopiarTexto } from '@/components/sitios/copiar-texto'
import { CORREO_CONTACTO, INSTAGRAM_VERIFICACION, urlInstagram } from '@/config/contacto'
import { auth } from '@/lib/auth/auth'
import { getApplicationByToken, getLiveApplication } from '@/lib/venues/claims'

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
  searchParams: Promise<{ id?: string; t?: string }>
}) {
  const [session, params] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    searchParams,
  ])

  /**
   * Dos formas de llegar, y cada una con su propia regla.
   *
   * `?t=` es el token al portador de quien mando la solicitud SIN cuenta: es lo
   * unico que tiene para volver, asi que no puede exigir sesion.
   * `?id=` sigue filtrando por userId, o sea que poner el id de la solicitud de
   * otra persona en la URL no muestra nada.
   */
  const solicitud = params.t
    ? await getApplicationByToken(params.t)
    : session
      ? await getLiveApplication(session.user.id, params.id)
      : null

  if (!solicitud) notFound()

  // Si ya hay cuenta amarrada no hace falta pedirla. Con `?id=` siempre la hay,
  // porque esa rama exige sesion.
  const yaTieneCuenta = params.t ? Boolean((solicitud as { userId?: string | null }).userId) : true

  // Entro con OTRO correo. Decirlo de frente, porque la solicitud no se le va a
  // amarrar nunca asi y desde afuera parece que no pasa nada (decision 29b).
  const conOtroCorreo =
    Boolean(session) && session?.user.email.toLowerCase() !== solicitud.contactEmail.toLowerCase()

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
            Cuando llegue tu mensaje confirmamos que la cuenta es tuya, publicamos el sitio y te
            damos el panel para que armes tu primer trago.
          </p>
        </Paso>
      </ol>

      {/*
        VA DESPUES DEL DM, NUNCA ANTES. Lo urgente ahora es el mensaje de
        Instagram; la cuenta se puede terminar mientras espera la respuesta. Es
        la misma colocacion —y por la misma razon— que la invitacion a crear
        cuenta en la pantalla del QR, que va debajo del codigo y no encima.
      */}
      {!yaTieneCuenta ? (
        <div className='mt-10 rounded-xl border-2 border-lime p-6'>
          <p className='font-display font-bold text-headline-md text-lime uppercase'>
            Crea tu cuenta con {solicitud.contactEmail}
          </p>
          <p className='mt-2 text-body-md text-muted-foreground'>
            El panel del sitio va a esa cuenta. Créala con{' '}
            <strong className='text-street-white'>ese mismo correo</strong> y tu solicitud se amarra
            sola, sin que tengas que hacer nada más. Sin cuenta no podemos darte el panel, aunque el
            mensaje llegue.
          </p>
          <Link
            href={`/register?correo=${encodeURIComponent(solicitud.contactEmail)}&redirectAfter=/registrar-sitio`}
            className='mt-4 inline-block rounded-xl bg-lime px-5 py-3 font-display text-background text-label-lg uppercase transition-opacity hover:opacity-90'
          >
            Crear la cuenta
          </Link>
        </div>
      ) : null}

      {conOtroCorreo ? (
        <p className='mt-6 rounded-xl border border-primary border-dashed p-4 text-body-md text-muted-foreground'>
          Estás dentro con otro correo. Para que esta solicitud quede a tu nombre, entra con{' '}
          <strong className='text-street-white'>{solicitud.contactEmail}</strong>.
        </p>
      ) : null}

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
