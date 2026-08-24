'use client'

import { type MapLibreMap, Marker } from 'maplibre-gl'
import { useEffect, useRef } from 'react'

import { FOCUS_ZOOM } from '@/lib/mapa/config'
import { MapAttribution } from './map-attribution'
import { MapCanvas } from './map-canvas'

export type PickedLocation = { lat: number; lng: number }

/**
 * Tres entradas sobre una misma coordenada: buscar una direccion, hacer clic en
 * el mapa, o arrastrar el marcador para afinar.
 *
 * Las tres existen porque resuelven cosas distintas. La busqueda te acerca al
 * barrio, el clic te pone en la cuadra, y el arrastre te pone en la puerta. Con
 * solo la busqueda, un bar sin direccion registrada en OSM es imposible de
 * ubicar, que en Colombia es la mitad de los casos.
 */
export function LocationPicker({
  value,
  onChange,
  className,
}: {
  value: PickedLocation | null
  onChange: (next: PickedLocation) => void
  className?: string
}) {
  return (
    <div className={className}>
      <div className="relative h-[340px] w-full overflow-hidden rounded-xl border border-border">
        <MapCanvas>
          {(map) => <PickerMarker map={map} value={value} onChange={onChange} />}
        </MapCanvas>
        <MapAttribution />
      </div>
      <p className="mt-2 text-muted-foreground text-xs">
        Haz clic en el mapa para poner el pin, o arrastralo para afinar.
      </p>
    </div>
  )
}

function PickerMarker({
  map,
  value,
  onChange,
}: {
  map: MapLibreMap
  value: PickedLocation | null
  onChange: (next: PickedLocation) => void
}) {
  const markerRef = useRef<Marker | null>(null)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // Crear el marcador una sola vez y despues solo moverlo. Recrearlo en cada
  // cambio de valor cortaria el arrastre a la mitad del gesto.
  useEffect(() => {
    const el = document.createElement('div')
    el.className =
      'h-8 w-8 cursor-grab rounded-md border-2 border-street-white bg-primary glow-primary active:cursor-grabbing'

    const marker = new Marker({ element: el, draggable: true })
      .setLngLat(value ? [value.lng, value.lat] : map.getCenter())
      .addTo(map)

    marker.on('dragend', () => {
      const { lat, lng } = marker.getLngLat()
      onChangeRef.current({ lat, lng })
    })

    markerRef.current = marker

    const handleMapClick = (event: { lngLat: { lat: number; lng: number } }) => {
      marker.setLngLat(event.lngLat)
      onChangeRef.current({ lat: event.lngLat.lat, lng: event.lngLat.lng })
    }
    map.on('click', handleMapClick)

    return () => {
      map.off('click', handleMapClick)
      marker.remove()
      markerRef.current = null
    }
    // value queda fuera a proposito: solo siembra la posicion inicial. La
    // sincronizacion posterior la hace el efecto de abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])

  // El valor puede cambiar desde afuera (buscar una direccion, o escribir en los
  // inputs). Mover el marcador para que no se contradiga con el formulario.
  useEffect(() => {
    if (!value || !markerRef.current) return

    const current = markerRef.current.getLngLat()
    // Comparar antes de mover: sin esto, el propio dragend reposicionaria el
    // marcador durante el gesto y se sentiria pegajoso.
    if (Math.abs(current.lat - value.lat) < 1e-9 && Math.abs(current.lng - value.lng) < 1e-9) {
      return
    }

    markerRef.current.setLngLat([value.lng, value.lat])
    map.easeTo({ center: [value.lng, value.lat], zoom: Math.max(map.getZoom(), FOCUS_ZOOM) })
  }, [map, value])

  return null
}
