'use client'

import {
  BanknoteIcon,
  CheckCircle2Icon,
  HistoryIcon,
  RotateCcwIcon,
  ScanLineIcon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'

import { type Entrega, redimirAction } from '@/app/actions/escanear'
import { esCodigoValido, normalizarCodigo } from '@/lib/comercio/codigos-cliente'
import type { RecentVenueOrder } from '@/lib/commerce/redemption-history-types'
import { cn } from '@/lib/utils/css'
import { formatCOP } from '@/lib/utils/format'

type ScannerState =
  | { kind: 'ready' }
  | { kind: 'processing' }
  | { kind: 'delivered'; delivery: Extract<Entrega, { ok: true }> }
  | { kind: 'rejected'; error: string }

const dateTime = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/Bogota',
})

// One key per attempt. This distinguishes a repeated network request from a
// genuinely separate scan of the same code.
const createAttemptId = () => {
  const browserCrypto = globalThis.crypto
  if (typeof browserCrypto?.randomUUID === 'function') return browserCrypto.randomUUID()

  if (typeof browserCrypto?.getRandomValues === 'function') {
    const bytes = browserCrypto.getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }

  return `attempt-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * The bar's fastest screen: scan, learn whether to collect, and finish.
 *
 * The camera, native-camera URL, and manual code all converge on the same
 * action. Payment method remains hidden until the code has been redeemed, as
 * required by product decisions 26 and 27.
 */
export function OrderScanner({
  venueId,
  venueName,
  codeFromUrl,
  recentOrders,
}: {
  venueId: string
  venueName: string
  codeFromUrl: string | null
  recentOrders: RecentVenueOrder[]
}) {
  const router = useRouter()
  const [state, setState] = useState<ScannerState>({ kind: 'ready' })
  const [manualCode, setManualCode] = useState('')
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraSupported, setCameraSupported] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [, startTransition] = useTransition()

  const video = useRef<HTMLVideoElement | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const lastCode = useRef('')

  const deliver = useCallback(
    (code: string) => {
      if (!esCodigoValido(code)) return
      const normalized = normalizarCodigo(code)

      // A detector sees the same QR in many consecutive frames. Only the first
      // frame is a delivery attempt.
      if (normalized === lastCode.current) return
      lastCode.current = normalized

      setState({ kind: 'processing' })
      startTransition(async () => {
        const result = await redimirAction(normalized, venueId, createAttemptId())
        setState(
          result.ok
            ? { kind: 'delivered', delivery: result }
            : { kind: 'rejected', error: result.error }
        )
        setManualCode('')
        if (result.ok) router.refresh()

        setTimeout(() => {
          lastCode.current = ''
        }, 4000)
      })
    },
    [router, venueId]
  )

  // A native phone camera already required an intentional scan and tap, so a
  // second confirmation button here would add no safety.
  useEffect(() => {
    if (codeFromUrl) deliver(codeFromUrl)
  }, [codeFromUrl, deliver])

  useEffect(() => {
    setCameraSupported(typeof window !== 'undefined' && 'BarcodeDetector' in window)
  }, [])

  const stopCamera = useCallback(() => {
    for (const track of stream.current?.getTracks() ?? []) track.stop()
    stream.current = null
    setCameraOn(false)
  }, [])

  const startCamera = useCallback(async () => {
    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      stream.current = nextStream
      setCameraOn(true)
      if (video.current) {
        video.current.srcObject = nextStream
        await video.current.play()
      }
    } catch {
      setState({
        kind: 'rejected',
        error: 'No se pudo abrir la cámara. Escribe el código a mano.',
      })
    }
  }, [])

  useEffect(() => {
    if (!cameraOn || !cameraSupported) return
    let active = true

    const read = async () => {
      // @ts-expect-error BarcodeDetector is not part of lib.dom yet.
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
      while (active) {
        try {
          if (video.current && video.current.readyState >= 2) {
            const codes = await detector.detect(video.current)
            const raw = codes[0]?.rawValue
            if (raw) {
              const match = /[?&]c=([^&]+)/.exec(raw)
              deliver(match ? decodeURIComponent(match[1]) : raw)
            }
          }
        } catch {
          // An unreadable frame is expected in a moving camera feed.
        }
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
    }

    void read()
    return () => {
      active = false
    }
  }, [cameraOn, cameraSupported, deliver])

  useEffect(() => () => stopCamera(), [stopCamera])

  return (
    <div className='mx-auto flex max-w-lg flex-col gap-6'>
      <header className='flex items-start justify-between gap-4'>
        <div>
          <h1 className='font-display font-black text-3xl uppercase leading-none tracking-tighter'>
            Escanear
          </h1>
          <p className='mt-2 text-body-md text-muted-foreground'>
            {venueName} · Escanea el código antes de cobrar. Ahí te dice qué hacer.
          </p>
        </div>
        <button
          type='button'
          onClick={() => setHistoryOpen((open) => !open)}
          aria-expanded={historyOpen}
          aria-controls='historial-de-ordenes'
          className='inline-flex shrink-0 items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
        >
          <HistoryIcon className='size-4' />
          Historial
        </button>
      </header>

      {historyOpen ? <RecentOrders orders={recentOrders} /> : null}

      <ScannerResult state={state} onContinue={() => setState({ kind: 'ready' })} />

      {cameraOn ? (
        <div className='overflow-hidden rounded-xl border-2 border-party'>
          <video ref={video} className='w-full' playsInline muted />
          <button
            type='button'
            onClick={stopCamera}
            className='w-full border-border border-t px-4 py-3 font-display text-label-lg uppercase'
          >
            Apagar la cámara
          </button>
        </div>
      ) : cameraSupported ? (
        <button
          type='button'
          onClick={startCamera}
          className='rounded-xl bg-primary px-6 py-4 font-display text-label-lg text-primary-foreground uppercase'
        >
          Prender la cámara
        </button>
      ) : (
        <p className='rounded-xl border border-border p-4 text-body-md text-muted-foreground'>
          Este navegador no lee códigos por dentro. Usa la cámara normal del teléfono: apunta al
          código y te trae aquí solo.
        </p>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault()
          deliver(manualCode)
        }}
        className='flex flex-col gap-2'
      >
        <label htmlFor='codigo' className='font-display text-label-lg uppercase'>
          O escríbelo
        </label>
        <div className='flex gap-2'>
          <input
            id='codigo'
            value={manualCode}
            onChange={(event) => setManualCode(event.target.value.toUpperCase())}
            placeholder='XXXX-XXXX'
            autoComplete='off'
            autoCapitalize='characters'
            spellCheck={false}
            className='w-full rounded-lg border border-border bg-background px-3 py-3 font-mono text-lg tracking-[0.2em] text-street-white uppercase focus:border-primary focus:outline-none'
          />
          <button
            type='submit'
            disabled={!esCodigoValido(manualCode)}
            className='whitespace-nowrap rounded-lg bg-primary px-5 font-display text-label-lg text-primary-foreground uppercase disabled:opacity-40'
          >
            Buscar
          </button>
        </div>
      </form>
    </div>
  )
}

function ScannerResult({ state, onContinue }: { state: ScannerState; onContinue: () => void }) {
  if (state.kind === 'ready') {
    return (
      <div className='rounded-xl border border-border border-dashed p-6 text-center'>
        <ScanLineIcon className='mx-auto mb-2 size-6 text-muted-foreground' />
        <p className='text-body-md text-muted-foreground'>Apunta al código del cliente.</p>
      </div>
    )
  }

  if (state.kind === 'processing') {
    return (
      <div className='rounded-xl border border-border p-6 text-center'>
        <p className='font-display text-label-lg uppercase'>Registrando la orden…</p>
      </div>
    )
  }

  if (state.kind === 'rejected') {
    return (
      <button
        type='button'
        onClick={onContinue}
        className='w-full rounded-xl border-2 border-destructive bg-destructive/10 p-6 text-left motion-safe:animate-[scanner-result-enter_220ms_cubic-bezier(0.22,1,0.36,1)]'
      >
        <p className='font-display font-black text-2xl text-destructive-foreground uppercase'>
          No se registró
        </p>
        <p className='mt-1 text-body-lg'>{state.error}</p>
        <p className='mt-4 inline-flex items-center gap-2 font-medium text-sm'>
          <RotateCcwIcon className='size-4' />
          Toca para volver al escáner
        </p>
      </button>
    )
  }

  const { delivery } = state
  const chargeAtBar = delivery.cobrar !== null
  const units =
    delivery.cantidadAEntregar > 1
      ? `${delivery.cantidadAEntregar} unidades de ${delivery.producto}`
      : delivery.producto

  return (
    <button
      type='button'
      onClick={onContinue}
      className={cn(
        'w-full rounded-xl border-2 p-6 text-left motion-safe:animate-[scanner-result-enter_220ms_cubic-bezier(0.22,1,0.36,1)]',
        chargeAtBar ? 'border-party bg-party/10' : 'border-lime bg-lime/10'
      )}
    >
      <div className='flex items-start gap-3'>
        {chargeAtBar ? (
          <BanknoteIcon className='mt-1 size-7 shrink-0 text-party' />
        ) : (
          <CheckCircle2Icon className='mt-1 size-7 shrink-0 text-lime' />
        )}
        <div>
          {chargeAtBar ? (
            <>
              <p className='font-display font-black text-3xl text-party uppercase'>
                Cobra en la barra {formatCOP(delivery.cobrar ?? 0)}
              </p>
              <p className='mt-2 text-body-lg'>
                Este pedido no está pagado. Cobra el total aquí y entrega {units}.
              </p>
            </>
          ) : (
            <>
              <p className='font-display font-black text-3xl text-lime uppercase'>Ya pagado</p>
              <p className='mt-2 text-body-lg'>No cobres nada. Entrega {units}.</p>
            </>
          )}
        </div>
      </div>

      <p className='mt-4 text-body-md text-muted-foreground'>A nombre de {delivery.comprador}.</p>

      <div className='mt-5 rounded-lg border border-current/20 bg-background/30 p-3'>
        <p className='flex items-center gap-2 font-medium text-sm'>
          <CheckCircle2Icon className='size-4' />
          Orden registrada. En Tumbenla ya quedó todo listo.
        </p>
      </div>

      <p className='mt-4 inline-flex items-center gap-2 font-medium text-sm'>
        <RotateCcwIcon className='size-4' />
        Toca para registrar otra orden
      </p>
    </button>
  )
}

function RecentOrders({ orders }: { orders: RecentVenueOrder[] }) {
  return (
    <section
      id='historial-de-ordenes'
      aria-label='Últimas órdenes registradas'
      className='rounded-xl border border-border bg-card p-4'
    >
      <div className='flex items-baseline justify-between gap-3'>
        <h2 className='font-display font-bold text-lg uppercase'>Últimas órdenes</h2>
        <span className='text-muted-foreground text-xs'>Las 10 más recientes</span>
      </div>

      {orders.length === 0 ? (
        <p className='mt-3 text-body-md text-muted-foreground'>
          Todavía no hay órdenes registradas en este sitio.
        </p>
      ) : (
        <ol className='mt-3 divide-y divide-border'>
          {orders.map((order) => (
            <li
              key={order.id}
              className='flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0'
            >
              <div className='min-w-0'>
                <p className='font-medium'>
                  {order.quantity > 1 ? `${order.quantity} × ` : ''}
                  {order.productName}
                </p>
                <p className='truncate text-muted-foreground text-sm'>{order.buyerName}</p>
                <p className='mt-0.5 text-xs'>
                  {order.chargeAtBar === null
                    ? 'Ya estaba pagado'
                    : `Cobrado en la barra: ${formatCOP(order.chargeAtBar)}`}
                </p>
              </div>
              <time
                dateTime={order.redeemedAt}
                className='shrink-0 text-right text-muted-foreground text-xs'
              >
                {dateTime.format(new Date(order.redeemedAt))}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
