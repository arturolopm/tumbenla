'use client'

import Link from 'next/link'

import { cn } from '@/lib/utils/css'
import type { VenueSummary } from '@/lib/venues/types'
import { pledgeShortLabel } from './pledge-badge'

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
 * compromiso como etiqueta en la esquina.
 *
 * En la maqueta esa etiqueta era un genero musical ("Salsa & Solidaridad").
 * Aca lleva el compromiso, que es el dato que de verdad distingue un sitio de
 * otro en este producto.
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
      <div className="absolute top-0 right-0 z-10 p-2">
        <span className="rounded bg-lime px-2 py-1 font-display text-background text-label-sm uppercase tracking-wider shadow-lg shadow-lime/20">
          {pledgeShortLabel(venue.pledge)}
        </span>
      </div>

      <div className="halftone-overlay relative h-32 w-full bg-muted">
        {venue.coverImageUrl ? (
          // Plain <img>: remote hosts are not configured in next.config yet, so
          // next/image would fail at runtime.
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
