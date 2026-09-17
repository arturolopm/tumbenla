'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import { Spinner } from '@/components/ui/spinner'
import { barCartStore } from '@/lib/cart/cart-store'

type PaymentState = {
  state: 'checkout' | 'pending' | 'approved' | 'rejected' | 'checkout-unavailable'
  nextUrl?: string
  reason?: string
}

type AttemptMapping = {
  venueId: string
  cartFingerprint: string
  wantsAccount: boolean
}

const takeAttemptMapping = (attemptId: string): AttemptMapping | null => {
  const mappingKey = `tumbenla:payment-attempt:${attemptId}`
  const serialized = sessionStorage.getItem(mappingKey)
  let mapping: AttemptMapping | null = null
  if (serialized) {
    try {
      const parsed = JSON.parse(serialized) as {
        venueId?: unknown
        cartFingerprint?: unknown
        wantsAccount?: unknown
      }
      if (typeof parsed.venueId === 'string' && typeof parsed.cartFingerprint === 'string') {
        mapping = {
          venueId: parsed.venueId,
          cartFingerprint: parsed.cartFingerprint,
          wantsAccount: parsed.wantsAccount === true,
        }
      }
    } catch {
      // A malformed browser-local value is ignored and removed below.
    }
  }
  sessionStorage.removeItem(mappingKey)
  return mapping
}

const readState = async (url: string): Promise<PaymentState> => {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) throw new Error('No se pudo consultar el estado')
  return response.json() as Promise<PaymentState>
}

export function PaymentStateWatcher({
  attemptId,
  wantsAccount,
  initialState,
}: {
  attemptId: string
  wantsAccount: boolean
  initialState?: PaymentState
}) {
  const router = useRouter()
  const endpoint = `/api/comercio/pagos/${attemptId}/estado${wantsAccount ? '?cuenta=1' : ''}`
  const { data, error, isFetching, refetch } = useQuery({
    queryKey: ['commerce-payment', attemptId, wantsAccount],
    queryFn: () => readState(endpoint),
    initialData: initialState,
    refetchInterval: (query) =>
      (query.state.data as PaymentState | undefined)?.state === 'pending' ? 3_000 : false,
    retry: false,
  })

  useEffect(() => {
    if (
      data?.state === 'approved' ||
      data?.state === 'rejected' ||
      data?.state === 'checkout-unavailable'
    ) {
      const mapping = takeAttemptMapping(attemptId)
      if (mapping) {
        if (data.state === 'approved') {
          barCartStore.getState().clearVenueCart(mapping.venueId, mapping.cartFingerprint)
        } else {
          const current = barCartStore.getState().getCart(mapping.venueId)
          if (current?.fingerprint === mapping.cartFingerprint) {
            barCartStore.getState().rotateSubmissionKey(mapping.venueId)
          }
        }
      }

      if (data.state === 'approved' && data.nextUrl) {
        const account = wantsAccount || mapping?.wantsAccount === true
        router.replace(
          `${data.nextUrl}${account && !data.nextUrl.includes('?') ? '?cuenta=1' : ''}`
        )
      }
      return
    }
    if (data?.nextUrl && data.state === 'checkout') {
      router.replace(data.nextUrl)
    }
  }, [attemptId, data, router, wantsAccount])

  const rejected = data?.state === 'rejected'
  const checkoutUnavailable = data?.state === 'checkout-unavailable'
  const providerAmountLimit = checkoutUnavailable && data.reason === 'provider-amount-limit'
  const pending = !rejected && !checkoutUnavailable

  const retryCheckout = () => {
    takeAttemptMapping(attemptId)
    window.location.assign(data?.nextUrl ?? '/sitios')
  }

  return (
    <main
      className='mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-5 px-margin-mobile py-10'
      aria-busy={pending}
    >
      {pending ? <Spinner aria-hidden='true' className='size-9 text-primary' /> : null}
      <h1 className='font-display font-black text-4xl uppercase leading-none tracking-tighter'>
        {checkoutUnavailable
          ? 'ePayco no abrió'
          : rejected
            ? 'El cobro no siguió'
            : 'Estamos verificando'}
      </h1>
      <p role='status' aria-live='polite' className='text-body-lg text-muted-foreground'>
        {providerAmountLimit
          ? 'ePayco rechazó este total por un límite actual de la cuenta de pagos. Tumbenla no limita el valor de tu pedido y no se inició ningún cobro. Vuelve al producto para elegir otro medio de pago.'
          : checkoutUnavailable
            ? 'No recibimos una sesión de pago y no se inició ningún cobro. Vuelve al producto para intentarlo de nuevo.'
            : rejected
              ? 'No habilitamos ningún código. Puedes volver a la carta e iniciar un pedido nuevo.'
              : 'Tu código aparecerá solo cuando ePayco confirme el cobro directamente. Un PSE pendiente puede tardar un poco.'}
      </p>
      {error && pending ? (
        <p className='text-body-md text-muted-foreground'>
          La consulta falló por ahora. Esto no significa que el pago haya fallado.
        </p>
      ) : null}
      {checkoutUnavailable ? (
        <button
          type='button'
          onClick={retryCheckout}
          className='rounded-xl bg-primary px-6 py-4 font-display text-label-lg text-primary-foreground uppercase'
        >
          {providerAmountLimit ? 'Volver y elegir cómo pagar' : 'Volver e intentar de nuevo'}
        </button>
      ) : pending ? (
        <button
          type='button'
          disabled={isFetching || rejected}
          onClick={() => void refetch()}
          className='rounded-xl border border-border px-6 py-3 font-display text-label-lg uppercase disabled:opacity-50'
        >
          {isFetching ? 'Consultando ePayco…' : 'Revisar otra vez'}
        </button>
      ) : null}
      <Link
        href='/sitios'
        className='text-center font-display text-label-lg text-primary-text uppercase underline'
      >
        Volver a los sitios
      </Link>
    </main>
  )
}
