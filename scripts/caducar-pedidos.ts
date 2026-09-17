/**
 * Caduca los pedidos pagados aqui que nadie reclamo en 45 dias.
 *
 *   bun run caducar
 *
 * Va como cron, no como parte de una peticion: nadie deberia pagar con el
 * tiempo de su pedido el barrido de las ordenes de otros. Es idempotente —la
 * clave del movimiento sale del id de la orden— asi que dispararlo repetido no
 * manda la misma plata dos veces a material.
 */
import { caducarPedidosVencidos } from '@/lib/comercio/caducar'
import { libroCuadra } from '@/lib/comercio/libro'

const r = await caducarPedidosVencidos()

console.log(`  revisadas:  ${r.revisadas}`)
console.log(`  caducadas:  ${r.caducadas}`)
console.log(`  a material: ${r.aMaterial}`)
for (const e of r.errores) console.error(`  ERROR ${e}`)

const cuadre = await libroCuadra()
if (!cuadre.cuadra) {
  console.error(`\n  EL LIBRO NO CUADRA: ${cuadre.diferencia}`)
  process.exit(1)
}
console.log('\n  el libro cuadra')
process.exit(r.errores.length > 0 ? 1 : 0)
