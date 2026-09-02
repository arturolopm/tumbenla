import { NextResponse } from 'next/server'

import { estadoDeOrdenPorToken } from '@/lib/comercio/queries'

/**
 * Lo que sondea la pantalla del QR, hasta una vez por segundo.
 *
 * ES LA RUTA MAS LLAMADA DEL PRODUCTO y por eso hace lo minimo: un `select` por
 * indice unico, sin sesion que validar —el token de la URL ES la
 * autenticacion—, sin tocar `venue` ni `venue_product`, y devolviendo unas
 * decenas de bytes.
 *
 * La cuenta, con las cifras de verdad: con dos decenas de QR abiertos al tiempo
 * son ~20 consultas/s, y ~90 peticiones por pedido en la ventana rapida. Una
 * noche movida de 200 pedidos son ~18.000 consultas de milisegundos, repartidas
 * en horas en las que la base YA esta despierta porque estan entrando pedidos.
 * El presupuesto de Neon lo aprieta que la base no duerma, y esto no cambia
 * cuando duerme: un bar abre unas 60 horas al mes.
 *
 * Si algun dia hay cientos de QR abiertos a la vez, la salida NO es sondear mas
 * lento: es un canal de notificacion. Y conviene saber de una que LISTEN/NOTIFY
 * de Postgres no es esa salida en este stack — el pooler de Neon es PgBouncer
 * en modo transaccion y no lo soporta, y la app tiene que ir por el pooler.
 */
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const estado = await estadoDeOrdenPorToken(token)

  // Mismo 404 para un token que no existe y para uno mal formado: distinguirlos
  // le diria a quien prueba tokens cuando va por buen camino.
  if (!estado) {
    return NextResponse.json({ error: 'No existe' }, { status: 404 })
  }

  return NextResponse.json(estado, {
    headers: { 'cache-control': 'no-store' },
  })
}
