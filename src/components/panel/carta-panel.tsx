'use client'

import { PauseIcon, PlayIcon, PencilIcon, ArchiveIcon, SendIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useMemo, useState, useTransition } from 'react'

import {
  type CartaState,
  archivarProductoAction,
  guardarProductoAction,
  mandarARevisionAction,
  pausarProductoAction,
} from '@/app/actions/carta'
import { toastManager } from '@/components/ui/toast'
import { repartir, textoDelReparto } from '@/lib/comercio/dinero'
import {
  ESTADO_AYUDA,
  ESTADO_LABEL,
  type EstadoDeProducto,
  KINDS_DE_PRODUCTO,
  KIND_LABEL,
  type KindDeProducto,
} from '@/lib/comercio/types'
import { formatCOP } from '@/lib/utils/format'
import { cn } from '@/lib/utils/css'

type Producto = {
  id: string
  slug: string
  nombre: string
  kind: KindDeProducto
  descripcion: string | null
  precio: number
  porcentajeMaterial: number
  material: number
  sitio: number
  estado: EstadoDeProducto
  notaDeRevision: string | null
  creadoEn: string
}

const input =
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-body-md text-street-white focus:border-primary focus:outline-none'

export function CartaPanel({
  venueId,
  productos,
  ordenesPorProducto,
}: {
  venueId: string
  productos: Producto[]
  ordenesPorProducto: Record<string, number>
}) {
  const router = useRouter()
  const [estado, guardar, guardando] = useActionState<CartaState, FormData>(guardarProductoAction, {
    status: 'idle',
  })
  const [pendiente, startTransition] = useTransition()
  const [editando, setEditando] = useState<Producto | null>(null)
  const [abierto, setAbierto] = useState(false)

  useEffect(() => {
    if (estado.status === 'success') {
      toastManager.add({ title: estado.mensaje, type: 'success' })
      setAbierto(false)
      setEditando(null)
      router.refresh()
    }
    if (estado.status === 'error') {
      toastManager.add({ title: 'No se pudo', description: estado.error, type: 'error' })
    }
  }, [estado, router])

  const error = (campo: string) =>
    estado.status === 'error' ? estado.fieldErrors?.[campo]?.[0] : undefined

  const correr = (accion: () => Promise<CartaState>) => {
    startTransition(async () => {
      const r = await accion()
      if (r.status === 'success') {
        toastManager.add({ title: r.mensaje, type: 'success' })
        router.refresh()
      }
      if (r.status === 'error') {
        toastManager.add({ title: 'No se pudo', description: r.error, type: 'error' })
      }
    })
  }

  return (
    <div className='flex flex-col gap-8'>
      {!abierto ? (
        <button
          type='button'
          onClick={() => {
            setEditando(null)
            setAbierto(true)
          }}
          className='self-start rounded-xl bg-primary px-6 py-3 font-display text-label-lg text-primary-foreground uppercase transition-opacity hover:opacity-90'
        >
          + Agregar algo a la carta
        </button>
      ) : (
        <FormularioDeProducto
          venueId={venueId}
          producto={editando}
          guardar={guardar}
          guardando={guardando}
          error={error}
          onCancelar={() => {
            setAbierto(false)
            setEditando(null)
          }}
        />
      )}

      {productos.length === 0 ? (
        <div className='rounded-xl border border-border border-dashed p-8 text-center'>
          <p className='text-body-md text-muted-foreground'>Todavía no tienes nada en la carta.</p>
        </div>
      ) : (
        <ul className='flex flex-col gap-4'>
          {productos.map((p) => (
            <li key={p.id} className='rounded-xl border border-border bg-card p-5'>
              <div className='flex flex-wrap items-start justify-between gap-3'>
                <div>
                  <div className='flex flex-wrap items-center gap-2'>
                    <h3 className='font-display font-bold text-lg'>{p.nombre}</h3>
                    <span className='rounded-full border border-border px-2 py-0.5 text-label-sm uppercase'>
                      {KIND_LABEL[p.kind]}
                    </span>
                    <EstadoPill estado={p.estado} />
                  </div>
                  <p className='mt-1 text-body-md text-muted-foreground'>
                    {ESTADO_AYUDA[p.estado]}
                  </p>
                </div>
                <p className='font-display font-black text-2xl'>{formatCOP(p.precio)}</p>
              </div>

              {p.descripcion ? (
                <p className='mt-3 text-body-md text-muted-foreground'>{p.descripcion}</p>
              ) : null}

              <p className='mt-3 text-body-md'>
                <span className='text-lime'>{formatCOP(p.material)} se van en material.</span>{' '}
                <span className='text-muted-foreground'>
                  {p.sitio > 0 ? `${formatCOP(p.sitio)} se quedan en el sitio.` : null}
                </span>
              </p>

              {p.notaDeRevision ? (
                <p className='mt-3 rounded-lg border border-primary/40 bg-primary/5 p-3 text-body-md'>
                  <strong className='text-primary-text'>Lo que te decimos:</strong>{' '}
                  {p.notaDeRevision}
                </p>
              ) : null}

              {(ordenesPorProducto[p.id] ?? 0) > 0 ? (
                <p className='mt-3 text-muted-foreground text-sm'>
                  {ordenesPorProducto[p.id]} pedido
                  {ordenesPorProducto[p.id] === 1 ? '' : 's'} hasta ahora.
                </p>
              ) : null}

              <div className='mt-4 flex flex-wrap gap-2'>
                {p.estado === 'draft' ? (
                  <Accion
                    onClick={() => correr(() => mandarARevisionAction(p.id))}
                    disabled={pendiente}
                    icono={<SendIcon className='size-4' />}
                  >
                    Mandar a revisión
                  </Accion>
                ) : null}

                {p.estado === 'published' ? (
                  <Accion
                    onClick={() => correr(() => pausarProductoAction(p.id, true))}
                    disabled={pendiente}
                    icono={<PauseIcon className='size-4' />}
                  >
                    Pausar
                  </Accion>
                ) : null}

                {p.estado === 'paused' ? (
                  <Accion
                    onClick={() => correr(() => pausarProductoAction(p.id, false))}
                    disabled={pendiente}
                    icono={<PlayIcon className='size-4' />}
                  >
                    Volver a vender
                  </Accion>
                ) : null}

                <Accion
                  onClick={() => {
                    setEditando(p)
                    setAbierto(true)
                  }}
                  disabled={pendiente}
                  icono={<PencilIcon className='size-4' />}
                >
                  Editar
                </Accion>

                <Accion
                  onClick={() => correr(() => archivarProductoAction(p.id))}
                  disabled={pendiente}
                  icono={<ArchiveIcon className='size-4' />}
                >
                  Archivar
                </Accion>
              </div>

              {p.estado === 'published' ? (
                <p className='mt-3 text-muted-foreground text-sm'>
                  Si lo editas vuelve a revisión: el reparto es lo que respaldamos, así que
                  cambiarlo nos obliga a mirarlo otra vez.
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function EstadoPill({ estado }: { estado: EstadoDeProducto }) {
  const tono =
    estado === 'published'
      ? 'border-lime text-lime'
      : estado === 'pending_review'
        ? 'border-party text-party'
        : 'border-border text-muted-foreground'

  return (
    <span className={cn('rounded-full border px-2 py-0.5 text-label-sm uppercase', tono)}>
      {ESTADO_LABEL[estado]}
    </span>
  )
}

function Accion({
  onClick,
  disabled,
  icono,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  icono: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      disabled={disabled}
      className='inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-body-md transition-colors hover:border-primary disabled:opacity-50'
    >
      {icono}
      {children}
    </button>
  )
}

function FormularioDeProducto({
  venueId,
  producto,
  guardar,
  guardando,
  error,
  onCancelar,
}: {
  venueId: string
  producto: Producto | null
  guardar: (formData: FormData) => void
  guardando: boolean
  error: (campo: string) => string | undefined
  onCancelar: () => void
}) {
  // El reparto se calcula mientras se escribe. Un porcentaje es abstracto; ver
  // los pesos moverse es lo que hace que alguien entienda lo que esta ofreciendo
  // antes de mandarlo, y no despues de que se lo aprueben.
  const [precio, setPrecio] = useState(producto ? String(producto.precio) : '')
  const [porcentaje, setPorcentaje] = useState(
    producto ? String(producto.porcentajeMaterial) : '50'
  )

  const vistaPrevia = useMemo(() => {
    const p = Number(precio)
    const pct = Number(porcentaje)
    if (!Number.isFinite(p) || p <= 0 || !Number.isFinite(pct) || pct < 0 || pct > 100) return null
    return { texto: textoDelReparto(p, pct), ...repartir(p, pct) }
  }, [precio, porcentaje])

  return (
    <form
      action={guardar}
      className='flex flex-col gap-6 rounded-xl border border-border bg-card p-5'
    >
      {producto ? <input type='hidden' name='id' value={producto.id} /> : null}
      <input type='hidden' name='venueId' value={venueId} />

      <h2 className='font-display font-bold text-xl uppercase'>
        {producto ? 'Editar' : 'Nuevo en la carta'}
      </h2>

      <Campo id='name' etiqueta='Cómo se llama' error={error('name')} obligatorio>
        <input
          id='name'
          name='name'
          required
          defaultValue={producto?.nombre ?? ''}
          placeholder='Mojito Reconstrucción'
          className={input}
        />
      </Campo>

      <div className='grid gap-6 sm:grid-cols-2'>
        <Campo id='kind' etiqueta='Qué es' error={error('kind')} obligatorio>
          <select id='kind' name='kind' defaultValue={producto?.kind ?? 'coctel'} className={input}>
            {KINDS_DE_PRODUCTO.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </Campo>

        <Campo
          id='price'
          etiqueta='Cuánto vale'
          error={error('price')}
          ayuda='En pesos, sin puntos ni centavos.'
          obligatorio
        >
          <input
            id='price'
            name='price'
            type='number'
            min={1}
            step={1}
            required
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            placeholder='30000'
            className={input}
          />
        </Campo>
      </div>

      <Campo
        id='donationPercentage'
        etiqueta='Cuánto se va en material'
        error={error('donationPercentage')}
        ayuda='De 0 a 100. Lo que no se va en material se queda en tu caja.'
        obligatorio
      >
        <div className='flex items-center gap-3'>
          <input
            id='donationPercentage'
            name='donationPercentage'
            type='range'
            min={0}
            max={100}
            step={5}
            value={porcentaje}
            onChange={(e) => setPorcentaje(e.target.value)}
            className='flex-1 accent-lime'
          />
          <span className='w-16 text-right font-display font-bold text-lg'>{porcentaje}%</span>
        </div>
      </Campo>

      {vistaPrevia ? (
        <div className='rounded-lg border border-lime bg-lime/5 p-4'>
          <p className='font-display text-label-lg uppercase'>Así se va a ver</p>
          <p className='mt-1 text-body-md'>{vistaPrevia.texto}</p>
        </div>
      ) : null}

      <Campo
        id='description'
        etiqueta='Cuéntale a la gente qué lleva'
        error={error('description')}
        ayuda='Opcional. El reparto lo escribimos nosotros debajo; acá va el trago.'
      >
        <textarea
          id='description'
          name='description'
          rows={3}
          defaultValue={producto?.descripcion ?? ''}
          placeholder='Ron, hierbabuena, limón y soda.'
          className={cn(input, 'h-auto')}
        />
      </Campo>

      <div className='flex flex-wrap gap-3'>
        <button
          type='submit'
          disabled={guardando}
          className='rounded-xl bg-primary px-6 py-3 font-display text-label-lg text-primary-foreground uppercase transition-opacity hover:opacity-90 disabled:opacity-50'
        >
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        <button
          type='button'
          onClick={onCancelar}
          className='rounded-xl border border-border px-6 py-3 font-display text-label-lg uppercase'
        >
          Cancelar
        </button>
      </div>

      <p className='text-body-md text-muted-foreground'>
        Se guarda como borrador. No se puede pedir hasta que lo revisemos.
      </p>
    </form>
  )
}

function Campo({
  id,
  etiqueta,
  ayuda,
  error,
  obligatorio,
  children,
}: {
  id: string
  etiqueta: string
  ayuda?: string
  error?: string
  obligatorio?: boolean
  children: React.ReactNode
}) {
  return (
    <div className='flex flex-col gap-1'>
      <label htmlFor={id} className='font-display text-label-lg uppercase'>
        {etiqueta}
        {obligatorio ? <span className='text-primary-text'> *</span> : null}
      </label>
      {ayuda ? <span className='text-muted-foreground text-sm'>{ayuda}</span> : null}
      {children}
      {error ? (
        <span role='alert' className='text-body-sm text-destructive-foreground'>
          {error}
        </span>
      ) : null}
    </div>
  )
}
