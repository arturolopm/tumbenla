import 'server-only'

import { eq } from 'drizzle-orm'

import { db } from '@/database'
import { productOrder, venue, venueProduct } from '@/database/schema'
import { sendPedidoEmail } from '@/lib/messaging/email/mailer'

/** Email delivery is deliberately outside every payment transaction. */
export const notifyApprovedOrder = async (input: {
  orderId: string
  codes: readonly string[]
}): Promise<void> => {
  const [order] = await db
    .select({
      buyerName: productOrder.buyerName,
      buyerEmail: productOrder.buyerEmail,
      quantity: productOrder.quantity,
      totalAmount: productOrder.totalAmount,
      unitDonationAmount: productOrder.unitDonationAmount,
      payMethod: productOrder.payMethod,
      publicToken: productOrder.publicToken,
      productName: venueProduct.name,
      venueName: venue.name,
    })
    .from(productOrder)
    .innerJoin(venueProduct, eq(productOrder.productId, venueProduct.id))
    .innerJoin(venue, eq(productOrder.venueId, venue.id))
    .where(eq(productOrder.id, input.orderId))
    .limit(1)

  if (!order) return
  await sendPedidoEmail({
    to: order.buyerEmail,
    compradorNombre: order.buyerName,
    productoNombre: order.productName,
    venueNombre: order.venueName,
    cantidad: Number(order.quantity),
    total: Number(order.totalAmount),
    material: Number(order.unitDonationAmount) * Number(order.quantity),
    pagaEnBarra: order.payMethod === 'bar',
    token: order.publicToken,
    codigos: [...input.codes],
  })
}
