'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useState } from 'react'

import { type ReclamoState, solicitarSitioAction } from '@/app/actions/reclamos'
import { toastManager } from '@/components/ui/toast'
import { cn } from '@/lib/utils/css'
import { VENUE_TYPES } from '@/lib/venues/types'

const TYPE_LABEL: Record<string, string> = {
  bar: 'Bar',
  discoteca: 'Discoteca',
  club: 'Club',
  terraza: 'Terraza',
  restobar: 'Restobar',
  billar: 'Billar',
}

export type SitioElegido = {
  id: string
  nombre: string
  city: string
  addressLine: string
  type: string
  instagram: string | null
}

/**
 * El alta de un sitio, corta.
 *
 * CUATRO CAMPOS, y ninguno plegado (decision 35). Cada uno se gana el puesto:
 * el nombre para encontrar el sitio, el Instagram porque es el instrumento de
 * verificacion, el correo porque es lo que el DM tiene que citar Y por donde la
 * solicitud se amarra a una cuenta, y el WhatsApp para perseguirla si se queda
 * quieta.
 *
 * ESTA PANTALLA NO CUENTA LOS PASOS QUE FALTAN. Tenia un subtitulo que
 * enumeraba tres —el DM, acordar cuanto pones, publicar— antes de que la
 * persona escribiera una letra, y uno de ellos ya ni existe. El DM sigue
 * siendo obligatorio, pero se cuenta DESPUES de enviar, que es cuando hay algo
 * que hacer con esa informacion.
 *
 * Tampoco pide cuenta. Antes habia que registrarse y verificar el correo antes
 * de VER esto: el paso mas caro, primero.
 *
 * LO QUE NO SE PIDE: tipo, ciudad, direccion, coordenadas, y los ocho
 * opcionales que habia plegados. Todo eso lo pone un operador al aprobar, o el
 * bar despues en su panel, cuando llenarlo por fin le sirve de algo.
 */
export function FormularioSolicitud({
  correoDeLaCuenta,
  sitio,
  onCambiarSitio,
}: {
  /** Se usa como valor inicial del correo del sitio: casi siempre es el mismo y
   *  escribirlo otra vez no aporta nada. Se puede cambiar. */
  correoDeLaCuenta: string
  /** Si viene del buscador, la solicitud queda atada a ese venue. */
  sitio?: SitioElegido | null
  onCambiarSitio?: () => void
}) {
  const router = useRouter()
  const [estado, enviar, enviando] = useActionState<ReclamoState, FormData>(solicitarSitioAction, {
    status: 'idle',
  })
  const [masCampos, setMasCampos] = useState(false)

  useEffect(() => {
    if (estado.status === 'success') {
      // Por el token y no por el id: quien la mando sin cuenta no tiene sesion
      // con la cual pasar el filtro por userId de la otra rama.
      router.push(`/registrar-sitio/enviada?t=${estado.token}`)
    }
    if (estado.status === 'error') {
      toastManager.add({ title: 'Revisa el formulario', description: estado.error, type: 'error' })
    }
  }, [estado, router])

  const error = (campo: string) =>
    estado.status === 'error' ? estado.fieldErrors?.[campo]?.[0] : undefined

  const input =
    'w-full rounded-lg border border-border bg-background px-3 py-2 text-body-md text-street-white focus:border-primary focus:outline-none'

  return (
    <form action={enviar} className='mt-8 flex flex-col gap-6'>
      {sitio ? (
        <div className='flex flex-wrap items-center justify-between gap-3 rounded-xl border border-lime bg-lime/5 p-4'>
          <p className='text-body-md'>
            Estás pidiendo <strong className='text-street-white'>{sitio.nombre}</strong>, el que ya
            tenemos cargado.
          </p>
          {onCambiarSitio ? (
            <button
              type='button'
              onClick={onCambiarSitio}
              className='text-primary-text text-sm hover:underline'
            >
              No es ese
            </button>
          ) : null}
        </div>
      ) : null}

      {sitio ? <input type='hidden' name='venueId' value={sitio.id} /> : null}

      <Campo id='name' etiqueta='Nombre del sitio' error={error('name')} obligatorio>
        <input
          id='name'
          name='name'
          required
          defaultValue={sitio?.nombre ?? ''}
          placeholder='Como lo conoce la gente'
          className={input}
        />
      </Campo>

      <Campo
        id='instagram'
        etiqueta='Instagram del sitio'
        ayuda='Con esto confirmamos que el sitio es tuyo: te vamos a pedir un mensaje desde esa cuenta. Tiene que ser la del bar, no la tuya personal.'
        error={error('instagram')}
        obligatorio
      >
        <div className='flex items-center gap-1'>
          <span className='text-muted-foreground'>@</span>
          <input
            id='instagram'
            name='instagram'
            required
            defaultValue={sitio?.instagram ?? ''}
            placeholder='tubar'
            className={input}
          />
        </div>
      </Campo>

      <Campo
        id='contactEmail'
        etiqueta='Correo de contacto'
        ayuda='Por acá te respondemos, y es el correo con el que vas a crear la cuenta que recibe el panel.'
        error={error('contactEmail')}
        obligatorio
      >
        <input
          id='contactEmail'
          name='contactEmail'
          type='email'
          required
          defaultValue={correoDeLaCuenta}
          placeholder='hola@tubar.com'
          className={input}
        />
      </Campo>

      <Campo
        id='whatsapp'
        etiqueta='WhatsApp'
        ayuda='Opcional. Es por donde te escribimos si la solicitud se queda quieta.'
        error={error('whatsapp')}
      >
        <input
          id='whatsapp'
          name='whatsapp'
          inputMode='tel'
          placeholder='3001234567'
          className={input}
        />
      </Campo>

      <button
        type='submit'
        disabled={enviando}
        className='self-start rounded-xl bg-primary px-6 py-3 font-display text-label-lg text-primary-foreground uppercase transition-opacity hover:opacity-90 disabled:opacity-50'
      >
        {enviando ? 'Enviando…' : 'Enviar la solicitud'}
      </button>

      <p className='text-body-md text-muted-foreground'>
        No necesitas cuenta para mandarla. La vas a necesitar para recibir el panel, y te decimos
        cómo apenas la envíes.
      </p>
    </form>
  )
}

/**
 * La etiqueta se ata al control con htmlFor/id y no metiendo el input dentro
 * del label. La asociacion implicita tambien es HTML valido, pero aca el
 * control llega como `children` —opaco— asi que ni el linter ni un lector de
 * pantalla pueden dar por hecho que hay uno adentro.
 */
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
      {ayuda ? (
        <span id={`${id}-ayuda`} className='text-muted-foreground text-sm'>
          {ayuda}
        </span>
      ) : null}
      {children}
      {error ? (
        <span role='alert' className='text-body-sm text-destructive-foreground'>
          {error}
        </span>
      ) : null}
    </div>
  )
}
