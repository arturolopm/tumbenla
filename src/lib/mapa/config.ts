import { COLOMBIA_BOUNDS } from '@/lib/venues/schemas'

/**
 * Encuadre y limites del mapa.
 *
 * Los limites salen de COLOMBIA_BOUNDS, el mismo objeto contra el que valida
 * Zod al guardar un sitio. Declararlos aparte aca dejaria que el mapa y el
 * formulario se fueran separando sin que nada avisara.
 */

/** [oeste, sur, este, norte], que es el orden que espera maxBounds. */
export const COLOMBIA_MAX_BOUNDS: [number, number, number, number] = [
  COLOMBIA_BOUNDS.minLng,
  COLOMBIA_BOUNDS.minLat,
  COLOMBIA_BOUNDS.maxLng,
  COLOMBIA_BOUNDS.maxLat,
]

/** Bogota. Solo se usa cuando no hay ni un sitio del cual sacar el encuadre. */
export const DEFAULT_CENTER: [number, number] = [-74.072, 4.711]
export const DEFAULT_ZOOM = 11

/** Zoom al que se acerca la camara cuando se selecciona un sitio. */
export const FOCUS_ZOOM = 15

/**
 * Margen del fitBounds, calculado sobre el tamanio real del lienzo.
 *
 * No es un objeto fijo porque la esquina inferior derecha esta ocupada por la
 * leyenda y por la atribucion de OSM, y un margen en pixeles duros o deja pines
 * debajo de la leyenda en escritorio, o se come el mapa entero en movil.
 * Medido: con un margen fijo de 96 abajo, el pin de Usaquen quedaba tapado.
 *
 * Los topes evitan que en una pantalla angosta el margen se coma mas de la
 * cuenta, y los porcentajes evitan que en una ancha se quede corto.
 */
export const fitPaddingFor = (width: number, height: number) => ({
  top: Math.round(Math.min(64, height * 0.08)),
  left: Math.round(Math.min(64, width * 0.08)),
  // La leyenda mide alrededor de 190px y vive pegada a la derecha.
  right: Math.round(Math.min(230, Math.max(48, width * 0.24))),
  // Leyenda + atribucion.
  bottom: Math.round(Math.min(150, Math.max(48, height * 0.2))),
})

/**
 * Un solo sitio no tiene caja: fitBounds sobre un punto haria zoom hasta el
 * maximo. Este es el margen en grados que se le da alrededor.
 */
export const SINGLE_VENUE_PADDING_DEG = 0.01
