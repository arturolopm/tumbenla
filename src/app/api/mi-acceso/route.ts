import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

import { isAdminEmail } from '@/lib/auth/admin'
import { auth } from '@/lib/auth/auth'

/**
 * Que puede ver esta persona en el menu de la barra.
 *
 * POR QUE UN ENDPOINT Y NO LA SESION: el menu es un componente de cliente y
 * `useSession()` le da el correo, pero no si ese correo esta en ADMIN_EMAILS,
 * que es una variable del servidor. Preguntarlo aca evita filtrar la lista al
 * navegador.
 *
 * POR QUE NO SE CONSULTA AL CARGAR LA PAGINA: el menu lo pide la primera vez
 * que alguien lo ABRE, no en cada visita. La barra sale en todo el sitio
 * publico; llamar esto en cada carga seria una invocacion por pagina vista a
 * cambio de nada, porque la mayoria de la gente nunca abre el menu.
 *
 * No revela nada que quien pregunta no sepa ya de si mismo, y sin sesion
 * responde el objeto vacio en vez de 401: para el menu "no eres nada" y "no
 * has entrado" se pintan igual.
 */
export const dynamic = 'force-dynamic'

export const GET = async () => {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) {
    return NextResponse.json(
      { admin: false, sitios: [] },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }

  return NextResponse.json(
    {
      admin: isAdminEmail(session.user.email, session.user.emailVerified),
      // La etapa 2 lo llena con listMyVenues(session.user.id).
      sitios: [],
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
