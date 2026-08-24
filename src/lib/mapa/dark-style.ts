import type { StyleSpecification } from 'maplibre-gl'

/**
 * Estilo oscuro, construido a mano sobre tiles raster.
 *
 * POR QUE RASTER Y NO VECTOR: un estilo vectorial decente necesita una cuenta y
 * una llave con casi todos los proveedores. La decision del proyecto fue "sin
 * cuenta, sin llave, sin tarjeta", y CARTO sirve su basemap oscuro por CDN sin
 * ninguna de las tres.
 *
 * POR QUE PAINT PROPERTIES Y NO UN filter DE CSS: un filter sobre el contenedor
 * tine TODO lo que hay dentro, incluidos los marcadores DOM y los popups, que
 * es justo lo que no se quiere: los pines naranjas saldrian lavados junto con el
 * mapa. Las paint properties corren en la GPU dentro del render pass que
 * MapLibre ya hace, y solo tocan la capa raster.
 *
 * No se usan los tiles de openstreetmap.org directamente: son solo claros
 * (invertirlos con CSS invertiria tambien los marcadores) y su politica de uso
 * desaconseja explicitamente el uso en aplicaciones.
 *
 * SALIDA SI LOS TERMINOS INCOMODAN: generar un extracto .pmtiles de Colombia y
 * servirlo desde el bucket R2 que ya existe en src/lib/storage.ts. El resto de
 * este modulo no cambia, solo la entrada de `sources`.
 */

/** Obligatoria por licencia. Se renderiza siempre, no es opcional. */
export const ATTRIBUTION = {
  osm: { label: 'OpenStreetMap', href: 'https://www.openstreetmap.org/copyright' },
  carto: { label: 'CARTO', href: 'https://carto.com/attributions' },
} as const

export const darkStyle: StyleSpecification = {
  version: 8,
  sources: {
    basemap: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
      ],
      // 256 aunque la imagen venga en 512.
      //
      // El @2x de CARTO es un tile de 256 UNIDADES servido a doble densidad:
      // el PNG mide 512x512 px pero cubre el mismo terreno que el de 256.
      // Verificado leyendo la cabecera del PNG. Declarar tileSize: 512 le dice
      // a MapLibre que cada tile cubre el doble de terreno, y el mapa entero
      // termina corrido un nivel de zoom.
      tileSize: 256,
      maxzoom: 20,
      attribution: `<a href="${ATTRIBUTION.osm.href}" target="_blank" rel="noreferrer">${ATTRIBUTION.osm.label}</a> · <a href="${ATTRIBUTION.carto.href}" target="_blank" rel="noreferrer">${ATTRIBUTION.carto.label}</a>`,
    },
  },
  layers: [
    {
      // Un fondo del color del sitio debajo del raster. Se ve mientras los
      // tiles cargan, y evita el flash blanco que sale si no se declara.
      id: 'fondo',
      type: 'background',
      paint: { 'background-color': '#0d1321' },
    },
    {
      id: 'basemap',
      type: 'raster',
      source: 'basemap',
      paint: {
        // El basemap de CARTO es gris azulado; se desatura un poco mas para que
        // el naranja de los pines sea lo unico saturado en pantalla.
        'raster-saturation': -0.25,
        // Se hunde el techo de brillo para que el mapa quede POR DEBAJO del
        // fondo de la app y los pines floten encima en vez de competir.
        'raster-brightness-max': 0.82,
        'raster-contrast': 0.08,
        // Sin esto, cada tile aparece de golpe al terminar de cargar.
        'raster-fade-duration': 240,
      },
    },
  ],
}
