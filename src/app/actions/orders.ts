'use server'

import { headers } from 'next/headers'
import { z } from 'zod'

import { env } from '@/config/env'
import { db } from '@/database'
import { auth } from '@/lib/auth/auth'
import { CashCreditService } from '@/lib/commerce/cash-credit-service'
import { notifyApprovedOrder } from '@/lib/commerce/order-notifications'
import {
  commerceNewOperationsEnabled,
  createCommercePaymentService,
} from '@/lib/commerce/payment-service-factory'
import { CommerceRateLimitService } from '@/lib/commerce/rate-limit-service'

const cashCredit = new CashCreditService({
  database: db,
  fundingClassification: env.COMMERCE_FUNDING_CLASSIFICATION ?? 'sandbox',
})
const commerceRateLimits = new CommerceRateLimitService({ database: db })

export type OrderState =
  | { status: 'idle' }
  | {
      status: 'error'
      error: string
      reason?: 'cart-changed' | 'rotate-submission'
      fieldErrors?: Record<string, string[]>
    }
  | { status: 'success'; token: string; url: string }

const orderSchema = z.object({
  venueId: z.string().min(1),
  venueSlug: z.string().min(1),
  lines: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).max(20),
      })
    )
    .min(1)
    .max(20),
  buyerName: z.string().trim().min(2, 'Escribe tu nombre').max(80),
  buyerEmail: z.email('Ese correo no se ve bien'),
  payMethod: z.enum(['app', 'bar']),
  submissionKey: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
  quotedCartHash: z.string().regex(/^[a-f0-9]{64}$/),
  wantsAccount: z.enum(['0', '1']).optional(),
})

const parseLines = (value: FormDataEntryValue | null): unknown => {
  if (typeof value !== 'string') return undefined
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

export const createOrderAction = async (
  _previous: OrderState,
  formData: FormData
): Promise<OrderState> => {
  if (!commerceNewOperationsEnabled()) {
    return {
      status: 'error',
      error:
        'Los pedidos nuevos están pausados. Los pagos y pedidos existentes siguen en revisión.',
    }
  }
  const parsed = orderSchema.safeParse({
    venueId: formData.get('venueId'),
    venueSlug: formData.get('venueSlug'),
    lines: parseLines(formData.get('lines')),
    buyerName: formData.get('buyerName'),
    buyerEmail: formData.get('buyerEmail'),
    payMethod: formData.get('payMethod'),
    submissionKey: formData.get('submissionKey'),
    quotedCartHash: formData.get('quotedCartHash'),
    wantsAccount: formData.get('quiereCuenta') ?? undefined,
  })
  if (!parsed.success) {
    return {
      status: 'error',
      error: 'Revisa los campos marcados.',
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    }
  }
  const totalUnits = parsed.data.lines.reduce((sum, line) => sum + line.quantity, 0)
  if (
    totalUnits > 20 ||
    new Set(parsed.data.lines.map((line) => line.productId)).size !== parsed.data.lines.length
  ) {
    return { status: 'error', error: 'El pedido debe tener entre 1 y 20 unidades.' }
  }

  const requestHeaders = await headers()
  const address =
    requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    requestHeaders.get('x-real-ip')?.trim() ||
    'unknown-address'
  const rate = await commerceRateLimits.consume({
    scope: parsed.data.payMethod === 'bar' ? 'cash_reservation' : 'checkout',
    key: `${address}:${parsed.data.buyerEmail.trim().toLowerCase()}:${parsed.data.venueId}`,
    limit: parsed.data.payMethod === 'bar' ? 12 : 30,
    windowSeconds: 10 * 60,
  })
  if (!rate.allowed) {
    return {
      status: 'error',
      error: 'Hay demasiados intentos seguidos. Espera unos minutos antes de volver a pedir.',
    }
  }

  const session = await auth.api.getSession({ headers: requestHeaders })
  const accountSuffix = parsed.data.wantsAccount === '1' && !session ? '?cuenta=1' : ''
  const input = {
    venueId: parsed.data.venueId,
    lines: parsed.data.lines,
    buyerName: parsed.data.buyerName,
    buyerEmail: parsed.data.buyerEmail,
    submissionKey: parsed.data.submissionKey,
    quotedCartHash: parsed.data.quotedCartHash,
    userId: session?.user?.id ?? null,
  }

  try {
    if (parsed.data.payMethod === 'app') {
      const result = await createCommercePaymentService().startPayment({
        ...input,
        payMethod: 'app',
      })
      if (result.kind === 'checkout') {
        return {
          status: 'success',
          token: result.orderToken,
          url: `/pago/iniciar/${result.attemptId}${accountSuffix}`,
        }
      }
      if (result.kind === 'approved') {
        return {
          status: 'success',
          token: result.orderToken,
          url: `/orden/${result.orderToken}${accountSuffix}`,
        }
      }
      if (result.kind === 'pending' || result.kind === 'checkout-unavailable') {
        return {
          status: 'success',
          token: result.orderToken,
          url: `/pago/estado/${result.attemptId}${accountSuffix}`,
        }
      }
      if (result.kind === 'conflict') {
        return {
          status: 'error',
          reason: 'rotate-submission',
          error: 'Este intento ya corresponde a otro pedido. Intenta otra vez.',
        }
      }
      if (result.kind === 'rejected') {
        return {
          status: 'error',
          reason: 'rotate-submission',
          error: 'El cobro no pudo iniciarse. No se hizo un segundo intento automático.',
        }
      }
      if (result.reason === 'cart-changed') {
        return {
          status: 'error',
          reason: 'cart-changed',
          error: 'La carta cambió. Revisa el pedido actualizado antes de continuar.',
        }
      }
      return {
        status: 'error',
        error:
          result.reason === 'product-unavailable'
            ? 'Algún producto ya no se puede pedir.'
            : 'El pago en línea no está disponible en este momento.',
      }
    }

    const result = await cashCredit.startOrder({ ...input, payMethod: 'bar' })
    if (result.kind === 'reserved') {
      if (!result.duplicate) {
        try {
          await notifyApprovedOrder({ orderId: result.orderId, codes: result.codes })
        } catch {
          // Email is not part of the reservation transaction.
        }
      }
      return {
        status: 'success',
        token: result.orderToken,
        url: `/orden/${result.orderToken}${accountSuffix}`,
      }
    }
    if (result.kind === 'conflict') {
      return {
        status: 'error',
        reason: 'rotate-submission',
        error: 'Este intento ya corresponde a otro pedido. Intenta otra vez.',
      }
    }
    if (result.reason === 'cart-changed') {
      return {
        status: 'error',
        reason: 'cart-changed',
        error: 'La carta cambió. Revisa el pedido actualizado antes de continuar.',
      }
    }
    const cashErrors: Record<typeof result.reason, string> = {
      'invalid-request': 'Revisa los datos del pedido.',
      'product-unavailable': 'Algún producto ya no se puede pedir.',
      'commerce-not-configured': 'El pago en la barra no está disponible en este momento.',
      'credit-not-configured': 'Este sitio todavía no tiene habilitado el pago en la barra.',
      'credit-exhausted': 'El cupo de pago en la barra está lleno. Puedes pagar aquí.',
      'overdue-debt': 'El pago en la barra está pausado temporalmente. Puedes pagar aquí.',
      'self-order-not-allowed': 'El equipo del sitio no puede usar el cupo para pedidos propios.',
      'shopper-limit': 'Ya tienes varios pedidos de barra activos. Usa uno o paga aquí.',
      'venue-reservation-limit': 'Hay demasiados pedidos de barra activos. Puedes pagar aquí.',
    }
    return { status: 'error', error: cashErrors[result.reason] }
  } catch {
    return { status: 'error', error: 'No se pudo crear el pedido. Intenta otra vez.' }
  }
}

/** Direct confirmation cannot authenticate a provider and stays fail-closed. */
export const confirmPayment = async (
  _orderId: string,
  _provider: string,
  _providerReference: string
): Promise<{ ok: boolean; error?: string }> => ({
  ok: false,
  error: 'La confirmación directa está deshabilitada. Usa la verificación autoritativa.',
})
