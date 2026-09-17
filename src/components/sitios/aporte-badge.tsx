import { formatCOP } from '@/lib/utils/format'
import type { VenueChip } from '@/lib/venues/types'

/**
 * The one line a venue card and a map tooltip get to say about a bar.
 *
 * It replaces the pledge badge, which said "10 % de sus ventas" — a promise
 * about a till nobody outside the bar can see. This says one of two things,
 * both checkable:
 *
 *   "$120.000 puestos"          what it has actually delivered, verified
 *   "desde $4.000 en material"  what one drink puts in, right now
 *
 * Delivered wins when there is any, because a bar that has already put money in
 * has stopped promising. But the floor line is not a consolation prize: it is
 * what EVERY newly approved venue shows, since nobody has delivered anything on
 * day one, so it has to read like a real claim rather than an empty state.
 *
 * NULL IS A REAL ANSWER and both callers have to handle it: a published venue
 * with nothing delivered and no carta yet. It renders no chip. "$0 puestos"
 * would read as an accusation against a bar that simply has not been invoiced.
 */
export const aporteShortLabel = (chip: VenueChip): string | null => {
  if (chip.entregado > 0) return `${formatCOP(chip.entregado)} puestos`
  if (chip.materialDesde !== null) return `desde ${formatCOP(chip.materialDesde)} en material`
  return null
}
