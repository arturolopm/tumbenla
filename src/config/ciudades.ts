import { slugify } from '@/lib/utils/slug'

/**
 * Donde estamos y donde vamos.
 *
 * Prueba de concepto: Manizales y nada mas. Este archivo es el unico lugar
 * donde eso esta escrito, para que abrir una ciudad nueva sea cambiar un
 * `estado` y no perseguir el nombre por media docena de componentes.
 *
 * Las coordenadas son del centro de cada ciudad y solo se usan para calcular
 * cual es la mas cercana a quien esta mirando. No pretenden ser precisas mas
 * alla de eso.
 */

export type EstadoCiudad = 'activa' | 'en_camino'

export type Ciudad = {
  /** Coincide con el slug que produce slugify(nombre). */
  slug: string
  nombre: string
  departamento: string
  lat: number
  lng: number
  estado: EstadoCiudad
}

export const CIUDADES: Ciudad[] = [
  {
    slug: 'manizales',
    nombre: 'Manizales',
    departamento: 'Caldas',
    lat: 5.0689,
    lng: -75.5174,
    estado: 'activa',
  },
  {
    slug: 'pereira',
    nombre: 'Pereira',
    departamento: 'Risaralda',
    lat: 4.8133,
    lng: -75.6961,
    estado: 'en_camino',
  },
  {
    slug: 'armenia',
    nombre: 'Armenia',
    departamento: 'Quindio',
    lat: 4.5339,
    lng: -75.6811,
    estado: 'en_camino',
  },
  {
    slug: 'bogota',
    nombre: 'Bogota',
    departamento: 'Cundinamarca',
    lat: 4.711,
    lng: -74.0721,
    estado: 'en_camino',
  },
  {
    slug: 'medellin',
    nombre: 'Medellin',
    departamento: 'Antioquia',
    lat: 6.2442,
    lng: -75.5812,
    estado: 'en_camino',
  },
  {
    slug: 'cali',
    nombre: 'Cali',
    departamento: 'Valle del Cauca',
    lat: 3.4516,
    lng: -76.532,
    estado: 'en_camino',
  },
]

export const ciudadesActivas = () => CIUDADES.filter((c) => c.estado === 'activa')
export const ciudadesEnCamino = () => CIUDADES.filter((c) => c.estado === 'en_camino')

/**
 * Busca por nombre, tolerando como venga escrito.
 *
 * El nombre puede llegar de la cabecera de geolocalizacion del proveedor, del
 * campo `city` de un sitio que escribio un operador, o de la URL. Entre esas
 * tres aparece "Bogotá", "BOGOTA" y "bogota" indistintamente, asi que se
 * compara siempre por slug: slugify ya pliega tildes y la ñ.
 */
export const buscarCiudad = (nombre?: string | null): Ciudad | null => {
  if (!nombre) return null
  const slug = slugify(nombre)
  if (!slug) return null
  return CIUDADES.find((c) => c.slug === slug) ?? null
}

/** Grados a radianes. */
const rad = (grados: number) => (grados * Math.PI) / 180

/**
 * Haversine. Devuelve kilometros.
 *
 * Es exagerado para comparar seis ciudades, pero la alternativa (restar
 * coordenadas a lo bruto) se equivoca con la longitud a medida que uno se aleja
 * del ecuador, y comparar Cali con Bogota por diferencia de grados ya empieza a
 * mentir.
 */
export const distanciaKm = (
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
) => {
  const R = 6371
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/**
 * La ciudad activa mas cercana a un punto. Sin punto, la primera activa.
 *
 * Hoy siempre devuelve Manizales porque es la unica activa. Se escribe general
 * igual, porque el dia que se abra la segunda ciudad este es exactamente el
 * lugar donde habria un bug si estuviera escrito a la medida de una sola.
 */
export const ciudadActivaMasCercana = (punto?: { lat: number; lng: number } | null) => {
  const activas = ciudadesActivas()
  if (activas.length === 0) return null
  if (!punto) return activas[0]

  return activas.reduce((mejor, ciudad) =>
    distanciaKm(punto, ciudad) < distanciaKm(punto, mejor) ? ciudad : mejor
  )
}

/** Nombre de la cookie que escribe proxy.ts con lo que dio la geolocalizacion por IP. */
export const COOKIE_CIUDAD = 'tumbenla-geo'

/** Clave de localStorage donde se guarda la ciudad que la persona eligio a mano. */
export const STORAGE_CIUDAD = 'tumbenla:ciudad'
