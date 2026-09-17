import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'

type BackToVenueLinkProps = {
  venueName: string
  venueSlug: string
}

/** A visible, touch-friendly exit from the focused purchase and order flows. */
export const BackToVenueLink = ({ venueName, venueSlug }: BackToVenueLinkProps) => (
  <Link
    href={`/sitios/${venueSlug}`}
    className='-ml-2 inline-flex min-h-11 max-w-full items-center gap-2 rounded-lg px-2 text-muted-foreground text-sm transition-colors hover:text-primary-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background active:text-lime'
  >
    <ArrowLeftIcon aria-hidden='true' className='size-5 shrink-0' strokeWidth={2.25} />
    <span className='font-semibold'>Volver a {venueName}</span>
  </Link>
)
