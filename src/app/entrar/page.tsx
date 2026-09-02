import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { isAdminEmail } from '@/lib/auth/admin'
import { auth } from '@/lib/auth/auth'
import { listMyVenues } from '@/lib/auth/venue-access'
import { vincularPedidosDeInvitado } from '@/lib/comercio/vincular'

/**
 * El despachador por rol. No pinta nada: lee la sesion y redirige.
 *
 * POR QUE EXISTE: despues de iniciar sesion, a donde va alguien depende de
 * quien es. Sin esta ruta, esa decision tendria que vivir en el formulario de
 * login, que es un componente de CLIENTE y no puede leer ni ADMIN_EMAILS ni la
 * base. Con ella, el login solo sabe mandar a /entrar y el rol se resuelve en
 * el servidor, donde estan los datos.
 *
 * Tambien es la razon de que agregar un rol nuevo no obligue a tocar el login,
 * el registro, la verificacion y los botones sociales por separado.
 */
export const dynamic = 'force-dynamic'

export const metadata = {
  robots: { index: false, follow: false },
}

export default async function EntrarPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  // Sin sesion no hay a donde despachar. Se vuelve al login pidiendo volver
  // aca, para que el rol se resuelva cuando ya haya con que resolverlo.
  if (!session) redirect('/login?redirectAfter=/entrar')

  // Se amarran aca los pedidos hechos como invitado con este mismo correo.
  // Este es el punto por el que pasa TODO el que entra, sin importar el rol, y
  // es idempotente: un UPDATE con `user_id is null` en el WHERE. Ponerlo solo
  // en /mi-historia dejaria sin amarrar al dueño de un bar que tambien sale de
  // rumba, que es la misma persona con dos sombreros.
  await vincularPedidosDeInvitado({
    id: session.user.id,
    email: session.user.email,
    emailVerified: session.user.emailVerified,
  })

  if (isAdminEmail(session.user.email, session.user.emailVerified)) {
    redirect('/admin')
  }

  // Quien trabaja en un sitio entra a su panel. Con varios, /panel pregunta
  // cual; con uno solo, /panel redirige de una.
  const sitios = await listMyVenues(session.user.id)
  if (sitios.length > 0) redirect('/panel')

  redirect('/mi-historia')
}
