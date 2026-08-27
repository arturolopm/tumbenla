import type { Pledge } from '@/lib/venues/types'
import { formatCOP, formatPercent } from '@/lib/utils/format'
import { cn } from '@/lib/utils/css'

/**
 * The commitment, said the way a person would say it.
 *
 * The two pledge shapes get different phrasing but the same visual weight. A
 * bar putting 1.000 per beer is not making a lesser promise than a club putting
 * 10%, and styling one louder than the other would quietly rank them.
 */

/**
 * The stored unit is an ASCII enum value ('coctel'); what a reader sees is
 * Spanish with its accent. Kept apart so the DB value never has to carry one.
 */
const UNIT_LABEL: Record<string, string> = {
  coctel: 'cóctel',
}

const unitLabel = (unit: string): string => UNIT_LABEL[unit] ?? unit

export const pledgeLabel = (pledge: Pledge): string =>
  pledge.type === 'percentage'
    ? `${formatPercent(pledge.percentage)} de sus ventas`
    : `${formatCOP(pledge.amount, pledge.currency)} por ${unitLabel(pledge.unit)}`

/** Short enough for a map pin tooltip. */
export const pledgeShortLabel = (pledge: Pledge): string =>
  pledge.type === 'percentage'
    ? formatPercent(pledge.percentage)
    : `${formatCOP(pledge.amount, pledge.currency)}/${unitLabel(pledge.unit)}`

const BASIS_LABEL: Record<string, string> = {
  ventas_totales: 'sobre todo lo que venden',
  ventas_licor: 'sobre las ventas de licor',
  cover: 'sobre el cover',
}

export function PledgeBadge({
  pledge,
  size = 'default',
  className,
}: {
  pledge: Pledge
  size?: 'default' | 'lg'
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 font-medium text-primary-text',
        size === 'lg' ? 'px-4 py-2 text-base' : 'px-3 py-1 text-sm',
        className
      )}
    >
      {pledgeLabel(pledge)}
    </span>
  )
}

/** The detail-page version: the badge plus whatever nuance the venue gave. */
export function PledgeDetail({ pledge }: { pledge: Pledge }) {
  const basis =
    pledge.type === 'percentage' && pledge.basis ? BASIS_LABEL[pledge.basis] : null

  return (
    <div className="flex flex-col gap-3">
      <PledgeBadge pledge={pledge} size="lg" className="self-start" />
      {basis ? <p className="text-sm text-muted-foreground">{basis}</p> : null}
      {pledge.note ? (
        <p className="max-w-prose text-pretty text-muted-foreground">{pledge.note}</p>
      ) : null}
    </div>
  )
}
