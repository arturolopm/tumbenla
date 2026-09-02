import 'server-only'

import { and, eq, isNull, sql } from 'drizzle-orm'

import { db } from '@/database'
import { ledgerAccount, ledgerEntry, ledgerTransaction } from '@/database/schema'

/**
 * El libro, en partida doble.
 *
 * TODA TRANSACCION ESCRIBE AL MENOS DOS ASIENTOS QUE SUMAN CERO. No es
 * ceremonia contable: es lo unico que permite PROBAR que el sistema cuadra.
 * Un libro de una sola columna firmada no puede detectar un asiento que alguien
 * olvido escribir —el saldo simplemente queda mal y nadie se entera—; este si,
 * y se ve el mismo dia con una consulta de una linea:
 *
 *   select sum(amount) from ledger_entry;   -- tiene que dar 0, siempre
 *
 * NADA SE EDITA NI SE BORRA. Una devolucion o una correccion es una
 * transaccion NUEVA que compensa. Lo hace cumplir un trigger en la base
 * (migracion 0010), no la disciplina de quien escriba la proxima accion.
 */

/**
 * El plan de cuentas. Cuatro, y no crece.
 *
 * `platform_pending_delivery` es la que menos se adivina y la mas importante:
 * cuando alguien paga aca y todavia no le entregan, estamos guardando plata que
 * NO ES NUESTRA. La regla para plata en custodia es reconocer el efectivo y un
 * pasivo igual al mismo tiempo. Sin esa cuenta, la plata de un trago que nadie
 * ha recibido se veria como ingreso propio, que es exactamente la clase de
 * cifra que este producto no puede permitirse afirmar.
 */
export const CUENTA = {
  /** Activo: plata que de verdad tenemos. */
  efectivo: 'platform_cash',
  /** Pasivo: pagado y no entregado. Custodia. */
  porEntregar: 'platform_pending_delivery',
  /** Pasivo: comprometido a material, todavia no gastado. */
  material: 'platform_material_fund',
  /** Mixta, una por sitio: + nos debe, − le debemos. */
  sitio: 'venue_current',
} as const

export type CuentaDePlataforma =
  | typeof CUENTA.efectivo
  | typeof CUENTA.porEntregar
  | typeof CUENTA.material

/** Un asiento por publicar. Positivo es debito, negativo es credito. */
export type Asiento = {
  accountId: string
  /** En pesos. La conversion a string para la columna decimal se hace aca. */
  amount: number
}

export type TipoDeMovimiento =
  | 'order_paid'
  | 'redeemed'
  | 'settlement'
  | 'expired'
  | 'refund'
  | 'purchase'
  | 'adjustment'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type Conexion = Tx | typeof db

/**
 * Busca la cuenta, y si no existe la crea.
 *
 * Las cuentas de plataforma son tres filas que podrian sembrarse, pero
 * crearlas por demanda evita que un despliegue nuevo —o una base de preview
 * recien sacada— quede sin ellas y reviente en la primera venta. El indice
 * unico sobre (kind, venue_id, currency) hace que dos procesos concurrentes no
 * puedan crear dos.
 */
export const cuentaDePlataforma = async (
  kind: CuentaDePlataforma,
  conexion: Conexion = db
): Promise<string> => {
  const [existente] = await conexion
    .select({ id: ledgerAccount.id })
    .from(ledgerAccount)
    .where(and(eq(ledgerAccount.kind, kind), isNull(ledgerAccount.venueId)))
    .limit(1)

  if (existente) return existente.id

  const [creada] = await conexion
    .insert(ledgerAccount)
    .values({ kind })
    .onConflictDoNothing()
    .returning({ id: ledgerAccount.id })

  if (creada) return creada.id

  // Otro proceso la creo entre el select y el insert. Volver a leerla.
  const [ganada] = await conexion
    .select({ id: ledgerAccount.id })
    .from(ledgerAccount)
    .where(and(eq(ledgerAccount.kind, kind), isNull(ledgerAccount.venueId)))
    .limit(1)

  if (!ganada) throw new Error(`No se pudo resolver la cuenta ${kind}`)
  return ganada.id
}

export const cuentaDeSitio = async (venueId: string, conexion: Conexion = db): Promise<string> => {
  const [existente] = await conexion
    .select({ id: ledgerAccount.id })
    .from(ledgerAccount)
    .where(and(eq(ledgerAccount.kind, CUENTA.sitio), eq(ledgerAccount.venueId, venueId)))
    .limit(1)

  if (existente) return existente.id

  const [creada] = await conexion
    .insert(ledgerAccount)
    .values({ kind: CUENTA.sitio, venueId })
    .onConflictDoNothing()
    .returning({ id: ledgerAccount.id })

  if (creada) return creada.id

  const [ganada] = await conexion
    .select({ id: ledgerAccount.id })
    .from(ledgerAccount)
    .where(and(eq(ledgerAccount.kind, CUENTA.sitio), eq(ledgerAccount.venueId, venueId)))
    .limit(1)

  if (!ganada) throw new Error(`No se pudo resolver la cuenta del sitio ${venueId}`)
  return ganada.id
}

export type ResultadoDeMovimiento =
  | { ok: true; transactionId: string; yaExistia: boolean }
  | { ok: false; error: string }

/**
 * Publica un movimiento: la transaccion y sus asientos, en un solo acto.
 *
 * `idempotencyKey` resuelve un problema DISTINTO del de la concurrencia, y
 * hacen falta los dos. El `UPDATE` condicional de `order_redemption` impide que
 * dos escaneos simultaneos ganen los dos. No impide que el MISMO escaneo llegue
 * dos veces —el mesero toco dos veces, la red repitio el POST—, y sin esta
 * clave el reintento publicaria los asientos otra vez y descuadraria el saldo
 * del sitio en silencio. Con ella, el reintento no escribe nada y devuelve lo
 * que ya habia: `yaExistia: true`.
 *
 * Se le pasa una `conexion` cuando el movimiento tiene que ir en la MISMA
 * transaccion que otra cosa —redimir, sobre todo—, porque no puede existir un
 * trago entregado sin su movimiento en el libro.
 */
export const publicarMovimiento = async (
  movimiento: {
    kind: TipoDeMovimiento
    idempotencyKey: string
    asientos: Asiento[]
    orderId?: string
    settlementId?: string
    purchaseId?: string
    note?: string
    createdByUserId?: string
  },
  conexion: Conexion = db
): Promise<ResultadoDeMovimiento> => {
  const { asientos } = movimiento

  if (asientos.length < 2) {
    return { ok: false, error: 'Un movimiento lleva al menos dos asientos.' }
  }

  // La invariante, comprobada ANTES de escribir. En pesos enteros no hay
  // aritmetica de punto flotante que perdonar: si no da cero, es un error de
  // programacion y tiene que reventar aca y no aparecer despues como un saldo
  // torcido que nadie sabe de donde salio.
  const suma = asientos.reduce((total, a) => total + a.amount, 0)
  if (suma !== 0) {
    return { ok: false, error: `Los asientos no suman cero: ${suma}. El movimiento no se publica.` }
  }

  if (asientos.some((a) => !Number.isFinite(a.amount) || a.amount === 0)) {
    return { ok: false, error: 'Hay un asiento en cero o invalido.' }
  }

  try {
    const [creada] = await conexion
      .insert(ledgerTransaction)
      .values({
        kind: movimiento.kind,
        idempotencyKey: movimiento.idempotencyKey,
        orderId: movimiento.orderId,
        settlementId: movimiento.settlementId,
        purchaseId: movimiento.purchaseId,
        note: movimiento.note,
        createdByUserId: movimiento.createdByUserId,
      })
      .onConflictDoNothing({ target: ledgerTransaction.idempotencyKey })
      .returning({ id: ledgerTransaction.id })

    if (!creada) {
      // Ya se habia publicado con esta misma clave: es un reintento, no un
      // movimiento nuevo. Se devuelve el de antes sin escribir nada.
      const [previa] = await conexion
        .select({ id: ledgerTransaction.id })
        .from(ledgerTransaction)
        .where(eq(ledgerTransaction.idempotencyKey, movimiento.idempotencyKey))
        .limit(1)

      if (!previa) return { ok: false, error: 'No se pudo publicar el movimiento.' }
      return { ok: true, transactionId: previa.id, yaExistia: true }
    }

    await conexion.insert(ledgerEntry).values(
      asientos.map((a) => ({
        transactionId: creada.id,
        accountId: a.accountId,
        amount: a.amount.toFixed(2),
      }))
    )

    return { ok: true, transactionId: creada.id, yaExistia: false }
  } catch {
    return { ok: false, error: 'No se pudo publicar el movimiento en el libro.' }
  }
}

/**
 * El saldo de un sitio: `sum()` sobre sus asientos, nunca una columna.
 *
 * Positivo = el sitio nos debe. Negativo = le debemos al sitio. Cero = no hay
 * nada que transferir, que es el caso que la compensacion busca y el que hace
 * que la mayoria de las noches no mueva plata.
 *
 * No existe `venue.saldo` a proposito: una columna se corre en cada escritura
 * concurrente y no deja con que discutirle a un dueno que reclama.
 */
export const saldoDeSitio = async (venueId: string): Promise<number> => {
  const [fila] = await db
    .select({ saldo: sql<string>`coalesce(sum(${ledgerEntry.amount}), 0)` })
    .from(ledgerEntry)
    .innerJoin(ledgerAccount, eq(ledgerAccount.id, ledgerEntry.accountId))
    .where(and(eq(ledgerAccount.kind, CUENTA.sitio), eq(ledgerAccount.venueId, venueId)))

  // postgres-js devuelve todo decimal como string. Number() en el borde, o los
  // totales salen en NaN.
  return Number(fila?.saldo ?? 0)
}

/**
 * La prueba de integridad. Tiene que dar 0.
 *
 * Si no da 0, hay un asiento que no se escribio y NINGUNA cifra de plata del
 * producto sirve hasta arreglarlo. Se corre en `/admin` y queda escrita en
 * `org/datos/METRICAS.md`.
 */
export const libroCuadra = async (): Promise<{ cuadra: boolean; diferencia: number }> => {
  const [fila] = await db
    .select({ total: sql<string>`coalesce(sum(${ledgerEntry.amount}), 0)` })
    .from(ledgerEntry)

  const diferencia = Number(fila?.total ?? 0)
  return { cuadra: diferencia === 0, diferencia }
}
