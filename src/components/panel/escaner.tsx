'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'

import { type Entrega, redimirAction } from '@/app/actions/escanear'
import { esCodigoValido, normalizarCodigo } from '@/lib/comercio/codigos-cliente'
import { formatCOP } from '@/lib/utils/format'
import { cn } from '@/lib/utils/css'

/**
 * El escaner.
 *
 * TRES CAMINOS HASTA EL MISMO SITIO, y hacen falta los tres:
 *
 *  1. La camara del propio telefono (`BarcodeDetector`), donde exista. Es
 *     Chrome en Android, que es el telefono real de un mesero en Manizales.
 *  2. La camara NATIVA del sistema. El QR lleva una URL a esta misma pantalla
 *     con `?c=`, asi que un iPhone —donde `BarcodeDetector` no existe— apunta
 *     con su camara de siempre, toca la notificacion y cae aca con el codigo ya
 *     puesto. Sale gratis y evita meter una libreria de 40 KB para iOS.
 *  3. TECLEARLO. No es un adorno: bar oscuro, pantalla rayada, lente grasoso,
 *     permiso de camara negado. Es la razon de que el codigo sea de ocho
 *     caracteres legibles y no un UUID.
 *
 * LA CAMARA SE PIDE CON UN BOTON, NO AL ENTRAR. Es el espiritu de la decision
 * 8, que prohibio `navigator.geolocation` justamente por disparar un permiso
 * del sistema antes de haber mostrado nada.
 *
 * Y la pantalla NO DICE NADA antes de escanear. Lo que el mesero necesita
 * —cobrar o entregar— aparece despues, porque saberlo antes le diria cuales
 * puede dejar sin escanear (decision 26).
 */

type Estado =
  | { tipo: 'listo' }
  | { tipo: 'procesando' }
  | { tipo: 'entregado'; entrega: Extract<Entrega, { ok: true }> }
  | { tipo: 'rechazado'; error: string }

// Un id por intento. Distingue "el mesero toco dos veces" de "dos meseros
// escanearon el mismo codigo": el primero es un reintento y tiene que salir
// igual de bien, el segundo es un doble cobro y tiene que fallar.
const nuevoIntento = () => crypto.randomUUID()

export function Escaner({
  venueId,
  nombreDelSitio,
  codigoDeLaUrl,
}: {
  venueId: string
  nombreDelSitio: string
  codigoDeLaUrl: string | null
}) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'listo' })
  const [manual, setManual] = useState('')
  const [camara, setCamara] = useState(false)
  const [hayCamara, setHayCamara] = useState(false)
  const [, startTransition] = useTransition()

  const video = useRef<HTMLVideoElement | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const ultimo = useRef<string>('')

  const entregar = useCallback(
    (codigo: string) => {
      if (!esCodigoValido(codigo)) return
      const limpio = normalizarCodigo(codigo)

      // El mismo codigo dos veces seguidas es la camara leyendo el mismo cuadro
      // treinta veces por segundo, no una entrega nueva.
      if (limpio === ultimo.current) return
      ultimo.current = limpio

      setEstado({ tipo: 'procesando' })
      startTransition(async () => {
        const r = await redimirAction(limpio, venueId, nuevoIntento())
        setEstado(r.ok ? { tipo: 'entregado', entrega: r } : { tipo: 'rechazado', error: r.error })
        setManual('')
        // Se suelta a los pocos segundos para poder reintentar el mismo codigo
        // si de verdad hizo falta.
        setTimeout(() => {
          ultimo.current = ''
        }, 4000)
      })
    },
    [venueId]
  )

  // El codigo que viene en la URL (camara nativa) se procesa solo. Quien llego
  // por ahi ya apunto y toco; pedirle un boton mas seria pedirle dos veces lo
  // mismo.
  useEffect(() => {
    if (codigoDeLaUrl) entregar(codigoDeLaUrl)
  }, [codigoDeLaUrl, entregar])

  useEffect(() => {
    setHayCamara(typeof window !== 'undefined' && 'BarcodeDetector' in window)
  }, [])

  const apagarCamara = useCallback(() => {
    for (const t of stream.current?.getTracks() ?? []) t.stop()
    stream.current = null
    setCamara(false)
  }, [])

  const prenderCamara = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      stream.current = s
      setCamara(true)
      if (video.current) {
        video.current.srcObject = s
        await video.current.play()
      }
    } catch {
      setEstado({
        tipo: 'rechazado',
        error: 'No se pudo abrir la cámara. Escribe el código a mano.',
      })
    }
  }, [])

  // El bucle de lectura. Se apaga solo al desmontar o al cerrar la camara: una
  // camara encendida de fondo se come la bateria del telefono del bar.
  useEffect(() => {
    if (!camara || !hayCamara) return
    let vivo = true

    const leer = async () => {
      // @ts-expect-error BarcodeDetector no esta en lib.dom todavia.
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
      while (vivo) {
        try {
          if (video.current && video.current.readyState >= 2) {
            const codigos = await detector.detect(video.current)
            const crudo = codigos[0]?.rawValue
            if (crudo) {
              // El QR trae una URL con ?c=CODIGO; tambien se acepta el codigo
              // pelado por si alguien imprime uno.
              const m = /[?&]c=([^&]+)/.exec(crudo)
              entregar(m ? decodeURIComponent(m[1]) : crudo)
            }
          }
        } catch {
          // Un cuadro ilegible no es un error que valga la pena mostrar.
        }
        await new Promise((r) => setTimeout(r, 250))
      }
    }

    void leer()
    return () => {
      vivo = false
    }
  }, [camara, hayCamara, entregar])

  useEffect(() => () => apagarCamara(), [apagarCamara])

  return (
    <div className='mx-auto flex max-w-lg flex-col gap-6'>
      <header>
        <h1 className='font-display font-black text-3xl uppercase leading-none tracking-tighter'>
          Escanear
        </h1>
        <p className='mt-2 text-body-md text-muted-foreground'>
          {nombreDelSitio} · Escanea el código ANTES de cobrar. Ahí te dice qué hacer.
        </p>
      </header>

      <Resultado estado={estado} onSeguir={() => setEstado({ tipo: 'listo' })} />

      {camara ? (
        <div className='overflow-hidden rounded-xl border-2 border-party'>
          {/* Vista en vivo de la camara, no un video con dialogo: no hay nada
              que subtitular. */}
          <video ref={video} className='w-full' playsInline muted />
          <button
            type='button'
            onClick={apagarCamara}
            className='w-full border-border border-t px-4 py-3 font-display text-label-lg uppercase'
          >
            Apagar la cámara
          </button>
        </div>
      ) : hayCamara ? (
        <button
          type='button'
          onClick={prenderCamara}
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
        onSubmit={(e) => {
          e.preventDefault()
          entregar(manual)
        }}
        className='flex flex-col gap-2'
      >
        <label htmlFor='codigo' className='font-display text-label-lg uppercase'>
          O escríbelo
        </label>
        <div className='flex gap-2'>
          <input
            id='codigo'
            value={manual}
            onChange={(e) => setManual(e.target.value.toUpperCase())}
            placeholder='XXXX-XXXX'
            autoComplete='off'
            autoCapitalize='characters'
            spellCheck={false}
            className='w-full rounded-lg border border-border bg-background px-3 py-3 font-mono text-lg tracking-[0.2em] text-street-white uppercase focus:border-primary focus:outline-none'
          />
          <button
            type='submit'
            disabled={!esCodigoValido(manual)}
            className='whitespace-nowrap rounded-lg bg-primary px-5 font-display text-label-lg text-primary-foreground uppercase disabled:opacity-40'
          >
            Buscar
          </button>
        </div>
      </form>
    </div>
  )
}

function Resultado({ estado, onSeguir }: { estado: Estado; onSeguir: () => void }) {
  if (estado.tipo === 'listo') {
    return (
      <div className='rounded-xl border border-border border-dashed p-6 text-center'>
        <p className='text-body-md text-muted-foreground'>Apunta al código del cliente.</p>
      </div>
    )
  }

  if (estado.tipo === 'procesando') {
    return (
      <div className='rounded-xl border border-border p-6 text-center'>
        <p className='font-display text-label-lg uppercase'>Un momento…</p>
      </div>
    )
  }

  if (estado.tipo === 'rechazado') {
    return (
      <button
        type='button'
        onClick={onSeguir}
        className='w-full rounded-xl border-2 border-destructive bg-destructive/10 p-6 text-left'
      >
        <p className='font-display font-black text-2xl uppercase text-destructive-foreground'>No</p>
        <p className='mt-1 text-body-lg'>{estado.error}</p>
        <p className='mt-3 text-muted-foreground text-sm'>Toca para seguir.</p>
      </button>
    )
  }

  const { entrega } = estado
  const cobrar = entrega.cobrar

  // LAS DOS UNICAS COSAS QUE PUEDE DECIR, y grandes: el mesero las lee de reojo
  // con una mano ocupada. El color hace la mitad del trabajo.
  return (
    <button
      type='button'
      onClick={onSeguir}
      className={cn(
        'w-full rounded-xl border-2 p-6 text-left',
        cobrar === null ? 'border-lime bg-lime/10' : 'border-party bg-party/10'
      )}
    >
      {cobrar === null ? (
        <>
          <p className='font-display font-black text-3xl uppercase text-lime'>Ya pagado</p>
          <p className='mt-1 text-body-lg'>Entrégalo.</p>
        </>
      ) : (
        <>
          <p className='font-display font-black text-3xl uppercase text-party'>
            Cobrar {formatCOP(cobrar)}
          </p>
          <p className='mt-1 text-body-lg'>Cobra y entrégalo.</p>
        </>
      )}

      <p className='mt-3 text-body-lg'>{entrega.producto}</p>
      <p className='text-body-md text-muted-foreground'>
        {entrega.comprador}
        {entrega.cantidadDeLaOrden > 1
          ? ` · ${entrega.entregadas} de ${entrega.cantidadDeLaOrden} del pedido`
          : null}
      </p>
      <p className='mt-3 text-muted-foreground text-sm'>Toca para seguir.</p>
    </button>
  )
}
