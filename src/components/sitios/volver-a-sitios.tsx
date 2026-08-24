'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

/**
 * "Volver" que devuelve a donde la persona estaba de verdad.
 *
 * El enlace decia "Volver al mapa" y apuntaba a /sitios pelado. Pero el
 * explorador arranca en la vista de lista, asi que en movil alguien que tocaba
 * un pin en el mapa aterrizaba en la lista: el enlace prometia una cosa y hacia
 * otra.
 *
 * El origen viaja en la URL (`?desde=mapa`) y no en estado ni en sessionStorage
 * por dos razones: la pagina del sitio es estatica y compartible, asi que el
 * enlace tiene que seguir teniendo sentido para alguien que llego de un
 * WhatsApp; y un valor guardado se queda pegado del recorrido anterior.
 *
 * Se lee de `window.location` dentro de un efecto y NO con useSearchParams, que
 * es la misma decision que ya toma SitiosExplorer: suscribirse a los search
 * params opta al arbol entero a render dinamico y esta ruta es SSG.
 *
 * El estado inicial es el caso comun (volver a la lista), asi que si el JS no
 * llega el enlace sigue siendo correcto, solo menos especifico.
 */
export function VolverASitios() {
  const [desdeMapa, setDesdeMapa] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setDesdeMapa(params.get('desde') === 'mapa')
  }, [])

  return (
    <Link
      href={desdeMapa ? '/sitios?vista=mapa' : '/sitios'}
      className="font-display text-label-lg text-muted-foreground uppercase tracking-widest transition-colors hover:text-lime"
    >
      ← {desdeMapa ? 'Volver al mapa' : 'Volver a los sitios'}
    </Link>
  )
}
