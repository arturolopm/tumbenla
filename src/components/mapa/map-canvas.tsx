'use client'

import { MapLibreMap } from 'maplibre-gl'
import { useEffect, useRef, useState } from 'react'

// El CSS se importa aca adentro y no en globals.css a proposito: asi Turbopack
// lo mete en el chunk de este componente, que ya se carga en diferido, en vez
// de en el bundle de cada pagina del sitio.
import 'maplibre-gl/dist/maplibre-gl.css'

import { COLOMBIA_MAX_BOUNDS, DEFAULT_CENTER, DEFAULT_ZOOM } from '@/lib/mapa/config'
import { darkStyle } from '@/lib/mapa/dark-style'
import { cn } from '@/lib/utils/css'

/**
 * El lienzo. Es duenio del ciclo de vida del objeto Map y de nada mas: quien
 * pinta marcadores y mueve la camara es venues-map.
 *
 * IMPORTANTE PARA QUIEN LO USE: el contenedor de arriba tiene que estar
 * posicionado (relative/absolute) y tener altura propia. Este componente se
 * monta con `absolute inset-0` y no depende de ninguna cadena de alturas en
 * porcentaje, justamente para que no haya forma de que herede un cero.
 *
 * SOBRE EL TAMANIO, que es donde esto se rompe:
 *
 * MapLibre mide el contenedor UNA VEZ al construirse y guarda ese tamanio en
 * su transform. Si en ese instante el contenedor mide poco o nada, el canvas
 * despues crece por CSS pero el transform se queda corto, y el resultado es un
 * mapa que pinta el fondo en todo el lienzo pero los tiles solo en una banda
 * arriba: el fondo es un quad de pantalla completa y los tiles se recortan al
 * tamanio viejo. Es exactamente el sintoma que se veia.
 *
 * Por eso aca no se construye el mapa hasta que el contenedor mide de verdad,
 * y ademas se fuerza un resize despues de 'load'.
 */
export function MapCanvas({
  className,
  interactive = true,
  children,
}: {
  className?: string
  interactive?: boolean
  /** Se llama solo despues de 'load'. Antes de eso addLayer y compania tiran. */
  children?: (map: MapLibreMap) => React.ReactNode
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<MapLibreMap | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let instance: MapLibreMap | null = null
    let raf = 0

    const build = () => {
      if (instance) return

      instance = new MapLibreMap({
        container,
        style: darkStyle,
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        maxBounds: COLOMBIA_MAX_BOUNDS,
        interactive,
        // La atribucion va en nuestro propio componente, con los estilos del
        // sitio. Apagar el control no apaga la obligacion de mostrarla.
        attributionControl: false,
        // Sin rotacion: en un directorio no aporta nada y hace que la gente
        // termine con el mapa torcido sin saber como enderezarlo.
        pitchWithRotate: false,
        dragRotate: false,
        touchZoomRotate: interactive,
      })

      instance.touchZoomRotate?.disableRotation()

      // 'load' y no 'idle': idle no vuelve a dispararse nunca si la pestania
      // esta en segundo plano cuando termina de cargar, y el mapa quedaria sin
      // pines.
      instance.once('load', () => {
        // Un resize explicito aca aunque el tamanio parezca correcto. Entre la
        // construccion y el load pasan las fuentes, el layout del aside y
        // cualquier reflujo; este resize es el que sincroniza el transform con
        // el canvas antes de que se pinte el primer tile.
        instance?.resize()
        raf = requestAnimationFrame(() => instance?.resize())
        if (instance) setMap(instance)
      })
    }

    // El contenedor cambia de ancho al alternar Lista/Mapa y al abrir los
    // filtros, y MapLibre solo mira el tamanio cuando se lo dicen. Este mismo
    // observer es el que dispara la construccion inicial en cuanto el
    // contenedor deja de medir cero.
    const observer = new ResizeObserver(() => {
      if (container.clientWidth === 0 || container.clientHeight === 0) return
      if (!instance) build()
      else instance.resize()
    })
    observer.observe(container)

    // Si ya tiene tamanio en este momento, no hay que esperar al observer.
    if (container.clientWidth > 0 && container.clientHeight > 0) build()

    return () => {
      observer.disconnect()
      cancelAnimationFrame(raf)
      // OBLIGATORIO. React 19 en StrictMode corre los efectos dos veces en dev;
      // sin este remove() se filtra un contexto WebGL por montaje y el
      // navegador corta alrededor de los 16, momento en el cual el mapa
      // simplemente deja de aparecer sin ningun error visible.
      instance?.remove()
      instance = null
      setMap(null)
    }
  }, [interactive])

  return (
    <div className={cn('absolute inset-0', className)}>
      {/* h-full w-full, NO absolute inset-0.

          MapLibre le pone la clase .maplibregl-map a este nodo, y su hoja de
          estilos declara `.maplibregl-map { position: relative }`. Eso pisa
          cualquier position:absolute que le pongamos, y con position:relative
          las cuatro anclas de inset-0 dejan de dimensionar: el div colapsa a la
          altura de su contenido. Medido en el navegador: el padre daba 792px y
          este nodo 80px, que es exactamente la banda de tiles que se veia.

          Una altura explicita sobrevive a que le cambien el position. */}
      <div ref={containerRef} className="h-full w-full" />
      {map ? children?.(map) : null}
    </div>
  )
}
