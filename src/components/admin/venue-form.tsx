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
import { type ActionState, saveVenueAction } from '@/app/actions/venues'
import { AddressSearch } from '@/components/mapa/address-search'
import type { PickedLocation } from '@/components/mapa/location-picker'
import { cn } from '@/lib/utils/css'
import type { VenueAdminRow } from '@/lib/venues/types'
import { PLEDGE_BASES, PLEDGE_UNITS, VENUE_STATUSES, VENUE_TYPES } from '@/lib/venues/types'

const LocationPicker = dynamic(
  () => import('@/components/mapa/location-picker').then((m) => m.LocationPicker),
  {
    ssr: false,
    loading: () => (
      <div className="h-[340px] w-full animate-pulse rounded-xl border border-border bg-card" />
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

const UNIT_LABEL: Record<string, string> = {
  botella: 'por botella',
  trago: 'por trago',
  cerveza: 'por cerveza',
  coctel: 'por cóctel',
  entrada: 'por entrada',
}

const BASIS_LABEL: Record<string, string> = {
  ventas_totales: 'de las ventas totales',
  ventas_licor: 'de las ventas de licor',
  cover: 'del cover',
}

const initialState: ActionState = { status: 'idle' }

export function VenueForm({ venue }: { venue?: VenueAdminRow }) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(saveVenueAction, initialState)

  const [pledgeType, setPledgeType] = useState<'percentage' | 'fixed_per_unit'>(
    venue?.pledge.type ?? 'percentage'
  )
  const [location, setLocation] = useState<PickedLocation | null>(
    venue ? { lat: venue.lat, lng: venue.lng } : null
  )

  // Lo que ofrece el geocoder, pendiente de que el operador lo acepte. Nunca se
  // escribe solo: en OSM las direcciones colombianas son irregulares y lo que
  // ya escribio el operador suele ser mejor.
  const [suggestion, setSuggestion] = useState<GeocodeResult | null>(null)
  const [applied, setApplied] = useState(0)

  useEffect(() => {
    if (state.status === 'success') router.push('/admin/sitios')
  }, [state, router])

  const fieldError = (name: string) =>
    state.status === 'error' ? state.fieldErrors?.[name]?.[0] : undefined

  const handlePick = (result: GeocodeResult) => {
    setLocation({ lat: result.lat, lng: result.lng })
    setSuggestion(result)
  }

  return (
    <form action={formAction} className="flex max-w-3xl flex-col gap-8">
      {venue ? <input type="hidden" name="id" value={venue.id} /> : null}

      {state.status === 'error' ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm"
        >
          {state.error}
        </p>
      ) : null}

      <Section title="Identidad">
        <Field label="Nombre" error={fieldError('name')}>
          <input name="name" defaultValue={venue?.name} required className={inputClass} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo" error={fieldError('type')}>
            <select name="type" defaultValue={venue?.type ?? 'bar'} className={inputClass}>
              {VENUE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {TYPE_LABEL[type]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Estado" error={fieldError('status')}>
            <select name="status" defaultValue={venue?.status ?? 'draft'} className={inputClass}>
              {VENUE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Frase corta" hint="Sale debajo del nombre en la tarjeta.">
          <input name="tagline" defaultValue={venue?.tagline ?? ''} className={inputClass} />
        </Field>

        <Field label="Descripción">
          <textarea
            name="description"
            defaultValue={venue?.description ?? ''}
            rows={4}
            className={cn(inputClass, 'h-auto py-2')}
          />
        </Field>
      </Section>

      <Section
        title="Dónde queda"
        hint="Busca la dirección, o pon el pin directo en el mapa si el sitio no aparece."
      >
        <AddressSearch onPick={handlePick} />

        {suggestion ? (
          <div className="flex flex-col gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3">
            <p className="text-sm">
              El geocoder propone:{' '}
              <span className="text-muted-foreground">{suggestion.displayName}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setApplied((n) => n + 1)}
                className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground text-sm"
              >
                Usar estos datos
              </button>
              <button
                type="button"
                onClick={() => setSuggestion(null)}
                className="rounded-md border border-border px-3 py-1.5 text-sm"
              >
                Dejar lo que escribi
              </button>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Dirección" error={fieldError('addressLine')}>
            <input
              // key: remontar el input es lo que hace que defaultValue tome el
              // valor sugerido. Sin esto habria que volverlo controlado y
              // reescribir todo el formulario alrededor de useState.
              key={`address-${applied}`}
              name="addressLine"
              defaultValue={
                (applied > 0 ? suggestion?.addressLine : null) ?? venue?.addressLine ?? ''
              }
              required
              className={inputClass}
            />
          </Field>

          <Field label="Barrio">
            <input
              key={`hood-${applied}`}
              name="neighborhood"
              defaultValue={
                (applied > 0 ? suggestion?.neighborhood : null) ?? venue?.neighborhood ?? ''
              }
              className={inputClass}
            />
          </Field>

          <Field label="Ciudad" error={fieldError('city')}>
            <input
              key={`city-${applied}`}
              name="city"
              defaultValue={(applied > 0 ? suggestion?.city : null) ?? venue?.city ?? ''}
              required
              className={inputClass}
            />
          </Field>

          <Field label="Departamento" error={fieldError('department')}>
            <input
              key={`dept-${applied}`}
              name="department"
              defaultValue={
                (applied > 0 ? suggestion?.department : null) ?? venue?.department ?? ''
              }
              required
              className={inputClass}
            />
          </Field>
        </div>

        <LocationPicker value={location} onChange={setLocation} />

        {/* Lat/lng visibles y de solo lectura. Cuando algo se ve raro en el
            mapa, ver los numeros es como se depura. Van como hidden inputs
            aparte para que el formulario los envie de verdad. */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Latitud" error={fieldError('latitude')}>
            <input
              value={location?.lat.toFixed(6) ?? ''}
              readOnly
              className={cn(inputClass, 'text-muted-foreground')}
            />
          </Field>
          <Field label="Longitud" error={fieldError('longitude')}>
            <input
              value={location?.lng.toFixed(6) ?? ''}
              readOnly
              className={cn(inputClass, 'text-muted-foreground')}
            />
          </Field>
        </div>
        <input type="hidden" name="latitude" value={location?.lat ?? ''} />
        <input type="hidden" name="longitude" value={location?.lng ?? ''} />
      </Section>

      <Section title="El compromiso" hint="Esto es lo que sale en la tarjeta del sitio.">
        <div className="flex flex-wrap gap-2">
          {(['percentage', 'fixed_per_unit'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setPledgeType(option)}
              aria-pressed={pledgeType === option}
              className={cn(
                'rounded-md border px-3 py-1.5 text-sm transition-colors',
                pledgeType === option
                  ? 'border-primary bg-primary/10 text-primary-text'
                  : 'border-border text-muted-foreground hover:text-foreground'
              )}
            >
              {option === 'percentage' ? 'Un porcentaje' : 'Un monto fijo'}
            </button>
          ))}
        </div>
        <input type="hidden" name="pledgeType" value={pledgeType} />

        {pledgeType === 'percentage' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Porcentaje" error={fieldError('pledgePercentage')}>
              <input
                name="pledgePercentage"
                type="number"
                step="0.1"
                min="0.1"
                max="100"
                defaultValue={
                  venue?.pledge.type === 'percentage' ? venue.pledge.percentage : undefined
                }
                className={inputClass}
              />
            </Field>
            <Field label="Sobre qué">
              <select
                name="pledgeBasis"
                defaultValue={
                  venue?.pledge.type === 'percentage'
                    ? (venue.pledge.basis ?? 'ventas_totales')
                    : 'ventas_totales'
                }
                className={inputClass}
              >
                {PLEDGE_BASES.map((basis) => (
                  <option key={basis} value={basis}>
                    {BASIS_LABEL[basis]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Monto en pesos" error={fieldError('pledgeAmount')}>
              <input
                name="pledgeAmount"
                type="number"
                step="100"
                min="100"
                defaultValue={
                  venue?.pledge.type === 'fixed_per_unit' ? venue.pledge.amount : undefined
                }
                className={inputClass}
              />
            </Field>
            <Field label="Por cada">
              <select
                name="pledgeUnit"
                defaultValue={
                  venue?.pledge.type === 'fixed_per_unit' ? venue.pledge.unit : 'botella'
                }
                className={inputClass}
              >
                {PLEDGE_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {UNIT_LABEL[unit]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}

        <Field label="Nota del compromiso" hint="En las palabras del sitio, si las dieron.">
          <textarea
            name="pledgeNote"
            defaultValue={venue?.pledge.note ?? ''}
            rows={2}
            className={cn(inputClass, 'h-auto py-2')}
          />
        </Field>
      </Section>

      <Section title="Contacto">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Teléfono">
            <input name="phone" defaultValue={venue?.phone ?? ''} className={inputClass} />
          </Field>
          <Field label="WhatsApp">
            <input name="whatsapp" defaultValue={venue?.whatsapp ?? ''} className={inputClass} />
          </Field>
          <Field label="Instagram">
            <input name="instagram" defaultValue={venue?.instagram ?? ''} className={inputClass} />
          </Field>
          <Field label="Sitio web">
            <input name="website" defaultValue={venue?.website ?? ''} className={inputClass} />
          </Field>
          <Field label="Horario">
            <input
              name="openingHours"
              defaultValue={venue?.openingHours ?? ''}
              className={inputClass}
            />
          </Field>
          <Field label="Imagen de portada (URL)">
            <input
              name="coverImageUrl"
              defaultValue={venue?.coverImageUrl ?? ''}
              className={inputClass}
            />
          </Field>
        </div>
      </Section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || !location}
          className="rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? 'Guardando…' : venue ? 'Guardar cambios' : 'Crear sitio'}
        </button>
        {!location ? (
          <p className="text-muted-foreground text-sm">Falta ubicar el pin en el mapa.</p>
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
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="font-display font-bold text-xl">{title}</h2>
        {hint ? <p className="text-muted-foreground text-sm">{hint}</p> : null}
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
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-medium text-sm">
        {label}
      </label>
      {control}
      {hint ? (
        <span id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={errorId} role="alert" className="text-destructive text-xs">
          {error}
        </span>
      ) : null}
    </div>
  )
}
