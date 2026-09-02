import 'server-only'

import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/database'
import { productOrder } from '@/database/schema'

/**
 * Amarra a una cuenta los pedidos que se hicieron como invitado.
 *
 * ES LO QUE HACE QUE "SEGUIR COMO INVITADO" NO SEA UN CALLEJON SIN SALIDA.
 * Pedir sin cuenta tiene que seguir siendo un toque (decision 29), pero si
 * despues esa persona decide abrir su cuenta con el mismo correo, lo que ya
 * pidio TIENE que aparecer ahi. Si no, la historia que le prometemos nace
 * incompleta y no hay forma de repararla: nadie va a volver a pedir el trago de
 * hace tres semanas.
 *
 * EXIGE EL CORREO VERIFICADO, Y ESO NO ES UN DETALLE. El correo de un pedido lo
 * escribe cualquiera en un formulario publico, sin comprobar nada. Sin esta
 * condicion, alguien se registra poniendo el correo ajeno y se queda con el
 * historial de otro —que dice donde estuvo, cuando y con quien—. La
 * verificacion es lo unico que convierte "escribi ese correo" en "ese correo es
 * mio".
 *
 * Es idempotente y barata: un UPDATE con `user_id is null` en el WHERE. Correrla
 * de mas no hace nada.
 */
export const vincularPedidosDeInvitado = async (usuario: {
  id: string
  email: string
  emailVerified: boolean
}): Promise<number> => {
  if (!usuario.emailVerified) return 0

  const correo = usuario.email.trim().toLowerCase()
  if (!correo) return 0

  const vinculados = await db
    .update(productOrder)
    .set({ userId: usuario.id, updatedAt: new Date() })
    .where(and(eq(productOrder.buyerEmail, correo), isNull(productOrder.userId)))
    .returning({ id: productOrder.id })

  return vinculados.length
}
