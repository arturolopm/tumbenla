'use client'

import { ArchiveIcon, ImagePlusIcon, PauseIcon, PencilIcon, PlayIcon, SendIcon, XIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from 'react'

import {
  type CartaState,
  archivarProductoAction,
  firmarImagenProductoAction,
  guardarProductoAction,
  mandarARevisionAction,
  pausarProductoAction,
} from '@/app/actions/carta'
import { toastManager } from '@/components/ui/toast'
import { repartir } from '@/lib/comercio/dinero'
import {
  ESTADO_AYUDA,
  ESTADO_LABEL,
  PORCENTAJE_DESTACADO_DE_RECONSTRUCCION,
  PORCENTAJE_MINIMO_DE_RECONSTRUCCION,
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
  imagenUrl: string | null
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
                <div className='flex min-w-0 items-start gap-3'>
                  {p.imagenUrl ? (
                    <img
                      src={p.imagenUrl}
                      alt=''
                      className='size-14 shrink-0 rounded-lg border border-border object-cover'
                    />
                  ) : null}
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
                </div>
                <p className='font-display font-black text-2xl'>{formatCOP(p.precio)}</p>
              </div>

              {p.descripcion ? (
                <p className='mt-3 text-body-md text-muted-foreground'>{p.descripcion}</p>
              ) : null}

              <p className='mt-3 text-body-md'>
                <span className='text-lime'>
                  {p.porcentajeMaterial}% ({formatCOP(p.material)}) van para reconstruir.
                </span>{' '}
                <span className='text-muted-foreground'>
                  {100 - p.porcentajeMaterial}% ({formatCOP(p.sitio)}) se quedan en el sitio.
                </span>
              </p>

              {(ordenesPorProducto[p.id] ?? 0) > 0 ? (
                <p className='mt-3 text-muted-foreground text-sm'>
                  {ordenesPorProducto[p.id]} pedido
                  {ordenesPorProducto[p.id] === 1 ? '' : 's'} hasta ahora.
                </p>
              ) : null}

              <div className='mt-4 flex flex-wrap gap-2'>
                {p.estado === 'draft' || p.estado === 'pending_review' ? (
                  <Accion
                    onClick={() => correr(() => mandarARevisionAction(p.id))}
                    disabled={pendiente}
                    icono={<SendIcon className='size-4' />}
                  >
                    Publicar en la carta
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
  // Calculate the split as the owner types. A percentage is abstract; the moving
  // amounts make the offer understandable before it is sent for review.
  const [precio, setPrecio] = useState(producto ? String(producto.precio) : '')
  const [porcentaje, setPorcentaje] = useState(
    producto ? String(producto.porcentajeMaterial) : '50'
  )
  const [imagenUrl, setImagenUrl] = useState(producto?.imagenUrl ?? '')
  const [storageKey, setStorageKey] = useState('')
  const [subiendoImagen, setSubiendoImagen] = useState(false)
  const imageInput = useRef<HTMLInputElement>(null)

  const vistaPrevia = useMemo(() => {
    const p = Number(precio)
    const pct = Number(porcentaje)
    if (
      !Number.isFinite(p) ||
      p <= 0 ||
      !Number.isFinite(pct) ||
      pct < PORCENTAJE_MINIMO_DE_RECONSTRUCCION ||
      pct > 100
    ) {
      return null
    }
    return { percentage: pct, ...repartir(p, pct) }
  }, [precio, porcentaje])

  const subirImagen = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const [file] = Array.from(event.target.files ?? [])
    if (!file) return

    setSubiendoImagen(true)
    try {
      const firma = await firmarImagenProductoAction(venueId, file.type, file.size)
      if (!firma.ok) {
        toastManager.add({ title: 'No se pudo subir', description: firma.error, type: 'error' })
        return
      }

      const response = await fetch(firma.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      }).catch(() => null)
      if (!response?.ok) {
        toastManager.add({
          title: 'No se pudo subir',
          description: 'Revisa la conexión o la configuración CORS del almacenamiento.',
          type: 'error',
        })
        return
      }

      setImagenUrl(firma.publicUrl)
      setStorageKey(firma.key)
      toastManager.add({ title: 'Imagen lista. Guarda el producto para usarla.', type: 'success' })
    } finally {
      setSubiendoImagen(false)
      if (imageInput.current) imageInput.current.value = ''
    }
  }

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
        etiqueta='Qué parte del precio va para reconstruir'
        error={error('donationPercentage')}
        ayuda={`Mínimo ${PORCENTAJE_MINIMO_DE_RECONSTRUCCION}%. Desde ${PORCENTAJE_DESTACADO_DE_RECONSTRUCCION}%, este producto aparece primero y como destacado en la carta pública. Si puedes, deja 100% para reconstruir.`}
        obligatorio
      >
        <div className='flex items-center gap-3'>
          <input
            id='donationPercentageSlider'
            type='range'
            min={PORCENTAJE_MINIMO_DE_RECONSTRUCCION}
            max={100}
            step={1}
            value={porcentaje}
            onChange={(e) => setPorcentaje(e.target.value)}
            className='flex-1 accent-lime'
            aria-label='Ajustar el porcentaje que va para reconstruir'
          />
          <div className='flex w-24 items-center rounded-lg border border-border bg-background px-2 focus-within:border-primary'>
            <input
              id='donationPercentage'
              name='donationPercentage'
              type='number'
              min={PORCENTAJE_MINIMO_DE_RECONSTRUCCION}
              max={100}
              step={0.01}
              inputMode='decimal'
              value={porcentaje}
              onChange={(event) => setPorcentaje(event.target.value)}
              className='w-full bg-transparent text-right font-display font-bold text-lg focus:outline-none'
              aria-label='Porcentaje que va para reconstruir'
            />
            <span aria-hidden='true' className='text-muted-foreground'>
              %
            </span>
          </div>
        </div>
      </Campo>

      {vistaPrevia ? (
        <div className='rounded-lg border border-lime bg-lime/5 p-4'>
          <p className='font-display text-label-lg uppercase'>Esto verá quien pide el trago</p>
          <p className='mt-1 text-body-md'>
            <span className='text-lime'>
              {vistaPrevia.percentage}% ({formatCOP(vistaPrevia.material)}) van para reconstruir.
            </span>{' '}
            <span className='text-muted-foreground'>
              {100 - vistaPrevia.percentage}% ({formatCOP(vistaPrevia.sitio)}) se quedan en tu
              establecimiento.
            </span>
          </p>
        </div>
      ) : null}

      <div className='flex flex-col gap-2'>
        <label htmlFor='imageUrl' className='font-display text-label-lg uppercase'>
          Foto del producto <span className='text-muted-foreground'>(opcional)</span>
        </label>
        <p className='text-muted-foreground text-sm'>
          Pega una URL segura o sube una foto. Se verá en la carta pública cuando el producto se
          publique.
        </p>
        <div className='flex flex-col gap-3 sm:flex-row'>
          <input
            id='imageUrl'
            name='imageUrl'
            type='url'
            value={imagenUrl}
            onChange={(event) => {
              setImagenUrl(event.target.value)
              setStorageKey('')
            }}
            placeholder='https://ejemplo.com/mi-trago.jpg'
            className={input}
          />
          <label className='inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 font-display text-label-lg uppercase transition-colors hover:border-primary'>
            <ImagePlusIcon className='size-4' />
            {subiendoImagen ? 'Subiendo…' : 'Subir foto'}
            <input
              ref={imageInput}
              type='file'
              accept='image/jpeg,image/png,image/webp,image/avif'
              disabled={subiendoImagen}
              onChange={subirImagen}
              className='sr-only'
            />
          </label>
        </div>
        <input type='hidden' name='storageKey' value={storageKey} />
        <p className='text-muted-foreground text-sm'>JPG, PNG, WEBP o AVIF, máximo 5 MB.</p>

        {imagenUrl ? (
          <div className='relative mt-1 aspect-video max-w-sm overflow-hidden rounded-lg border border-border bg-muted'>
            <img
              src={imagenUrl}
              alt='Vista previa de la foto del producto'
              className='size-full object-cover'
            />
            <button
              type='button'
              onClick={() => {
                setImagenUrl('')
                setStorageKey('')
              }}
              className='absolute top-2 right-2 inline-flex items-center gap-1 rounded-lg bg-background/90 px-2 py-1 text-label-sm uppercase transition-colors hover:text-destructive-foreground'
            >
              <XIcon className='size-3.5' />
              Quitar
            </button>
          </div>
        ) : null}
        {error('imageUrl') ? (
          <span role='alert' className='text-body-sm text-destructive-foreground'>
            {error('imageUrl')}
          </span>
        ) : null}
      </div>

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
        Se guarda como borrador. Publícalo cuando esté listo.
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
