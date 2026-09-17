import 'server-only'

import { eq } from 'drizzle-orm'

import { db } from '@/database'
import { customerOrder, productOrder, venue, venueProduct } from '@/database/schema'
import { sendCustomerOrderEmail } from '@/lib/messaging/email/mailer'

/** Email delivery is deliberately outside every payment transaction. */
export const notifyApprovedOrder = async (input: {
  orderId: string
  codes: readonly string[]
}): Promise<void> => {
  const code = input.codes[0]
  if (!code) return
  const [anchor] = await db
    .select({ customerOrderId: productOrder.customerOrderId })
    .from(productOrder)
    .where(eq(productOrder.id, input.orderId))
    .limit(1)
  if (!anchor) return

  if (anchor.customerOrderId) {
    const [order] = await db
      .select({
        buyerName: customerOrder.buyerName,
        buyerEmail: customerOrder.buyerEmail,
        totalAmount: customerOrder.totalAmount,
        payMethod: customerOrder.payMethod,
        publicToken: customerOrder.publicToken,
        venueName: venue.name,
      })
      .from(customerOrder)
      .innerJoin(venue, eq(customerOrder.venueId, venue.id))
      .where(eq(customerOrder.id, anchor.customerOrderId))
      .limit(1)
    if (!order) return
    const lines = await db
      .select({
        productName: venueProduct.name,
        quantity: productOrder.quantity,
        unitDonationAmount: productOrder.unitDonationAmount,
      })
      .from(productOrder)
      .innerJoin(venueProduct, eq(productOrder.productId, venueProduct.id))
      .where(eq(productOrder.customerOrderId, anchor.customerOrderId))
      .orderBy(productOrder.lineOrdinal)

    await sendCustomerOrderEmail({
      to: order.buyerEmail,
      buyerName: order.buyerName,
      venueName: order.venueName,
      lines: lines.map((line) => ({
        productName: line.productName,
        quantity: Number(line.quantity),
      })),
      total: Number(order.totalAmount),
      donationAmount: lines.reduce(
        (total, line) => total + Number(line.unitDonationAmount) * Number(line.quantity),
        0
      ),
      payAtBar: order.payMethod === 'bar',
      token: order.publicToken,
      code,
    })
    return
  }

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
  await sendCustomerOrderEmail({
    to: order.buyerEmail,
    buyerName: order.buyerName,
    venueName: order.venueName,
    lines: [{ productName: order.productName, quantity: Number(order.quantity) }],
    total: Number(order.totalAmount),
    donationAmount: Number(order.unitDonationAmount) * Number(order.quantity),
    payAtBar: order.payMethod === 'bar',
    token: order.publicToken,
    code,
  })
}
