import 'server-only'

import { and, isNull, sql } from 'drizzle-orm'

import { db } from '@/database'
import { venueApplication } from '@/database/schema'

/**
 * Amarra a su cuenta las solicitudes que alguien mando SIN cuenta.
 *
 * Desde la decision 35 el formulario de alta no pide sesion, asi que una
 * solicitud puede nacer huerfana. Esta es la contraparte: cuando esa persona
 * por fin entra con el correo verificado que puso como contacto, la solicitud
 * pasa a ser suya y el panel le llega solo cuando se apruebe.
 *
 * EXIGE `emailVerified`, y eso es lo que lo hace seguro (decision 29b). El
 * correo de contacto lo escribe cualquiera en un formulario publico: sin esa
 * condicion, alguien se registra con el correo de un bar ajeno y se queda con
 * su solicitud —y por esa via, con el sitio—.
 *
 * ES DELIBERADAMENTE UN GEMELO de `vincularPedidosDeInvitado` en
 * `src/lib/comercio/vincular.ts`, y no una abstraccion compartida. Lo que se
 * comparte es la REGLA, no el codigo: el cuerpo son cuatro lineas, y un helper
 * generico `vincularPorCorreo(tabla, columna)` escondería detras de un
 * parametro cuales tablas se pueden amarrar asi. Y no son igual de peligrosas:
 * un pedido es un recibo, una solicitud es el camino a ser DUENO de un sitio.
 * Un helper generico invita a agregar una tercera tabla a la lista sin pensar
 * en eso.
 *
 * Idempotente: el `is null` en el WHERE hace que la segunda pasada no toque
 * nada. Corre en /entrar, o sea en cada inicio de sesion.
 */
export const vincularSolicitudesDeInvitado = async (usuario: {
  id: string
  email: string
  emailVerified: boolean
}): Promise<number> => {
  if (!usuario.emailVerified) return 0

  const correo = usuario.email.trim().toLowerCase()
  if (!correo) return 0

  const vinculadas = await db
    .update(venueApplication)
    .set({ userId: usuario.id, updatedAt: new Date() })
    .where(
      and(
        sql`lower(${venueApplication.contactEmail}) = ${correo}`,
        isNull(venueApplication.userId),
        // Una solicitud ya resuelta no se amarra: si se rechazo o se aprobo
        // para otra persona, aparecer de dueno despues no cambia nada y solo
        // confunde la pantalla de "tus solicitudes".
        sql`${venueApplication.status} in ('pending', 'verifying')`
      )
    )
    .returning({ id: venueApplication.id })

  return vinculadas.length
}
