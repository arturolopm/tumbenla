'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

import { Spinner } from '@/components/ui/spinner'

type PaymentState = {
  state: 'checkout' | 'pending' | 'approved' | 'rejected'
  nextUrl?: string
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
    refetchInterval: 3_000,
    retry: false,
  })

  useEffect(() => {
    if (data?.state === 'approved' || data?.state === 'rejected') {
      const mappingKey = `tumbenla:payment-attempt:${attemptId}`
      const serialized = sessionStorage.getItem(mappingKey)
      let rememberedAccount = false
      if (serialized) {
        try {
          const mapping = JSON.parse(serialized) as {
            storageKey?: unknown
            wantsAccount?: unknown
          }
          if (typeof mapping.storageKey === 'string') sessionStorage.removeItem(mapping.storageKey)
          rememberedAccount = mapping.wantsAccount === true
        } catch {
          // A malformed browser-local value is ignored and removed below.
        }
      }
      sessionStorage.removeItem(mappingKey)

      if (data.state === 'approved' && data.nextUrl) {
        const account = wantsAccount || rememberedAccount
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
  return (
    <main
      className='mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-5 px-margin-mobile py-10'
      aria-busy={!rejected}
    >
      {!rejected ? <Spinner aria-hidden='true' className='size-9 text-primary' /> : null}
      <h1 className='font-display font-black text-4xl uppercase leading-none tracking-tighter'>
        {rejected ? 'El cobro no siguió' : 'Estamos verificando'}
      </h1>
      <p role='status' aria-live='polite' className='text-body-lg text-muted-foreground'>
        {rejected
          ? 'No habilitamos ningún código. Puedes volver a la carta e iniciar un pedido nuevo.'
          : 'Tu código aparecerá solo cuando ePayco confirme el cobro directamente. Un PSE pendiente puede tardar un poco.'}
      </p>
      {error ? (
        <p className='text-body-md text-muted-foreground'>
          La consulta falló por ahora. Esto no significa que el pago haya fallado.
        </p>
      ) : null}
      <button
        type='button'
        disabled={isFetching}
        onClick={() => void refetch()}
        className='rounded-xl border border-border px-6 py-3 font-display text-label-lg uppercase disabled:opacity-50'
      >
        {isFetching ? 'Consultando ePayco…' : 'Revisar otra vez'}
      </button>
      <Link
        href='/sitios'
        className='text-center font-display text-label-lg text-primary-text uppercase underline'
      >
        Volver a los sitios
      </Link>
    </main>
  )
}
