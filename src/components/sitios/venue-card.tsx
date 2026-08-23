'use client'

import Link from 'next/link'

import type { VenueSummary } from '@/lib/venues/types'
import { cn } from '@/lib/utils/css'
import { PledgeBadge } from './pledge-badge'

const TYPE_LABEL: Record<string, string> = {
  bar: 'Bar',
  discoteca: 'Discoteca',
  club: 'Club',
  terraza: 'Terraza',
  restobar: 'Restobar',
  billar: 'Billar',
}

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
        'group relative overflow-hidden rounded-3xl border bg-card transition-colors',
        active ? 'border-primary/50 bg-elevated' : 'border-border hover:border-border/80'
      )}
    >
      <div className="flex gap-4 p-4">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-muted">
          {venue.coverImageUrl ? (
            // Plain <img>: remote hosts are not
            // configured in next.config yet, so next/image would fail at runtime.
            <img
              src={venue.coverImageUrl}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-display text-2xl text-muted-foreground/50">
              {venue.name.charAt(0)}
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-col gap-1">
            <h3 className="truncate font-semibold text-lg leading-tight">
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
            <p className="truncate text-muted-foreground text-sm">
              {TYPE_LABEL[venue.type] ?? venue.type}
              {venue.neighborhood ? ` en ${venue.neighborhood}` : ''}
              {`, ${venue.city}`}
            </p>
          </div>

          <PledgeBadge pledge={venue.pledge} className="self-start" />
        </div>
      </div>
    </article>
  )
}
