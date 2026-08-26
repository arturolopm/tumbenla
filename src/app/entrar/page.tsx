import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { isAdminEmail } from '@/lib/auth/admin'
import { auth } from '@/lib/auth/auth'

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

  if (isAdminEmail(session.user.email, session.user.emailVerified)) {
    redirect('/admin')
  }

  // La etapa 2 mete aca el caso del panel de sitio, consultando venue_member.
  redirect('/mi-historia')
}
