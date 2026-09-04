/**
 * Regression test for concurrent payment confirmation.
 *
 *   bun --conditions react-server ./scripts/prueba-confirmacion-concurrente.ts
 *
 * Payment providers retry webhooks, and two deliveries can race after both see
 * the order as pending. There must be one state transition, one ledger record
 * and one redemption code per purchased unit — never a second batch.
 *
 * Local development only: this creates an immutable ledger record, so do not
 * run it against a production database.
 */
import { and, eq } from 'drizzle-orm'

import { confirmarPago } from '@/app/actions/pedidos'
import { db } from '@/database'
import { ledgerTransaction, orderRedemption, productOrder, venueProduct } from '@/database/schema'
import { generarToken } from '@/lib/venues/invitations'

if (process.env.NODE_ENV === 'production') {
  throw new Error('This script does not run in production.')
}

const [product] = await db
  .select({ id: venueProduct.id, venueId: venueProduct.venueId, price: venueProduct.price })
  .from(venueProduct)
  .limit(1)

if (!product) {
  throw new Error('No venue product found. Run: bun scripts/seed-tumbenla.ts')
}

const quantity = 2
const token = generarToken()
const reference = `concurrent-${Date.now()}`
const unitPrice = Number(product.price)
const unitDonationAmount = (Math.round(unitPrice * 50) / 100).toFixed(2)
const unitVenueAmount = (unitPrice - Number(unitDonationAmount)).toFixed(2)

const [order] = await db
  .insert(productOrder)
  .values({
    productId: product.id,
    venueId: product.venueId,
    buyerName: 'Prueba concurrencia',
    buyerEmail: 'concurrencia@prueba.local',
    quantity: String(quantity),
    unitPrice: unitPrice.toFixed(2),
    donationPercentage: '50.00',
    unitDonationAmount,
    unitVenueAmount,
    totalAmount: (unitPrice * quantity).toFixed(2),
    publicToken: token,
    payMethod: 'app',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  })
  .returning({ id: productOrder.id })

if (!order) throw new Error('Could not create the test order.')

const [first, second] = await Promise.all([
  confirmarPago(order.id, 'test', reference),
  confirmarPago(order.id, 'test', reference),
])

const [saved] = await db
  .select({ status: productOrder.status, providerReference: productOrder.providerReference })
  .from(productOrder)
  .where(eq(productOrder.id, order.id))

const codes = await db
  .select({ id: orderRedemption.id })
  .from(orderRedemption)
  .where(eq(orderRedemption.orderId, order.id))

const movements = await db
  .select({ id: ledgerTransaction.id })
  .from(ledgerTransaction)
  .where(and(eq(ledgerTransaction.orderId, order.id), eq(ledgerTransaction.kind, 'order_paid')))

const passed =
  first.ok &&
  second.ok &&
  saved?.status === 'paid' &&
  saved.providerReference === reference &&
  codes.length === quantity &&
  movements.length === 1

console.log(
  passed
    ? `✓ concurrencia segura: 1 pago, ${quantity} códigos y 1 movimiento`
    : JSON.stringify({ first, second, saved, codes: codes.length, movements: movements.length })
)

process.exit(passed ? 0 : 1)
