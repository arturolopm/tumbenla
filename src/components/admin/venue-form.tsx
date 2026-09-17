'use client'

import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import {
  type ReactElement,
  cloneElement,
  isValidElement,
  useActionState,
  useEffect,
  useId,
  useState,
} from 'react'

import type { GeocodeResult } from '@/app/api/geocode/route'
import { saveMyVenueAction } from '@/app/actions/mi-sitio'
import { type ActionState, saveVenueAction } from '@/app/actions/venues'
import { AddressSearch } from '@/components/mapa/address-search'
import type { PickedLocation } from '@/components/mapa/location-picker'
import { cn } from '@/lib/utils/css'
import type { VenueAdminRow } from '@/lib/venues/types'
import { VENUE_STATUSES, VENUE_TYPES } from '@/lib/venues/types'

const LocationPicker = dynamic(
  () => import('@/components/mapa/location-picker').then((m) => m.LocationPicker),
  {
    ssr: false,
    loading: () => (
      <div className='h-[340px] w-full animate-pulse rounded-xl border border-border bg-card' />
    ),
  }
)

const TYPE_LABEL: Record<string, string> = {
  bar: 'Bar',
  discoteca: 'Discoteca',
  club: 'Club',
  terraza: 'Terraza',
  restobar: 'Restobar',
  billar: 'Billar',
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  published: 'Publicado',
  paused: 'Pausado',
  archived: 'Archivado',
}

const initialState: ActionState = { status: 'idle' }

/**
 * El formulario largo de un sitio, para los DOS PANELES Y NADA MAS.
 *
 * NO SE LE MUESTRA A QUIEN SE REGISTRA. Estuvo colgado en /registrar-sitio/nuevo
 * y era la peor pantalla del producto: le pedia un pin en el mapa —y en su
 * momento un compromiso entero— a alguien con quien todavia no habiamos
 * hablado. El alta son cuatro campos (decision 35); esto lo llena un operador
 * cuando ya verifico el DM, o lo corrige despues un dueno verificado desde el
 * panel de un sitio que ya le pertenece.
 *
 * `modo='panel'` esconde el selector de Estado, porque publicar es de la
 * plataforma. ESCONDERLO NO ES LA PROTECCION: la proteccion es que
 * saveMyVenueAction lee el status de la base y sobrescribe lo que llegue. Esto
 * es solo no ofrecer un control que no se puede usar.
 */
export type PrefillSolicitud = {
  solicitudId: string
  name: string
  // Nullable desde la decision 35. Una solicitud nueva trae nombre, Instagram,
  // correo y WhatsApp, y nada mas: el tipo y la direccion los pone el operador
  // aca mismo, que es el mismo trato que ya tenian el pin y el departamento.
  type: string | null
  city: string | null
  addressLine: string | null
  neighborhood: string | null
  instagram: string | null
  tiktok: string | null
  email: string | null
  whatsapp: string | null
  phone: string | null
  website: string | null
  openingHours: string | null
  description: string | null
}

export function VenueForm({
  venue,
  modo = 'admin',
  onSuccessHref,
  prefill,
}: {
  venue?: VenueAdminRow
  modo?: 'admin' | 'panel'
  onSuccessHref?: string
  /**
   * Lo que el sitio ya dijo en su solicitud de alta.
   *
   * Desde la decision 35 trae CUATRO cosas: nombre, Instagram, correo y
   * WhatsApp. El tipo, la direccion y el pin los pone el operador aca, que es
   * el mismo trato que el pin ya tenia y la razon de que esta pantalla exista.
   */
  prefill?: PrefillSolicitud
}) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(
    modo === 'panel' ? saveMyVenueAction : saveVenueAction,
    initialState
  )

  const [location, setLocation] = useState<PickedLocation | null>(
    venue ? { lat: venue.lat, lng: venue.lng } : null
  )
  const [addressLine, setAddressLine] = useState(venue?.addressLine ?? prefill?.addressLine ?? '')
  const [neighborhood, setNeighborhood] = useState(
    venue?.neighborhood ?? prefill?.neighborhood ?? ''
  )
  const [city, setCity] = useState(venue?.city ?? prefill?.city ?? '')
  const [department, setDepartment] = useState(venue?.department ?? '')

  useEffect(() => {
    if (state.status !== 'success') return
    router.push(onSuccessHref ?? '/admin/sitios')
    // El panel se queda en la misma pagina, asi que sin refresh los campos
    // seguirian mostrando lo de antes de guardar.
    router.refresh()
  }, [state, router, onSuccessHref])

  const fieldError = (name: string) =>
    state.status === 'error' ? state.fieldErrors?.[name]?.[0] : undefined

  const handlePick = (result: GeocodeResult) => {
    setLocation({ lat: result.lat, lng: result.lng })
    if (!addressLine.trim() && result.addressLine) setAddressLine(result.addressLine)
    if (!neighborhood.trim() && result.neighborhood) setNeighborhood(result.neighborhood)
    if (!city.trim() && result.city) setCity(result.city)
    if (!department.trim() && result.department) setDepartment(result.department)
  }

  const geocodeQuery = [addressLine, city, department].filter(Boolean).join(', ')

  return (
    <form action={formAction} className='flex max-w-3xl flex-col gap-8'>
      {venue ? <input type='hidden' name='id' value={venue.id} /> : null}
      {/* Guardar con esto puesto no solo crea el sitio: ademas mete al
          solicitante como dueno y cierra la solicitud, en un solo acto. Ver
          saveVenueAction. */}
      {prefill ? <input type='hidden' name='solicitudId' value={prefill.solicitudId} /> : null}

      {state.status === 'error' ? (
        <p
          role='alert'
          className='rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm'
        >
          {state.error}
        </p>
      ) : null}

      <Section title='Identidad'>
        <Field label='Nombre' error={fieldError('name')}>
          <input
            name='name'
            defaultValue={venue?.name ?? prefill?.name ?? ''}
            required
            className={inputClass}
          />
        </Field>

        <div className='grid gap-4 sm:grid-cols-2'>
          <Field label='Tipo' error={fieldError('type')}>
            <select
              name='type'
              defaultValue={venue?.type ?? prefill?.type ?? 'bar'}
              className={inputClass}
            >
              {VENUE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {TYPE_LABEL[type]}
                </option>
              ))}
            </select>
          </Field>

          {modo === 'admin' ? (
            <Field label='Estado' error={fieldError('status')}>
              <select name='status' defaultValue={venue?.status ?? 'draft'} className={inputClass}>
                {VENUE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABEL[status]}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
        </div>

        <Field label='Frase corta' hint='Sale debajo del nombre en la tarjeta.'>
          <input name='tagline' defaultValue={venue?.tagline ?? ''} className={inputClass} />
        </Field>

        <Field label='Descripción'>
          <textarea
            name='description'
            defaultValue={venue?.description ?? prefill?.description ?? ''}
            rows={4}
            className={cn(inputClass, 'h-auto py-2')}
          />
        </Field>
      </Section>

      <Section
        title='Dónde queda'
        hint='Escribe la dirección y ubícala. El primer resultado pone el pin; puedes arrastrarlo si hace falta.'
      >
        <div className='grid gap-4 sm:grid-cols-2'>
          <Field label='Dirección' error={fieldError('addressLine')}>
            <input
              name='addressLine'
              value={addressLine}
              onChange={(event) => setAddressLine(event.target.value)}
              placeholder='Carrera 23 # 64-18'
              required
              className={inputClass}
            />
          </Field>

          <Field label='Barrio'>
            <input
              name='neighborhood'
              value={neighborhood}
              onChange={(event) => setNeighborhood(event.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label='Ciudad' error={fieldError('city')}>
            <input
              name='city'
              value={city}
              onChange={(event) => setCity(event.target.value)}
              required
              className={inputClass}
            />
          </Field>

          <Field label='Departamento' error={fieldError('department')}>
            <input
              name='department'
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              required
              className={inputClass}
            />
          </Field>
        </div>

        <AddressSearch
          query={geocodeQuery}
          venueId={modo === 'panel' ? venue?.id : undefined}
          onPick={handlePick}
        />

        <LocationPicker value={location} onChange={setLocation} />

        {/* Lat/lng visibles y de solo lectura. Cuando algo se ve raro en el
            mapa, ver los numeros es como se depura. Van como hidden inputs
            aparte para que el formulario los envie de verdad. */}
        <div className='grid gap-4 sm:grid-cols-2'>
          <Field label='Latitud' error={fieldError('latitude')}>
            <input
              value={location?.lat.toFixed(6) ?? ''}
              readOnly
              className={cn(inputClass, 'text-muted-foreground')}
            />
          </Field>
          <Field label='Longitud' error={fieldError('longitude')}>
            <input
              value={location?.lng.toFixed(6) ?? ''}
              readOnly
              className={cn(inputClass, 'text-muted-foreground')}
            />
          </Field>
        </div>
        <input type='hidden' name='latitude' value={location?.lat ?? ''} />
        <input type='hidden' name='longitude' value={location?.lng ?? ''} />
      </Section>

      <Section
        title='Lo que declara el sitio'
        hint='Un estimado, no un recibo. El reparto de verdad va en cada trago de la carta.'
      >
        {/* Aca vivia "El compromiso": un porcentaje de las ventas, o un monto
            fijo por unidad. Se retiro entero (decision 34). Un porcentaje
            sobre una caja que no auditamos habia que creerlo; el reparto ahora
            va por producto, donde tiene precio, orden y escaneo detras.

            Lo que queda es el estimado por persona, que NUNCA fue el
            compromiso y por eso sobrevive: es lo que /mi-historia multiplica
            por cada noche guardada, siempre rotulado "estimado". */}
        <Field
          label='Aporte estimado por persona, por noche'
          hint='Opcional. En pesos. Es un ESTIMADO que declara el sitio, no un recibo: se multiplica por cada noche que alguien guarde. Déjalo vacío si no hay una cifra que el sitio respalde; vacío muestra las noches sin pesos, que es mejor que un número inventado.'
          error={fieldError('estimatedPerPersonNight')}
        >
          <input
            name='estimatedPerPersonNight'
            type='number'
            step='100'
            min='0'
            placeholder='Sin cifra'
            defaultValue={venue?.estimatedPerPersonNight ?? ''}
            className={inputClass}
          />
        </Field>
      </Section>

      <Section title='Contacto'>
        <div className='grid gap-4 sm:grid-cols-2'>
          <Field label='Teléfono'>
            <input
              name='phone'
              defaultValue={venue?.phone ?? prefill?.phone ?? ''}
              className={inputClass}
            />
          </Field>
          <Field label='WhatsApp'>
            <input
              name='whatsapp'
              defaultValue={venue?.whatsapp ?? prefill?.whatsapp ?? ''}
              className={inputClass}
            />
          </Field>
          <Field label='Instagram'>
            <input
              name='instagram'
              defaultValue={venue?.instagram ?? prefill?.instagram ?? ''}
              className={inputClass}
            />
          </Field>
          <Field label='TikTok' hint='Sin la arroba.'>
            <input
              name='tiktok'
              defaultValue={venue?.tiktok ?? prefill?.tiktok ?? ''}
              className={inputClass}
            />
          </Field>
          <Field label='Correo del sitio' hint='El del bar, no el de quien lo administra.'>
            <input
              name='email'
              type='email'
              defaultValue={venue?.email ?? prefill?.email ?? ''}
              className={inputClass}
            />
          </Field>
          <Field label='Sitio web'>
            <input
              name='website'
              defaultValue={venue?.website ?? prefill?.website ?? ''}
              className={inputClass}
            />
          </Field>
          <Field label='Horario'>
            <input
              name='openingHours'
              defaultValue={venue?.openingHours ?? prefill?.openingHours ?? ''}
              className={inputClass}
            />
          </Field>
          <Field label='Imagen de portada (URL)'>
            <input
              name='coverImageUrl'
              defaultValue={venue?.coverImageUrl ?? ''}
              className={inputClass}
            />
          </Field>
        </div>
      </Section>

      <div className='flex items-center gap-3'>
        <button
          type='submit'
          disabled={pending || !location}
          className='rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground text-sm transition-opacity hover:opacity-90 disabled:opacity-50'
        >
          {pending ? 'Guardando…' : venue ? 'Guardar cambios' : 'Crear sitio'}
        </button>
        {!location ? (
          <p className='text-muted-foreground text-sm'>Falta ubicar el pin en el mapa.</p>
        ) : null}
      </div>
    </form>
  )
}

const inputClass =
  'h-10 w-full rounded-lg border border-input bg-card px-3 text-foreground text-sm placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className='flex flex-col gap-4'>
      <div>
        <h2 className='font-display font-bold text-xl'>{title}</h2>
        {hint ? <p className='text-muted-foreground text-sm'>{hint}</p> : null}
      </div>
      {children}
    </section>
  )
}

/**
 * Asociacion explicita entre label y control, no por anidamiento.
 *
 * El anidamiento es HTML valido, pero deja el mensaje de error suelto: un lector
 * de pantalla anuncia la etiqueta y no dice por que el campo esta mal. Clonar el
 * control para inyectarle id, aria-describedby y aria-invalid conecta las tres
 * cosas sin tener que reescribir los veintitantos campos de arriba.
 */
function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`

  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ')

  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id,
        'aria-describedby': describedBy || undefined,
        'aria-invalid': error ? true : undefined,
      })
    : children

  return (
    <div className='flex flex-col gap-1.5'>
      <label htmlFor={id} className='font-medium text-sm'>
        {label}
      </label>
      {control}
      {hint ? (
        <span id={hintId} className='text-muted-foreground text-xs'>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} role='alert' className='text-destructive text-xs'>
          {error}
        </span>
      ) : null}
    </div>
  )
}
