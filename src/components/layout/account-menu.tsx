'use client'

import { LogOutIcon, StoreIcon, UserIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTransition } from 'react'

import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from '@/components/ui/menu'
import { useMyAccess } from '@/hooks/use-my-access'
import { useSessionHintSync } from '@/hooks/use-session-hint-sync'
import { signOut, useSession } from '@/lib/auth/auth-client'
import { enlaceDeLogin } from '@/lib/auth/redirect'
import { cn } from '@/lib/utils/css'

/**
 * Signing in and out, plus the hat switch between working at a bar and going
 * out to one.
 *
 * WHY THE SESSION IS READ ON THE CLIENT AND NOT IN THE LAYOUT: this bar lives
 * in (publico)/layout.tsx, which covers the landing page, /sitios and
 * /transparencia. Reading the session on the server there forces a render per
 * request and takes down the ISR of the whole public site, which is what keeps
 * the Neon database asleep and the 100 CU-hour budget within reach. Read on the
 * client, the pages stay static.
 *
 * WHAT IT PAINTS BEFORE THE SESSION ARRIVES: the session hint
 * (`session-hint.ts`). `useSession()` only asks after hydration — measured at
 * ~2.6 s after first paint on a phone — so while it is pending this renders
 * BOTH states and CSS picks one from the `data-session` mark that the inline
 * <head> script put on <html> before the first paint: "Entrar" when there is
 * no hint, otherwise a stand-in of the trigger with the hinted label. When the
 * session arrives, the real menu replaces it with the same look. Nobody sees
 * "Entrar" and then their name, and nobody waits on a blank gap either.
 */

const SIGN_IN_CLASS =
  'inline-flex items-center justify-center rounded-xl border border-secondary px-4 py-2 font-display text-label-lg uppercase transition-colors hover:border-lime hover:text-lime focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime'

/** Shared by the real trigger and its pre-hydration stand-in, so the two cannot drift apart. */
const TRIGGER_CLASS =
  'inline-flex items-center gap-2 rounded-xl border px-3 py-2 font-display text-label-lg uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime'
const TRIGGER_VENUE_CLASS = 'border-lime text-lime hover:opacity-80'
const TRIGGER_PERSON_CLASS = 'border-secondary hover:border-lime hover:text-lime'

export function AccountMenu({ variant = 'bar' }: { variant?: 'bar' | 'mobile' }) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session, isPending } = useSession()
  const [signingOut, startSignOut] = useTransition()

  const { data: access } = useMyAccess(Boolean(session))
  useSessionHintSync(isPending, session)

  // While it is unknown, both states; the hint on <html> decides which one
  // shows. See the note above.
  if (isPending) {
    return (
      <>
        <Link
          href={enlaceDeLogin(pathname)}
          className={cn(
            SIGN_IN_CLASS,
            variant === 'mobile' && 'mt-2 w-full',
            'in-data-[session=person]:hidden in-data-[session=venue]:hidden'
          )}
        >
          Entrar
        </Link>
        <span
          aria-hidden
          data-account-trigger
          className={cn(
            TRIGGER_CLASS,
            TRIGGER_PERSON_CLASS,
            'hidden in-data-[session=person]:inline-flex in-data-[session=venue]:inline-flex',
            'in-data-[session=venue]:border-lime in-data-[session=venue]:text-lime',
            variant === 'mobile' && 'mt-2 w-full justify-center'
          )}
        >
          <UserIcon className='size-4 in-data-[session=venue]:hidden' />
          <StoreIcon className='hidden size-4 in-data-[session=venue]:block' />
          <span className='max-w-32 truncate after:content-(--session-label)' />
        </span>
      </>
    )
  }

  if (!session) {
    return (
      <Link
        href={enlaceDeLogin(pathname)}
        className={cn(SIGN_IN_CLASS, variant === 'mobile' && 'mt-2 w-full')}
      >
        Entrar
      </Link>
    )
  }

  const personName = session.user.name?.trim() || session.user.email
  // Inside a venue panel the trigger must name THAT venue. Falling back to the
  // first membership is only correct on public/admin pages, where no venue is
  // active in the URL.
  const activeVenue = access?.venues.find(
    (venue) => pathname === `/panel/${venue.slug}` || pathname.startsWith(`/panel/${venue.slug}/`)
  )
  const mainVenue = activeVenue ?? access?.venues[0] ?? null

  const handleSignOut = () => {
    startSignOut(async () => {
      await signOut()
      // refresh() as well as push(), because the pages that read the session on
      // the server have to render again; without it /mi-historia stays painted
      // in the router cache after signing out.
      router.push('/')
      router.refresh()
    })
  }

  return (
    <Menu>
      {/* The trigger says the VENUE, not the person's name, when they work at
          one. Whoever runs a bar is not here to look at their profile: they are
          here for their bar, and seeing it written there is what tells them they
          are still in work mode. The name goes inside, where it matters less. */}
      <MenuTrigger
        data-account-trigger
        className={cn(
          TRIGGER_CLASS,
          mainVenue ? TRIGGER_VENUE_CLASS : TRIGGER_PERSON_CLASS,
          variant === 'mobile' && 'mt-2 w-full justify-center'
        )}
      >
        {mainVenue ? <StoreIcon className='size-4' /> : <UserIcon className='size-4' />}
        <span className='max-w-32 truncate'>{mainVenue?.name ?? personName}</span>
      </MenuTrigger>

      <MenuPopup align='end' sideOffset={8} className='min-w-52'>
        {/* Work first. For someone tending a bar, "Mi historia" is what they do
            once in a while; their panel is what they come back to all night.
            It used to be the other way around. */}
        {access?.venues.map((venue) => (
          <MenuItem
            key={venue.slug}
            render={<Link href={`/panel/${venue.slug}`}>Ir a {venue.name}</Link>}
          />
        ))}

        {access?.admin ? <MenuItem render={<Link href='/admin'>Panel de operación</Link>} /> : null}

        {mainVenue ? <MenuSeparator /> : null}

        <MenuItem
          render={
            <Link href='/mi-historia'>{mainVenue ? 'Verlo como rumbero' : 'Mi historia'}</Link>
          }
        />

        <MenuSeparator />

        <MenuItem variant='destructive' disabled={signingOut} onClick={handleSignOut}>
          <LogOutIcon />
          {signingOut ? 'Saliendo…' : 'Salir'}
        </MenuItem>
      </MenuPopup>
    </Menu>
  )
}
