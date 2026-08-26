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
 * SEIS CAMPOS OBLIGATORIOS Y NADA MAS. Lo que estaba antes en esta ruta era el
 * formulario del panel de operacion: dieciocho campos, un pin en un mapa y el
 * compromiso completo. Le pedia a un bar que negociara cuanto pone antes de que
 * hubieramos hablado con el, y encima su buscador de direcciones llamaba a un
 * endpoint que exige ser operador.
 *
 * LO QUE NO SE PIDE: coordenadas y compromiso. Las primeras las sacamos de la
 * direccion; el segundo se acuerda hablando y lo escribe un operador. Por eso
 * esta solicitud no crea el sitio, y por eso puede ser corta.
 *
 * Lo opcional va plegado. Abierto de entrada, un formulario de trece campos se
 * ve igual de largo aunque solo seis sean obligatorios.
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
      router.push(`/registrar-sitio/enviada?id=${estado.id}`)
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

      <div className='grid gap-6 sm:grid-cols-2'>
        <Campo id='type' etiqueta='Qué es' error={error('type')} obligatorio>
          <select id='type' name='type' defaultValue={sitio?.type ?? 'bar'} className={input}>
            {VENUE_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t] ?? t}
              </option>
            ))}
          </select>
        </Campo>

        <Campo id='city' etiqueta='Ciudad' error={error('city')} obligatorio>
          <input
            id='city'
            name='city'
            required
            defaultValue={sitio?.city ?? ''}
            placeholder='Manizales'
            className={input}
          />
        </Campo>
      </div>

      <Campo
        id='addressLine'
        etiqueta='Dirección'
        error={error('addressLine')}
        ayuda='En texto, como se la darías a alguien. El punto en el mapa lo ponemos nosotros.'
        obligatorio
      >
        <input
          id='addressLine'
          name='addressLine'
          required
          defaultValue={sitio?.addressLine ?? ''}
          placeholder='Carrera 23 # 62-16'
          className={input}
        />
      </Campo>

      <Campo
        id='instagram'
        etiqueta='Instagram del sitio'
        error={error('instagram')}
        ayuda='Es con lo que confirmamos que el sitio es tuyo: te vamos a pedir un mensaje desde esa cuenta. Tiene que ser la del bar, no la tuya personal.'
        obligatorio
      >
        <div className='flex items-center gap-2'>
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
        error={error('contactEmail')}
        ayuda='Por acá te respondemos. Es el correo que vas a tener que citar en el mensaje de Instagram.'
        obligatorio
      >
        <input
          id='contactEmail'
          name='contactEmail'
          type='email'
          required
          defaultValue={correoDeLaCuenta}
          className={input}
        />
      </Campo>

      <div>
        <button
          type='button'
          onClick={() => setMasCampos((v) => !v)}
          aria-expanded={masCampos}
          className='font-display text-label-lg text-primary-text uppercase hover:underline'
        >
          {masCampos ? '− Menos datos' : '+ Agregar más datos (opcional)'}
        </button>

        {masCampos ? (
          <div className='mt-4 flex flex-col gap-6 border-border border-l-2 pl-4'>
            <div className='grid gap-6 sm:grid-cols-2'>
              <Campo id='tiktok' etiqueta='TikTok'>
                <input id='tiktok' name='tiktok' placeholder='tubar' className={input} />
              </Campo>
              <Campo id='whatsapp' etiqueta='WhatsApp'>
                <input id='whatsapp' name='whatsapp' placeholder='3001234567' className={input} />
              </Campo>
              <Campo id='phone' etiqueta='Teléfono'>
                <input id='phone' name='phone' className={input} />
              </Campo>
              <Campo id='neighborhood' etiqueta='Barrio'>
                <input
                  id='neighborhood'
                  name='neighborhood'
                  placeholder='Palogrande'
                  className={input}
                />
              </Campo>
              <Campo id='website' etiqueta='Sitio web'>
                <input id='website' name='website' className={input} />
              </Campo>
              <Campo id='openingHours' etiqueta='Horario'>
                <input
                  id='openingHours'
                  name='openingHours'
                  placeholder='Jue a sáb, 8pm–3am'
                  className={input}
                />
              </Campo>
            </div>

            <Campo id='description' etiqueta='Cuéntanos del sitio'>
              <textarea
                id='description'
                name='description'
                rows={3}
                className={cn(input, 'h-auto')}
              />
            </Campo>

            {/* Rotulado como IDEA en el label, en la ayuda y en el placeholder.
                Que alguien salga de este formulario creyendo que ya pactó algo
                es exactamente lo que no puede pasar: el compromiso se acuerda
                hablando y lo escribe un operador. */}
            <Campo
              id='pledgeIdea'
              etiqueta='¿Qué tienes en mente para poner?'
              ayuda='Solo una idea para arrancar la conversación. No es un compromiso y no se publica.'
            >
              <textarea
                id='pledgeIdea'
                name='pledgeIdea'
                rows={3}
                placeholder='Ej: $1.000 por cerveza, o el 5% de la noche del sábado'
                className={cn(input, 'h-auto')}
              />
            </Campo>
          </div>
        ) : null}
      </div>

      <button
        type='submit'
        disabled={enviando}
        className='self-start rounded-xl bg-primary px-6 py-3 font-display text-label-lg text-primary-foreground uppercase transition-opacity hover:opacity-90 disabled:opacity-50'
      >
        {enviando ? 'Enviando…' : 'Enviar la solicitud'}
      </button>

      <p className='text-body-md text-muted-foreground'>
        No sale en el mapa hasta que hablemos contigo y confirmemos lo que vas a poner.
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
