'use client'

import { LngLatBounds, type MapLibreMap, Marker } from 'maplibre-gl'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef } from 'react'

import { pledgeShortLabel } from '@/components/sitios/pledge-badge'
import { FOCUS_ZOOM, SINGLE_VENUE_PADDING_DEG, fitPaddingFor } from '@/lib/mapa/config'
import type { VenueSummary } from '@/lib/venues/types'
import { MapAttribution } from './map-attribution'
import { MapCanvas } from './map-canvas'

/**
 * Marcadores DOM y no una capa GeoJSON.
 *
 * Con decenas de sitios la diferencia de rendimiento entre las dos es cero, y
 * los marcadores DOM se estilan con las mismas clases que el resto del sitio,
 * reciben anillo de focus-visible y son enlaces de verdad para un lector de
 * pantalla. Una capa GeoJSON es un lienzo opaco: no hay foco, no hay tab, no hay
 * nombre accesible. Si esto llega a cientos de sitios, la migracion correcta es
 * a una capa con clustering y una consulta acotada por viewport contra
 * venue_lat_lng_idx, no seguir apilando nodos.
 *
 * EL MODELO DE INTERACCION, que es donde estaba el bug:
 *
 *   Escritorio  hover en el pin       -> aparece la tarjeta y se resalta en la lista
 *               clic en pin o tarjeta -> pagina del sitio
 *   Movil       toque en el pin       -> abre la tarjeta (no navega)
 *               toque en la tarjeta   -> pagina del sitio
 *               toque en el mapa      -> cierra la tarjeta
 *               mantener presionado   -> vistazo: se asoma mientras el dedo
 *                                        siga abajo y se cierra al soltar
 *
 * Antes, hacer clic en un pin recentraba la camara. Como el pin se dibuja sobre
 * una coordenada y la camara se movia debajo, el pin se iba del dedo: parecia
 * que los puntos se movieran solos al tocarlos.
 */

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Cuanto hay que mantener presionado en movil para que salga la tarjeta. */
const LONG_PRESS_MS = 450
/** Si el dedo se mueve mas que esto, era un arrastre del mapa, no una pulsacion. */
const LONG_PRESS_SLOP_PX = 10

/**
 * El pin de Stitch: un punto con glow y un anillo que late alrededor.
 *
 * El color distingue la FORMA del compromiso, no su tamano: naranja para los
 * que ponen un porcentaje, ambar para los que ponen un monto fijo. Los dos
 * tienen el mismo diametro y el mismo brillo a proposito. Un bar que pone
 * $1.000 por cerveza no esta prometiendo menos que uno que pone 10%, y pintar
 * uno mas fuerte que el otro los rankearia sin decirlo.
 */
/**
 * EL ELEMENTO EXTERIOR NO LLEVA NI UNA CLASE QUE TOQUE `transform` NI `scale`.
 *
 * MapLibre posiciona el marcador escribiendo `transform: translate(...)` en
 * linea sobre este nodo. Las utilidades de escala de Tailwind usan la propiedad
 * CSS `scale`, que el navegador aplica ANTES que `transform`, asi que el
 * translate de posicionamiento queda multiplicado: con scale-150 un
 * translate(688px) se convierte en 1032px y el pin se va del mapa. Medido: al
 * pasar el mouse, el pin saltaba de x=724 a x=1060 sin que el transform en
 * linea cambiara un caracter.
 *
 * Por eso el punto visible es un hijo. Ese si puede escalar todo lo que quiera,
 * porque nadie mas le escribe transformaciones.
 */
const MARKER_BASE =
  'group/pin block size-4 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-street-white focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-full'

const DOT_BASE =
  'absolute inset-0 rounded-full transition-transform duration-200 motion-reduce:transition-none'

const DOT_TONE = {
  percentage: 'bg-primary shadow-[0_0_15px_var(--primary)]',
  fixed_per_unit: 'bg-party shadow-[0_0_15px_var(--party)]',
} as const

// La lima es el punto mas brillante de la paleta (15.3:1). Por eso es el estado
// seleccionado y nada mas: si apareciera en dos sitios a la vez dejaria de
// leerse como seleccion. Por eso tampoco esta en la leyenda.
const DOT_ACTIVE = 'bg-lime shadow-[0_0_18px_var(--lime)] scale-150'

const RING_BASE =
  '-translate-x-1/2 -translate-y-1/2 pointer-events-none absolute top-1/2 left-1/2 size-12 animate-ping rounded-full border opacity-40 motion-reduce:animate-none'

const RING_TONE = {
  percentage: 'border-primary',
  fixed_per_unit: 'border-party',
} as const

const dotClass = (venue: VenueSummary, active: boolean) =>
  `${DOT_BASE} ${active ? DOT_ACTIVE : DOT_TONE[venue.pledge.type]}`

const ringClass = (venue: VenueSummary, active: boolean) =>
  `${RING_BASE} ${active ? 'border-lime' : RING_TONE[venue.pledge.type]}`

/**
 * La tarjeta sobre el pin.
 *
 * En reposo es invisible y transparente al puntero. En hover se enciende Y
 * recibe eventos, para que hacer clic sobre ella tambien lleve a la pagina del
 * sitio: la tarjeta vive dentro del <a>, asi que un clic ahi es un clic en el
 * enlace.
 */
const TIP_BASE =
  '-translate-x-1/2 pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-48 rounded-lg border-2 border-lime bg-popover p-3 text-left opacity-0 transition-opacity duration-200 group-hover/pin:pointer-events-auto group-hover/pin:opacity-100'

/**
 * El estado abierto se aplica con estilo EN LINEA, no con clases.
 *
 * Intentarlo con clases no funciona: `pointer-events-none` (del estado en
 * reposo) y `pointer-events-auto` tienen la misma especificidad, asi que gana
 * el que la hoja emita de ultimo, no el que uno agregue de ultimo. Medido en el
 * CSS compilado: `auto` sale en la posicion 104327 y `none` en la 104368, o sea
 * que `none` ganaba siempre y los toques sobre la tarjeta se colaban al mapa
 * en vez de navegar.
 *
 * Un estilo en linea le gana a cualquier clase y no depende del orden de
 * compilacion. Volver a `''` borra el inline y devuelve el control a las clases
 * (incluido el hover de escritorio).
 */
const abrirTarjeta = (tip: HTMLElement, abierta: boolean) => {
  tip.style.opacity = abierta ? '1' : ''
  tip.style.pointerEvents = abierta ? 'auto' : ''
}

type Entry = {
  marker: Marker
  el: HTMLAnchorElement
  dot: HTMLElement
  ring: HTMLElement
  tip: HTMLElement
}

export function VenuesMap({
  venues,
  activeId,
  onActiveChange,
}: {
  venues: VenueSummary[]
  activeId: string | null
  onActiveChange: (id: string | null) => void
}) {
  return (
    // absolute inset-0 y no h-full: el padre en el explorer ya es relative con
    // altura fija, y asi no hay una cadena de alturas en porcentaje que pueda
    // resolver a cero y dejar el mapa construido en un contenedor sin tamanio.
    <div className="absolute inset-0">
      <MapCanvas>
        {(map) => (
          <VenueMarkers
            map={map}
            venues={venues}
            activeId={activeId}
            onActiveChange={onActiveChange}
          />
        )}
      </MapCanvas>

      {/* Leyenda. En la maqueta explicaba tres categorias de sitio que aca no
          existen; la distincion real de este producto es la forma del
          compromiso, que es lo que explica. La lima no aparece porque no es una
          categoria: es el estado seleccionado. */}
      <div className="absolute right-4 bottom-12 z-20 flex flex-col gap-2 rounded-xl border-2 border-secondary bg-background/90 p-4 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="size-3 shrink-0 rounded-full bg-primary" />
          <span className="font-display text-label-sm text-street-white">
            Pone un porcentaje
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="size-3 shrink-0 rounded-full bg-party" />
          <span className="font-display text-label-sm text-street-white">
            Pone un monto fijo
          </span>
        </div>
      </div>

      <MapAttribution />
    </div>
  )
}

function VenueMarkers({
  map,
  venues,
  activeId,
  onActiveChange,
}: {
  map: MapLibreMap
  venues: VenueSummary[]
  activeId: string | null
  onActiveChange: (id: string | null) => void
}) {
  const router = useRouter()
  const markersRef = useRef(new Map<string, Entry>())

  /** Que tarjeta esta abierta por pulsacion larga. Solo puede haber una. */
  const previewRef = useRef<string | null>(null)

  // onActiveChange y router entran en listeners nativos que se registran una
  // sola vez por marcador. Guardarlos en refs evita recrear cada marcador cada
  // vez que el padre re-renderiza con funciones nuevas.
  const onActiveChangeRef = useRef(onActiveChange)
  const routerRef = useRef(router)
  useEffect(() => {
    onActiveChangeRef.current = onActiveChange
    routerRef.current = router
  }, [onActiveChange, router])

  // La identidad del conjunto filtrado. Sin esto, fitBounds se dispararia en
  // cada render aunque los sitios sean exactamente los mismos, y la camara
  // pelearia con el usuario mientras arrastra.
  const venuesKey = useMemo(() => venues.map((v) => v.id).join(','), [venues])

  /** Abre una tarjeta y cierra la anterior. `null` las cierra todas. */
  const setPreview = (id: string | null) => {
    previewRef.current = id
    for (const [key, entry] of markersRef.current) {
      abrirTarjeta(entry.tip, key === id)
    }
  }

  useEffect(() => {
    const markers = markersRef.current
    const seen = new Set<string>()

    for (const venue of venues) {
      seen.add(venue.id)
      if (markers.has(venue.id)) continue

      // Un <a> de verdad y no un <button>: el destino es una pagina, asi que
      // tiene que funcionar el clic con rueda, el cmd+clic y el "abrir en otra
      // pestania" del menu contextual.
      const el = document.createElement('a')
      // ?desde=mapa: se lo lleva la pagina del sitio para que su enlace de
      // volver devuelva al mapa y no a la lista.
      el.href = `/sitios/${venue.slug}?desde=mapa`
      el.className = MARKER_BASE
      el.setAttribute(
        'aria-label',
        `${venue.name}, ${venue.neighborhood ? `${venue.neighborhood}, ` : ''}${venue.city}`
      )

      // El punto visible. Va aparte del <a> porque es el que escala, y el <a>
      // lo tiene tomado MapLibre para posicionarlo. Ver la nota de arriba.
      const dot = document.createElement('span')
      dot.setAttribute('aria-hidden', 'true')
      dot.className = dotClass(venue, false)
      el.appendChild(dot)

      // El anillo que late. Decorativo, escondido del arbol de accesibilidad:
      // el nombre accesible ya lo da el aria-label del enlace.
      const ring = document.createElement('span')
      ring.setAttribute('aria-hidden', 'true')
      ring.className = ringClass(venue, false)
      el.appendChild(ring)

      // textContent y no innerHTML: el nombre y el barrio vienen de la base de
      // datos y los escribe un operador, asi que no se inyectan como markup.
      const tip = document.createElement('span')
      tip.className = TIP_BASE

      const tipPledge = document.createElement('span')
      tipPledge.className = 'block font-display text-label-sm text-lime uppercase'
      tipPledge.textContent = pledgeShortLabel(venue.pledge)

      const tipName = document.createElement('span')
      tipName.className = 'block truncate font-bold text-body-md text-street-white'
      tipName.textContent = venue.name

      tip.append(tipPledge, tipName)
      el.appendChild(tip)

      // Hover de escritorio: resalta la tarjeta en la lista. La tarjeta flotante
      // la enciende el CSS via group-hover, sin pasar por React.
      el.addEventListener('mouseenter', () => onActiveChangeRef.current(venue.id))
      // Sin el mouseleave, el primer hover dejaba el pin encendido para
      // siempre: nada lo apagaba salvo hacer clic en el mapa.
      el.addEventListener('mouseleave', () => {
        if (previewRef.current === venue.id) return
        onActiveChangeRef.current(null)
      })

      // --- Gestos tactiles -------------------------------------------------
      //
      //   toque corto en el pin   -> abre la tarjeta (NO navega)
      //   toque en la tarjeta     -> pagina del sitio
      //   toque en el mapa        -> cierra la tarjeta
      //   mantener presionado     -> vistazo: la tarjeta se asoma mientras el
      //                              dedo siga abajo y se cierra al soltar
      //
      // El pin mide 16px. Que un toque ahi navegue de una es apostar a que la
      // persona le acerto al punto que queria entre cinco que se solapan; abrir
      // la tarjeta primero le deja confirmar que es el sitio correcto antes de
      // irse de la pagina.
      let timer: ReturnType<typeof setTimeout> | null = null
      let startX = 0
      let startY = 0
      let tactil = false
      let vistazo = false
      // Si el dedo bajo sobre la tarjeta, esto no es un gesto sobre el pin: hay
      // que dejarlo pasar tal cual para que el clic navegue. Sin esto, tocar la
      // tarjeta disparaba tambien el toggle del pin y la cerraba antes de
      // alcanzar a navegar.
      let desdeTarjeta = false

      const cancelTimer = () => {
        if (timer) clearTimeout(timer)
        timer = null
      }

      const abrir = () => {
        setPreview(venue.id)
        onActiveChangeRef.current(venue.id)
      }

      const cerrar = () => {
        setPreview(null)
        onActiveChangeRef.current(null)
      }

      el.addEventListener('pointerdown', (event) => {
        tactil = event.pointerType !== 'mouse'
        if (!tactil) return

        desdeTarjeta = tip.contains(event.target as Node)
        if (desdeTarjeta) return

        startX = event.clientX
        startY = event.clientY
        vistazo = false
        timer = setTimeout(() => {
          vistazo = true
          abrir()
        }, LONG_PRESS_MS)
      })

      el.addEventListener('pointermove', (event) => {
        if (!tactil || desdeTarjeta) return
        // Si el dedo se corrio, la persona esta arrastrando el mapa y no
        // pidiendo la tarjeta.
        if (
          Math.abs(event.clientX - startX) > LONG_PRESS_SLOP_PX ||
          Math.abs(event.clientY - startY) > LONG_PRESS_SLOP_PX
        ) {
          cancelTimer()
          if (vistazo) {
            vistazo = false
            cerrar()
          }
        }
      })

      const soltar = () => {
        if (!tactil) return
        if (desdeTarjeta) {
          desdeTarjeta = false
          return
        }
        cancelTimer()

        if (vistazo) {
          // El vistazo dura lo que dura la presion.
          vistazo = false
          cerrar()
          return
        }

        // Toque corto: alterna la tarjeta de este pin.
        if (previewRef.current === venue.id) cerrar()
        else abrir()
      }

      el.addEventListener('pointerup', soltar)
      el.addEventListener('pointercancel', () => {
        if (!tactil) return
        cancelTimer()
        desdeTarjeta = false
        if (vistazo) {
          vistazo = false
          cerrar()
        }
      })

      // Sin esto, mantener presionado en movil abre el menu contextual del
      // navegador encima de la tarjeta.
      el.addEventListener('contextmenu', (event) => {
        if (tactil) event.preventDefault()
      })

      el.addEventListener('click', (event) => {
        // Sin esto MapLibre trata el clic como un clic en el mapa y, mas
        // abajo, lo interpreta como "cerrar y deseleccionar".
        event.stopPropagation()

        // cmd/ctrl/shift/clic-medio se dejan al navegador para que "abrir en
        // otra pestania" siga funcionando.
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return

        const enLaTarjeta = tip.contains(event.target as Node)

        // En tactil el pin NO navega: solo abre la tarjeta, y quien navega es la
        // tarjeta. En escritorio el pin entero es el enlace, como siempre.
        if (tactil && !enLaTarjeta) {
          event.preventDefault()
          return
        }

        event.preventDefault()
        routerRef.current.push(`/sitios/${venue.slug}?desde=mapa`)
      })

      const marker = new Marker({ element: el }).setLngLat([venue.lng, venue.lat]).addTo(map)

      markers.set(venue.id, { marker, el, dot, ring, tip })
    }

    // Los que salieron del filtro se quitan del mapa de verdad; dejarlos
    // ocultos con CSS los mantendria en el arbol de accesibilidad.
    for (const [id, entry] of markers) {
      if (seen.has(id)) continue
      entry.marker.remove()
      markers.delete(id)
    }
  }, [map, venues])

  // Desmontaje: limpiar TODOS los marcadores. map.remove() en MapCanvas destruye
  // el lienzo, pero los nodos de los marcadores viven en el DOM del contenedor
  // y son responsabilidad de quien los creo.
  useEffect(() => {
    const markers = markersRef.current
    return () => {
      for (const entry of markers.values()) entry.marker.remove()
      markers.clear()
    }
  }, [])

  // Un toque en el mapa vacio cierra la tarjeta y deselecciona. Es el "volver al
  // mapa" del gesto de movil, y en escritorio es lo que ya espera cualquiera.
  useEffect(() => {
    const handleMapClick = () => {
      setPreview(null)
      onActiveChangeRef.current(null)
    }
    map.on('click', handleMapClick)
    return () => {
      map.off('click', handleMapClick)
    }
  }, [map])

  // Encuadre sobre el conjunto filtrado.
  useEffect(() => {
    if (venues.length === 0) return

    const bounds = new LngLatBounds()
    for (const venue of venues) bounds.extend([venue.lng, venue.lat])

    if (venues.length === 1) {
      // fitBounds sobre una caja de area cero se va al zoom maximo y deja al
      // usuario mirando un tejado. Se le da un margen en grados.
      const only = venues[0]
      bounds.extend([
        only.lng - SINGLE_VENUE_PADDING_DEG,
        only.lat - SINGLE_VENUE_PADDING_DEG,
      ])
      bounds.extend([
        only.lng + SINGLE_VENUE_PADDING_DEG,
        only.lat + SINGLE_VENUE_PADDING_DEG,
      ])
    }

    const canvas = map.getContainer()

    map.fitBounds(bounds, {
      padding: fitPaddingFor(canvas.clientWidth, canvas.clientHeight),
      maxZoom: FOCUS_ZOOM,
      animate: !prefersReducedMotion(),
    })
  }, [map, venues, venuesKey])

  // Seleccion: pintar el marcador y, SOLO SI HACE FALTA, mover la camara.
  useEffect(() => {
    for (const [id, entry] of markersRef.current) {
      const own = venues.find((v) => v.id === id)
      if (!own) continue
      const activo = id === activeId
      entry.dot.className = dotClass(own, activo)
      entry.ring.className = ringClass(own, activo)
    }

    if (!activeId) return
    const venue = venues.find((v) => v.id === activeId)
    if (!venue) return

    // LA CAMARA NO SE MUEVE SI EL PIN YA SE VE.
    //
    // Recentrar siempre era el bug de "los puntos se mueven al tocarlos": el
    // pin esta clavado a una coordenada y la camara se deslizaba debajo, asi
    // que el punto se escapaba del cursor o del dedo justo despues de tocarlo.
    // Mover la camara solo tiene sentido cuando la seleccion viene de la lista
    // y el pin esta fuera de cuadro; si ya esta a la vista, no hay nada que
    // resolver y moverse es puro mareo.
    if (map.getBounds().contains([venue.lng, venue.lat])) return

    // easeTo y no flyTo: flyTo hace el arco con zoom-out intermedio, que sobre
    // distancias cortas (que es el caso normal, de una tarjeta a la de al lado)
    // se siente mareador en vez de fluido.
    map.easeTo({
      center: [venue.lng, venue.lat],
      duration: prefersReducedMotion() ? 0 : 500,
    })
  }, [map, activeId, venues])

  return null
}
