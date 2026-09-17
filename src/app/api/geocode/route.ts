import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { assertAdmin } from '@/lib/auth/admin'
import { assertVenueAccess } from '@/lib/auth/venue-access'
import { COLOMBIA_BOUNDS } from '@/lib/venues/schemas'

/**
 * Proxy de Nominatim.
 *
 * NO ES OPCIONAL QUE SEA UN PROXY. La politica de uso de Nominatim exige un
 * User-Agent identificable, y el navegador prohibe setear esa cabecera desde
 * fetch(). Geocodificar desde el cliente incumple la politica desde la primera
 * peticion, y lo que sigue es un bloqueo por IP.
 *
 * Como se cumple cada requisito:
 *
 *   User-Agent identificable   -> se setea en el fetch de abajo
 *   Maximo 1 peticion/segundo  -> throttle a nivel de modulo
 *   Nada de consultas masivas  -> only operators and verified venue owners
 *   Cachear resultados         -> next: { revalidate: 86400 }
 *   Nada de autocompletar      -> boton explicito y minimo 3 caracteres
 *
 * El throttle es por proceso y Vercel corre varios, asi que no es un limite
 * duro. En la practica lo acota el gate de acceso (un punado de humanos) mas
 * el cache de 24 horas.
 */

const CONTACT = 'https://tumbenla.com'
const USER_AGENT = `Tumbenla/1.0 (${CONTACT})`
const MIN_INTERVAL_MS = 1100

let lastRequestAt = 0

const throttle = async () => {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now()
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
  lastRequestAt = Date.now()
}

const searchSchema = z.object({
  q: z.string().trim().min(3).max(200),
})

const reverseSchema = z.object({
  lat: z.coerce.number().min(COLOMBIA_BOUNDS.minLat).max(COLOMBIA_BOUNDS.maxLat),
  lon: z.coerce.number().min(COLOMBIA_BOUNDS.minLng).max(COLOMBIA_BOUNDS.maxLng),
})

/** Lo que el cliente necesita. Nominatim devuelve mucho mas y no hace falta. */
export type GeocodeResult = {
  lat: number
  lng: number
  displayName: string
  addressLine: string | null
  neighborhood: string | null
  city: string | null
  department: string | null
}

type NominatimAddress = {
  road?: string
  house_number?: string
  neighbourhood?: string
  suburb?: string
  city?: string
  town?: string
  municipality?: string
  state?: string
}

type NominatimPlace = {
  lat: string
  lon: string
  display_name: string
  address?: NominatimAddress
}

const toResult = (place: NominatimPlace): GeocodeResult => {
  const address = place.address ?? {}
  const street = [address.road, address.house_number].filter(Boolean).join(' ')

  return {
    lat: Number.parseFloat(place.lat),
    lng: Number.parseFloat(place.lon),
    displayName: place.display_name,
    addressLine: street || null,
    neighborhood: address.neighbourhood ?? address.suburb ?? null,
    city: address.city ?? address.town ?? address.municipality ?? null,
    department: address.state ?? null,
  }
}

const callNominatim = async (url: URL) => {
  await throttle()

  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'es' },
    // Los resultados de geocoding son practicamente estaticos. 24 horas de
    // cache es lo que pide la politica de uso y ademas hace que reabrir el
    // formulario no cueste nada.
    next: { revalidate: 86400 },
  })

  if (!response.ok) throw new Error(`Nominatim respondio ${response.status}`)
  return response.json()
}

const canUseGeocoder = async (venueId: string | null) => {
  if (venueId) {
    const access = await assertVenueAccess(venueId, ['owner'])
    return access.ok
  }

  const admin = await assertAdmin()
  return admin.ok
}

export const GET = async (request: NextRequest) => {
  // Layout gates do not cover route handlers. Operators may locate a new
  // venue; verified owners may locate only a venue they already own. The
  // endpoint remains invisible to anonymous traffic.
  const params = request.nextUrl.searchParams
  if (!(await canUseGeocoder(params.get('venueId')))) {
    // 404 y no 403, por la misma razon que el panel: no anunciar que existe.
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }

  const mode = params.get('mode') === 'reverse' ? 'reverse' : 'search'

  try {
    if (mode === 'reverse') {
      const parsed = reverseSchema.safeParse({
        lat: params.get('lat'),
        lon: params.get('lon'),
      })
      if (!parsed.success) {
        return NextResponse.json({ error: 'Coordenadas invalidas' }, { status: 400 })
      }

      const url = new URL('https://nominatim.openstreetmap.org/reverse')
      url.searchParams.set('format', 'jsonv2')
      url.searchParams.set('lat', String(parsed.data.lat))
      url.searchParams.set('lon', String(parsed.data.lon))
      url.searchParams.set('zoom', '18')
      url.searchParams.set('addressdetails', '1')

      const place = (await callNominatim(url)) as NominatimPlace
      return NextResponse.json({ results: place?.lat ? [toResult(place)] : [] })
    }

    const parsed = searchSchema.safeParse({ q: params.get('q') })
    if (!parsed.success) {
      return NextResponse.json({ error: 'Escribe al menos 3 caracteres' }, { status: 400 })
    }

    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('q', parsed.data.q)
    url.searchParams.set('addressdetails', '1')
    url.searchParams.set('limit', '5')
    // Restringir a Colombia de entrada. Sin esto, "Chapinero" trae resultados
    // de medio continente y el operador termina eligiendo el equivocado.
    url.searchParams.set('countrycodes', 'co')
    url.searchParams.set(
      'viewbox',
      `${COLOMBIA_BOUNDS.minLng},${COLOMBIA_BOUNDS.maxLat},${COLOMBIA_BOUNDS.maxLng},${COLOMBIA_BOUNDS.minLat}`
    )
    url.searchParams.set('bounded', '1')

    const places = (await callNominatim(url)) as NominatimPlace[]
    return NextResponse.json({ results: (places ?? []).map(toResult) })
  } catch {
    return NextResponse.json(
      { error: 'No se pudo buscar la dirección. Intenta de nuevo.' },
      { status: 502 }
    )
  }
}
