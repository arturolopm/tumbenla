import { ATTRIBUTION } from '@/lib/mapa/dark-style'

/**
 * La atribucion de OSM es obligatoria por licencia, no es una cortesia. Se
 * apago el control nativo de MapLibre para poder darle los estilos del sitio,
 * asi que este componente es el que cumple el requisito y tiene que renderizarse
 * siempre que se renderice el mapa.
 */
export function MapAttribution() {
  return (
    <div className="pointer-events-none absolute right-0 bottom-0 z-10 p-2">
      <p className="pointer-events-auto rounded-sm bg-background/80 px-2 py-1 text-[10px] text-muted-foreground leading-none backdrop-blur-sm">
        ©{' '}
        <a
          href={ATTRIBUTION.osm.href}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-dotted underline-offset-2 hover:text-foreground"
        >
          {ATTRIBUTION.osm.label}
        </a>{' '}
        ·{' '}
        <a
          href={ATTRIBUTION.carto.href}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-dotted underline-offset-2 hover:text-foreground"
        >
          {ATTRIBUTION.carto.label}
        </a>
      </p>
    </div>
  )
}
