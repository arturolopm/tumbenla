'use client'

import Script from 'next/script'
import { useRouter } from 'next/navigation'
import { useCallback, useRef, useState } from 'react'

import { Spinner } from '@/components/ui/spinner'

type CheckoutHooks = {
  onCreated?: (data: unknown) => void
  onResponse?: (data: unknown) => void
  onClosed?: (errors?: unknown) => void
  onErrors?: (error: unknown) => void
}

type EpaycoCheckout = {
  setHooks: (hooks: CheckoutHooks) => void
  open: () => void
}

declare global {
  interface Window {
    ePayco?: {
      checkout: {
        configure: (config: {
          sessionId: string
          type: 'onpage' | 'standard'
          test: boolean
        }) => EpaycoCheckout
      }
    }
  }
}

const providerReference = (value: unknown): string | undefined => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  const reference = record.ref_payco ?? record.x_ref_payco
  return typeof reference === 'string' && reference.length > 0 ? reference : undefined
}

export function EpaycoCheckoutLauncher({
  attemptId,
  sessionId,
  scriptUrl,
  testMode,
  wantsAccount,
}: {
  attemptId: string
  sessionId: string
  scriptUrl: string
  testMode: boolean
  wantsAccount: boolean
}) {
  const router = useRouter()
  const checkout = useRef<EpaycoCheckout | null>(null)
  const responseReceived = useRef(false)
  const [message, setMessage] = useState('Cargando el pago seguro…')
  const [ready, setReady] = useState(false)
  const [phase, setPhase] = useState<
    'loading' | 'opening' | 'open' | 'verifying' | 'closed' | 'error'
  >('loading')
  const stateUrl = `/pago/estado/${attemptId}${wantsAccount ? '?cuenta=1' : ''}`

  const open = useCallback(() => {
    if (!window.ePayco) {
      setPhase('error')
      setMessage('No pudimos cargar el pago seguro. Revisa tu conexión e intenta otra vez.')
      return
    }

    setPhase('opening')
    setMessage('Abriendo ePayco…')
    if (!checkout.current) {
      checkout.current = window.ePayco.checkout.configure({
        sessionId,
        type: 'onpage',
        test: testMode,
      })
      checkout.current.setHooks({
        onCreated: () => {
          setPhase('open')
          setMessage('ePayco está abierto. Completa allí los datos del medio de pago.')
        },
        onResponse: (response) => {
          responseReceived.current = true
          setPhase('verifying')
          setMessage('Recibimos la respuesta. Estamos verificando el cobro con ePayco…')
          const reference = providerReference(response)
          if (reference) {
            window.location.assign(
              `/pago/respuesta?ref_payco=${encodeURIComponent(reference)}${wantsAccount ? '&cuenta=1' : ''}`
            )
          } else {
            router.replace(stateUrl)
          }
        },
        onClosed: () => {
          if (responseReceived.current) return
          setPhase('closed')
          setMessage(
            'Cerraste ePayco. Puedes volver a abrir esta misma sesión sin crear otro pedido ni otro cobro.'
          )
        },
        onErrors: () => {
          setPhase('error')
          setMessage(
            'ePayco reportó un problema. Puedes volver a abrir esta misma sesión; no crearemos un cobro duplicado.'
          )
        },
      })
    }
    checkout.current.open()
  }, [router, sessionId, stateUrl, testMode, wantsAccount])

  const loading = phase === 'loading' || phase === 'opening' || phase === 'verifying'
  const checkoutOpen = phase === 'open'

  return (
    <main
      className='mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-5 px-margin-mobile py-10'
      aria-busy={loading || checkoutOpen}
    >
      <Script
        src={scriptUrl}
        strategy='afterInteractive'
        onLoad={() => {
          setReady(true)
          open()
        }}
        onError={() => {
          setReady(false)
          setPhase('error')
          setMessage('No pudimos cargar el pago seguro. Revisa tu conexión e intenta otra vez.')
        }}
      />
      <h1 className='font-display font-black text-4xl uppercase leading-none tracking-tighter'>
        Pago seguro
      </h1>
      <div className='rounded-2xl border border-primary/30 bg-primary/5 p-5'>
        {loading ? <Spinner aria-hidden='true' className='mb-4 size-8 text-primary' /> : null}
        <p role='status' aria-live='polite' className='text-body-lg text-street-white'>
          {message}
        </p>
      </div>
      <button
        type='button'
        disabled={!ready || loading || checkoutOpen}
        onClick={open}
        className='rounded-xl bg-primary px-6 py-4 font-display text-label-lg text-primary-foreground uppercase disabled:opacity-50'
      >
        {phase === 'loading'
          ? 'Cargando ePayco…'
          : phase === 'opening'
            ? 'Abriendo ePayco…'
            : phase === 'verifying'
              ? 'Verificando cobro…'
              : checkoutOpen
                ? 'ePayco está abierto'
                : 'Abrir ePayco'}
      </button>
      <button
        type='button'
        disabled={loading || checkoutOpen}
        onClick={() => router.replace(stateUrl)}
        className='rounded-xl border border-border px-6 py-3 font-display text-label-lg uppercase disabled:opacity-50'
      >
        Revisar estado
      </button>
      <p className='text-muted-foreground text-sm'>
        Cerrar esta ventana no confirma ni cancela el cobro. El botón vuelve a abrir la misma sesión
        y Tumbenla habilita tu código solo después de verificarlo directamente con ePayco.
      </p>
    </main>
  )
}
