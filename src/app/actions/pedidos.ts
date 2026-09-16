'use server'

import { headers } from 'next/headers'
import { z } from 'zod'

import { env } from '@/config/env'
import { db } from '@/database'
import { auth } from '@/lib/auth/auth'
import { productoPublicoPorSlug } from '@/lib/comercio/queries'
import { PAY_METHODS } from '@/lib/comercio/types'
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

/**
 * Pedir un trago.
 *
 * SE COMPRA SIN CUENTA (decision 29). Nombre y correo, nada mas. Si hay sesion
 * la orden se amarra a ella y sale en /mi-historia, pero un registro con
 * verificacion por correo entre la persona y el trago —parada en una barra, con
 * mala senal y gente esperando— es donde se pierde la venta.
 *
 * TODA ORDEN LLEVA QR, pagada aca o pagada en la barra, y el mesero no puede
 * distinguirlas hasta despues de escanear (decision 26). De ahi sale la unica
 * diferencia real entre los dos caminos en este archivo: cuando se emiten los
 * codigos.
 *
 *   pago en la barra  →  los codigos existen YA, porque el QR tiene que poder
 *                        escanearse para que el mesero sepa que preparar y
 *                        cuanto cobrar. El escaneo es lo que cobra.
 *   pago aca          →  los codigos se emiten cuando el pago confirma. Antes
 *                        de eso no hay nada que entregar.
 */

export type PedidoState =
  | { status: 'idle' }
  | { status: 'error'; error: string; fieldErrors?: Record<string, string[]> }
  | { status: 'success'; token: string; url: string }

const MAX_UNIDADES = 20

const pedidoSchema = z.object({
  venueSlug: z.string().min(1),
  productoSlug: z.string().min(1),
  buyerName: z.string().trim().min(2, 'Escribe tu nombre').max(80),
  buyerEmail: z.email('Ese correo no se ve bien'),
  quantity: z.coerce
    .number()
    .int()
    .min(1, 'Al menos uno')
    .max(MAX_UNIDADES, `Máximo ${MAX_UNIDADES} de una`),
  payMethod: z.enum(PAY_METHODS),
  submissionKey: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
  // Solo dice si le OFRECEMOS terminar la cuenta al llegar al QR. No cambia
  // nada del pedido: el pedido se crea igual, con cuenta o sin ella.
  quiereCuenta: z.enum(['0', '1']).optional(),
})

export const crearPedidoAction = async (
  _previous: PedidoState,
  formData: FormData
): Promise<PedidoState> => {
  if (!commerceNewOperationsEnabled()) {
    return {
      status: 'error',
      error:
        'Los pedidos nuevos están pausados. Los pagos y pedidos existentes siguen en revisión.',
    }
  }
  const parsed = pedidoSchema.safeParse({
    venueSlug: formData.get('venueSlug'),
    productoSlug: formData.get('productoSlug'),
    buyerName: formData.get('buyerName'),
    buyerEmail: formData.get('buyerEmail'),
    quantity: formData.get('quantity'),
    payMethod: formData.get('payMethod'),
    submissionKey: formData.get('submissionKey'),
    quiereCuenta: formData.get('quiereCuenta') ?? undefined,
  })

  if (!parsed.success) {
    return {
      status: 'error',
      error: 'Revisa los campos marcados.',
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    }
  }

  const requestHeaders = await headers()
  const address =
    requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    requestHeaders.get('x-real-ip')?.trim() ||
    'unknown-address'
  const rate = await commerceRateLimits.consume({
    scope: parsed.data.payMethod === 'bar' ? 'cash_reservation' : 'checkout',
    key: `${address}:${parsed.data.buyerEmail.trim().toLowerCase()}:${parsed.data.venueSlug}`,
    limit: parsed.data.payMethod === 'bar' ? 12 : 30,
    windowSeconds: 10 * 60,
  })
  if (!rate.allowed) {
    return {
      status: 'error',
      error: 'Hay demasiados intentos seguidos. Espera unos minutos antes de volver a pedir.',
    }
  }

  // EL PRECIO Y EL REPARTO SALEN DE LA BASE, NUNCA DEL FORMULARIO. Es la misma
  // familia que el venueId de multi-tenencia: si el monto viniera del cliente,
  // cualquiera pediria un trago de treinta mil por mil.
  const producto = await productoPublicoPorSlug(parsed.data.venueSlug, parsed.data.productoSlug)

  // null tambien cuando esta en borrador, en revision, pausado o archivado, o
  // cuando el sitio no esta publicado. Pegarle directo a la URL no sirve de
  // nada: esconder el boton no es la proteccion (decision 31).
  if (!producto) {
    return { status: 'error', error: 'Ese producto ya no se puede pedir.' }
  }

  // La sesion AGREGA: amarra la orden a la cuenta para que salga en
  // /mi-historia. No hace falta para comprar (decision 2).
  const sesion = await auth.api.getSession({ headers: requestHeaders })

  // Se ofrece la cuenta solo si la pidio Y no tiene sesion ya.
  const sufijoDeCuenta = parsed.data.quiereCuenta === '1' && !sesion ? '?cuenta=1' : ''

  try {
    if (parsed.data.payMethod === 'app') {
      const result = await createCommercePaymentService().startPayment({
        submissionKey: parsed.data.submissionKey,
        productId: producto.id,
        buyerName: parsed.data.buyerName,
        buyerEmail: parsed.data.buyerEmail,
        quantity: parsed.data.quantity,
        userId: sesion?.user?.id ?? null,
      })

      if (result.kind === 'checkout') {
        return {
          status: 'success',
          token: result.orderToken,
          url: `/pago/iniciar/${result.attemptId}${sufijoDeCuenta}`,
        }
      }
      if (result.kind === 'approved') {
        return {
          status: 'success',
          token: result.orderToken,
          url: `/orden/${result.orderToken}${sufijoDeCuenta}`,
        }
      }
      if (result.kind === 'pending') {
        return {
          status: 'success',
          token: result.orderToken,
          url: `/pago/estado/${result.attemptId}${sufijoDeCuenta}`,
        }
      }
      if (result.kind === 'checkout-unavailable') {
        return {
          status: 'success',
          token: result.orderToken,
          url: `/pago/estado/${result.attemptId}${sufijoDeCuenta}`,
        }
      }
      if (result.kind === 'conflict') {
        return {
          status: 'error',
          error: 'Este intento ya corresponde a otro pedido. Recarga la página e intenta otra vez.',
        }
      }
      if (result.kind === 'rejected') {
        return {
          status: 'error',
          error: 'El cobro no pudo iniciarse. No se hizo un segundo intento automático.',
        }
      }
      return {
        status: 'error',
        error:
          result.reason === 'product-unavailable'
            ? 'Ese producto ya no se puede pedir.'
            : 'El pago en línea no está disponible en este momento.',
      }
    }

    if (parsed.data.payMethod === 'bar') {
      const result = await cashCredit.startOrder({
        submissionKey: parsed.data.submissionKey,
        productId: producto.id,
        buyerName: parsed.data.buyerName,
        buyerEmail: parsed.data.buyerEmail,
        quantity: parsed.data.quantity,
        userId: sesion?.user?.id ?? null,
      })
      if (result.kind === 'reserved') {
        if (!result.duplicate) {
          try {
            await notifyApprovedOrder({ orderId: result.orderId, codes: result.codes })
          } catch {
            // Se pierde el correo, no el pedido ni su reserva.
          }
        }
        return {
          status: 'success',
          token: result.orderToken,
          url: `/orden/${result.orderToken}${sufijoDeCuenta}`,
        }
      }
      if (result.kind === 'conflict') {
        return {
          status: 'error',
          error: 'Este intento ya corresponde a otro pedido. Recarga la página e intenta otra vez.',
        }
      }
      const cashErrors: Record<typeof result.reason, string> = {
        'invalid-request': 'Revisa los datos del pedido.',
        'product-unavailable': 'Ese producto ya no se puede pedir.',
        'commerce-not-configured': 'El pago en la barra no está disponible en este momento.',
        'credit-not-configured': 'Este sitio todavía no tiene habilitado el pago en la barra.',
        'credit-exhausted': 'El cupo de pago en la barra está lleno. Puedes pagar aquí.',
        'overdue-debt': 'El pago en la barra está pausado temporalmente. Puedes pagar aquí.',
        'self-order-not-allowed': 'El equipo del sitio no puede usar el cupo para pedidos propios.',
        'shopper-limit': 'Ya tienes varios pedidos de barra activos. Usa uno o paga aquí.',
        'venue-reservation-limit': 'Hay demasiados pedidos de barra activos. Puedes pagar aquí.',
      }
      return { status: 'error', error: cashErrors[result.reason] }
    }

    return { status: 'error', error: 'El método de pago no está disponible.' }
  } catch {
    return { status: 'error', error: 'No se pudo crear el pedido. Intenta otra vez.' }
  }
}

/** Compatibility export for the old concurrency script. Direct confirmation
 * cannot authenticate a provider and is permanently fail-closed. */
export const confirmarPago = async (
  _orderId: string,
  _provider: string,
  _providerReference: string
): Promise<{ ok: boolean; error?: string }> => {
  return {
    ok: false,
    error: 'La confirmación directa está deshabilitada. Usa la verificación autoritativa.',
  }
}
