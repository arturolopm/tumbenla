/**
 * Prueba del libro contra la base local.
 *
 *   bun run prueba:libro
 *
 * NO HAY FRAMEWORK DE PRUEBAS EN EL REPO (`PRODUCT.md`, "Deuda y hallazgos"),
 * y esto no pretende ser uno. Es lo que si se puede sostener hoy: un script que
 * afirma y grita, sobre lo unico que no se puede verificar mirando la pantalla.
 *
 * QUE CUBRE, Y POR QUE JUSTO ESTO:
 *   - El reparto en pesos, incluido el caso que obliga a restar en vez de
 *     redondear las dos partes. Con porcentajes redondos nunca falla; el error
 *     solo aparece con uno que no lo sea, o sea nunca en una prueba a mano.
 *   - Que el copy del reparto no diga "dona" ni "victima" (VOZ.md). Se prueba
 *     con una expresion regular porque una regla de estilo que nadie ejecuta se
 *     rompe sola en tres meses.
 *   - La compensacion, con el ejemplo exacto del que salio el diseno.
 *   - La idempotencia: el MISMO escaneo reintentado no puede publicar los
 *     asientos dos veces. Es el error que descuadraria el saldo en silencio.
 *   - Que el libro entero suma cero.
 *
 * ESCRIBE EN LA BASE Y NO LIMPIA. No puede: el trigger de la migracion 0010
 * prohibe borrar asientos, que es justamente lo que se quiere. Cada corrida usa
 * claves de idempotencia con marca de tiempo, asi que se puede correr muchas
 * veces; para dejar la base como estaba, `bun run db:reset && bun scripts/seed-tumbenla.ts`.
 *
 * Corre con `--conditions react-server` porque `libro.ts` importa `server-only`,
 * que revienta a proposito fuera de un componente de servidor.
 */
import { db } from '@/database'
import { venue } from '@/database/schema'
import { montosDeOrden, repartir, textoDelReparto } from '@/lib/comercio/dinero'
import {
  CUENTA,
  cuentaDePlataforma,
  cuentaDeSitio,
  libroCuadra,
  publicarMovimiento,
  saldoDeSitio,
} from '@/lib/comercio/libro'

let fallos = 0
const ok = (nombre: string, real: unknown, esperado: unknown) => {
  const bien = JSON.stringify(real) === JSON.stringify(esperado)
  if (!bien) fallos++
  console.log(
    `${bien ? '  ok  ' : ' FALLA'} ${nombre}  →  ${JSON.stringify(real)}${bien ? '' : ` (esperado ${JSON.stringify(esperado)})`}`
  )
}

console.log('\n== El reparto, en pesos ==')
ok('50% de 30.000', repartir(30000, 50), { material: 15000, sitio: 15000 })
ok('80% de 30.000', repartir(30000, 80), { material: 24000, sitio: 6000 })
ok('100% de 30.000', repartir(30000, 100), { material: 30000, sitio: 0 })
ok('0% de 30.000', repartir(30000, 0), { material: 0, sitio: 30000 })
// El caso que justifica restar en vez de redondear las dos partes: 33% de
// 25.000 es 8.250 y 67% es 16.750, pero con un porcentaje no entero las dos
// mitades redondeadas dejan de sumar el precio. Restando, siempre suman.
const raro = repartir(25000, 33.33)
ok('33,33% de 25.000 suma exacto', raro.material + raro.sitio, 25000)
const feo = repartir(19990, 7.77)
ok('7,77% de 19.990 suma exacto', feo.material + feo.sitio, 19990)

console.log('\n== Los montos de una orden ==')
ok('3 unidades a 30.000 con 80%', montosDeOrden(30000, 80, 3), {
  unitPrice: 30000,
  unitDonationAmount: 24000,
  unitVenueAmount: 6000,
  totalAmount: 90000,
})

console.log('\n== El copy del reparto (VOZ.md: en pesos, sin "dona") ==')
const texto = textoDelReparto(30000, 80)
console.log(`       "${texto}"`)
ok('no dice "dona" ni "victima"', /dona|donaci|victim|damnific|solidar/i.test(texto), false)
ok('dice los pesos', texto.includes('$24.000') && texto.includes('$6.000'), true)
console.log(`       "${textoDelReparto(30000, 100)}"`)

console.log('\n== El libro ==')
const [sitio] = await db.select({ id: venue.id, slug: venue.slug }).from(venue).limit(1)
if (!sitio) throw new Error('No hay sitios. Corre: bun scripts/seed-tumbenla.ts')
console.log(`       sitio de prueba: ${sitio.slug}`)

const efectivo = await cuentaDePlataforma(CUENTA.efectivo)
const porEntregar = await cuentaDePlataforma(CUENTA.porEntregar)
const material = await cuentaDePlataforma(CUENTA.material)
const cuentaSitio = await cuentaDeSitio(sitio.id)
ok(
  'la cuenta se resuelve estable (no crea dos)',
  await cuentaDePlataforma(CUENTA.efectivo),
  efectivo
)

const saldoInicial = await saldoDeSitio(sitio.id)
const sello = Date.now()

// Orden A: pagada en la app.
await publicarMovimiento({
  kind: 'order_paid',
  idempotencyKey: `a-pago-${sello}`,
  asientos: [
    { accountId: efectivo, amount: 30000 },
    { accountId: porEntregar, amount: -30000 },
  ],
})
// Orden A: escaneada. Se extingue la custodia y aparece lo que le debemos.
await publicarMovimiento({
  kind: 'redeemed',
  idempotencyKey: `a-escaneo-${sello}`,
  asientos: [
    { accountId: porEntregar, amount: 30000 },
    { accountId: material, amount: -15000 },
    { accountId: cuentaSitio, amount: -15000 },
  ],
})
ok(
  'tras la orden de app, le debemos 15.000 al sitio',
  (await saldoDeSitio(sitio.id)) - saldoInicial,
  -15000
)

// Orden B: pagada en la barra y escaneada. El sitio cobro los 30.000.
await publicarMovimiento({
  kind: 'redeemed',
  idempotencyKey: `b-escaneo-${sello}`,
  asientos: [
    { accountId: cuentaSitio, amount: 15000 },
    { accountId: material, amount: -15000 },
  ],
})
ok('app + barra se compensan: nadie transfiere', (await saldoDeSitio(sitio.id)) - saldoInicial, 0)

// Orden C: otra de barra.
await publicarMovimiento({
  kind: 'redeemed',
  idempotencyKey: `c-escaneo-${sello}`,
  asientos: [
    { accountId: cuentaSitio, amount: 15000 },
    { accountId: material, amount: -15000 },
  ],
})
ok(
  'una tercera de barra: el sitio nos debe 15.000',
  (await saldoDeSitio(sitio.id)) - saldoInicial,
  15000
)

console.log('\n== Idempotencia: el mismo escaneo reintentado ==')
const reintento = await publicarMovimiento({
  kind: 'redeemed',
  idempotencyKey: `c-escaneo-${sello}`,
  asientos: [
    { accountId: cuentaSitio, amount: 15000 },
    { accountId: material, amount: -15000 },
  ],
})
ok('el reintento dice que ya existia', reintento.ok && reintento.yaExistia, true)
ok('y NO movio el saldo otra vez', (await saldoDeSitio(sitio.id)) - saldoInicial, 15000)

console.log('\n== Un movimiento descuadrado se rechaza antes de escribir ==')
const malo = await publicarMovimiento({
  kind: 'adjustment',
  idempotencyKey: `malo-${sello}`,
  asientos: [
    { accountId: cuentaSitio, amount: 10000 },
    { accountId: material, amount: -9000 },
  ],
})
ok('rechazado', malo.ok, false)
ok('y el saldo quedo intacto', (await saldoDeSitio(sitio.id)) - saldoInicial, 15000)

console.log('\n== La prueba de integridad ==')
const cuadre = await libroCuadra()
ok('el libro entero suma cero', cuadre, { cuadra: true, diferencia: 0 })

console.log(fallos === 0 ? '\n✓ todo bien\n' : `\n✗ ${fallos} fallas\n`)
process.exit(fallos === 0 ? 0 : 1)
