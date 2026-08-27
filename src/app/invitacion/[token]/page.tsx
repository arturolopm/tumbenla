import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { auth } from '@/lib/auth/auth'
import { aceptarInvitacion, leerInvitacion } from '@/lib/venues/accept-invitation'
import { MOTIVO_TEXTO } from '@/lib/venues/invitations'

/**
 * Aceptar una invitacion al equipo de un sitio.
 *
 * Toda la logica vive en src/lib/venues/accept-invitation.ts, y las dos
 * comprobaciones que importan estan explicadas alli: el token tiene que servir
 * Y el correo de la sesion tiene que ser el correo invitado.
 *
 * SE ACEPTA CON UN POST, NO AL ABRIR LA PAGINA. Los clientes de correo y los
 * antivirus visitan los enlaces para revisarlos; una invitacion que se acepta
 * sola al cargarse ya estaria aceptada antes de que la persona la lea.
 */
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Invitación',
  robots: { index: false, follow: false },
}

export default async function InvitacionPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const destino = `/invitacion/${token}`

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect(`/login?redirectAfter=${encodeURIComponent(destino)}`)

  const lectura = await leerInvitacion(token, session.user.email)

  if (!lectura.ok) {
    return (
      <Marco titulo="Esa invitación no sirve">
        <p className="text-body-md text-muted-foreground">{MOTIVO_TEXTO[lectura.motivo]}</p>
        {lectura.motivo === 'otro_correo' ? (
          <p className="mt-2 text-body-md text-muted-foreground">
            Entraste como <strong className="text-street-white">{session.user.email}</strong>.
          </p>
        ) : null}
        <Link
          href="/"
          className="mt-6 inline-block rounded-xl bg-primary px-5 py-3 font-display text-label-lg text-primary-foreground uppercase"
        >
          Ir al inicio
        </Link>
      </Marco>
    )
  }

  const { invitacion } = lectura

  const aceptar = async () => {
    'use server'

    // La sesion se vuelve a leer aca: esto es un endpoint POST aparte, al que
    // se puede llegar sin haber pintado nunca la pagina de arriba.
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) redirect(`/login?redirectAfter=${encodeURIComponent(destino)}`)

    const resultado = await aceptarInvitacion(token, session.user.id, session.user.email)

    // Si dejo de servir entre la carga y el clic, se vuelve a pintar la pagina,
    // que ahora explica por que.
    if (!resultado.ok) redirect(destino)

    redirect(`/panel/${resultado.venueSlug}`)
  }

  return (
    <Marco titulo={`Te invitaron a ${invitacion.venueNombre}`}>
      <p className="text-body-md text-muted-foreground">
        Vas a entrar como{' '}
        <strong className="text-street-white">
          {invitacion.role === 'owner' ? 'dueño' : 'parte del equipo'}
        </strong>{' '}
        de <strong className="text-street-white">{invitacion.venueNombre}</strong>, con el
        correo <strong className="text-street-white">{session.user.email}</strong>.
      </p>

      <form action={aceptar} className="mt-6">
        <button
          type="submit"
          className="rounded-xl bg-primary px-5 py-3 font-display text-label-lg text-primary-foreground uppercase transition-opacity hover:opacity-90"
        >
          Aceptar la invitación
        </button>
      </form>
    </Marco>
  )
}

function Marco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-xl px-margin-mobile py-section-gap">
      <h1 className="font-display font-black text-3xl uppercase leading-none tracking-tighter">
        {titulo}
      </h1>
      <div className="mt-4">{children}</div>
    </div>
  )
}
