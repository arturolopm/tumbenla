'use client'

import Link from 'next/link'

import { cn } from '@/lib/utils/css'
import type { VenueSummary } from '@/lib/venues/types'
import { aporteShortLabel } from './aporte-badge'

const TYPE_LABEL: Record<string, string> = {
  bar: 'Bar',
  discoteca: 'Discoteca',
  club: 'Club',
  terraza: 'Terraza',
  restobar: 'Restobar',
  billar: 'Billar',
}

/**
 * La tarjeta de Stitch: borde de 2px que se enciende al pasar por encima, la
 * foto en mix-blend-luminosity que recupera su color al hacer hover, y el
 * aporte como etiqueta en la esquina.
 *
 * En la maqueta esa etiqueta era un genero musical ("Salsa & Solidaridad").
 * Aca llevaba el compromiso —"10 % de sus ventas"—, y ahora lleva algo mas
 * fuerte: lo que el sitio YA entrego, o lo que pone el trago mas barato de su
 * carta (decision 34). Es la misma idea de antes, distinguir un sitio de otro
 * por lo que pone, pero con una cifra que se puede cruzar contra una factura.
 *
 * PUEDE NO HABER ETIQUETA. Un sitio recien publicado, sin entregas y sin carta,
 * no pinta ninguna: un "$0 puestos" se lee como un reproche a un bar al que
 * todavia no le hemos comprado nada.
 */
export function VenueCard({
  venue,
  active = false,
  onHover,
  onSelect,
}: {
  venue: VenueSummary
  active?: boolean
  onHover?: (id: string | null) => void
  onSelect?: (id: string) => void
}) {
  const aporte = aporteShortLabel(venue.chip)

  return (
    <article
      // Hover is the desktop pairing between a card and its pin. Focus is the
      // keyboard equivalent, so both drive the same handler; without the focus
      // half, tabbing through the list would leave the map inert.
      onMouseEnter={() => onHover?.(venue.id)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(venue.id)}
      onBlur={() => onHover?.(null)}
      className={cn(
        'group relative overflow-hidden rounded-xl border-2 bg-card transition-colors duration-300',
        active ? 'border-lime' : 'border-border hover:border-party'
      )}
    >
      {aporte ? (
        <div className="absolute top-0 right-0 z-10 p-2">
          <span className="rounded bg-lime px-2 py-1 font-display text-background text-label-sm uppercase tracking-wider shadow-lg shadow-lime/20">
            {aporte}
          </span>
        </div>
      ) : null}

      <div className="halftone-overlay relative h-32 w-full bg-muted">
        {venue.coverImageUrl ? (
          // Plain <img> a proposito: coverImageUrl la pega una persona y puede
          // ser de cualquier host; next/image solo sirve los de remotePatterns.
          <img
            src={venue.coverImageUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover opacity-80 mix-blend-luminosity transition-all duration-500 group-hover:opacity-100 group-hover:mix-blend-normal"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-display font-black text-5xl text-muted-foreground/30">
            {venue.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 p-4">
        <h3
          className={cn(
            'truncate font-display font-bold text-xl uppercase tracking-tight transition-colors',
            active ? 'text-lime' : 'text-street-white group-hover:text-party'
          )}
        >
          <Link
            href={`/sitios/${venue.slug}`}
            onClick={() => onSelect?.(venue.id)}
            // Stretched link: the whole card is the hit target, but the
            // accessible name still comes from the heading.
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {venue.name}
          </Link>
        </h3>

        {venue.tagline ? (
          <p className="line-clamp-2 text-body-md text-muted-foreground">{venue.tagline}</p>
        ) : null}

        <div className="mt-2 flex flex-wrap gap-2">
          {venue.neighborhood ? <Chip>{venue.neighborhood}</Chip> : null}
          <Chip>{venue.city}</Chip>
          <Chip>{TYPE_LABEL[venue.type] ?? venue.type}</Chip>
        </div>
      </div>
    </article>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded border border-secondary px-2 py-1 font-display text-label-sm text-muted-foreground">
      {children}
    </span>
  )
}
