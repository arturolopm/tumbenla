'use client'

import Script from 'next/script'
import { useRouter } from 'next/navigation'
import { useCallback, useRef, useState } from 'react'

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
  const [message, setMessage] = useState('Cargando el pago seguro…')
  const [ready, setReady] = useState(false)
  const stateUrl = `/pago/estado/${attemptId}${wantsAccount ? '?cuenta=1' : ''}`

  const open = useCallback(() => {
    if (!window.ePayco) {
      setMessage('No pudimos cargar el pago seguro. Revisa tu conexión e intenta otra vez.')
      return
    }

    if (!checkout.current) {
      checkout.current = window.ePayco.checkout.configure({
        sessionId,
        type: 'onpage',
        test: testMode,
      })
      checkout.current.setHooks({
        onCreated: () => setMessage('El pago seguro está listo.'),
        onResponse: (response) => {
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
        onClosed: () => router.replace(stateUrl),
        onErrors: () =>
          setMessage('ePayco reportó un problema. No iniciaremos otro cobro automáticamente.'),
      })
    }
    checkout.current.open()
  }, [router, sessionId, stateUrl, testMode, wantsAccount])

  return (
    <main className='mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-5 px-margin-mobile py-10'>
      <Script
        src={scriptUrl}
        strategy='afterInteractive'
        onLoad={() => {
          setReady(true)
          open()
        }}
        onError={() =>
          setMessage('No pudimos cargar el pago seguro. Revisa tu conexión e intenta otra vez.')
        }
      />
      <h1 className='font-display font-black text-4xl uppercase leading-none tracking-tighter'>
        Pago seguro
      </h1>
      <p role='status' aria-live='polite' className='text-body-lg text-muted-foreground'>
        {message}
      </p>
      <button
        type='button'
        disabled={!ready}
        onClick={open}
        className='rounded-xl bg-primary px-6 py-4 font-display text-label-lg text-primary-foreground uppercase disabled:opacity-50'
      >
        Abrir ePayco
      </button>
      <button
        type='button'
        onClick={() => router.replace(stateUrl)}
        className='rounded-xl border border-border px-6 py-3 font-display text-label-lg uppercase'
      >
        Revisar estado
      </button>
      <p className='text-muted-foreground text-sm'>
        Cerrar esta ventana no confirma ni cancela el cobro. Tumbenla habilita tu código solo
        después de verificarlo directamente con ePayco.
      </p>
    </main>
  )
}
