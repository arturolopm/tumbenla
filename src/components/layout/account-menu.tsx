'use client'

import { LogOutIcon, StoreIcon, UserIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTransition } from 'react'

import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from '@/components/ui/menu'
import { useMyAccess } from '@/hooks/use-my-access'
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
 * THE PRICE IS THE FLICKER, and that is why `isPending` does not paint some
 * neutral state: it paints a gap of the same width. If it showed "Entrar" while
 * loading, someone with a session would see "Entrar" and then their name, which
 * is exactly what we do not want them to see.
 */

export function AccountMenu({ variant = 'bar' }: { variant?: 'bar' | 'mobile' }) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session, isPending } = useSession()
  const [signingOut, startSignOut] = useTransition()

  const { data: access } = useMyAccess(Boolean(session))

  // While it is unknown, a gap the width of the control. See the note above.
  if (isPending) {
    return <div aria-hidden className={cn('h-9', variant === 'bar' ? 'w-24' : 'w-full')} />
  }

  if (!session) {
    return (
      <Link
        href={enlaceDeLogin(pathname)}
        className={cn(
          'inline-flex items-center justify-center rounded-xl border border-secondary px-4 py-2 font-display text-label-lg uppercase transition-colors hover:border-lime hover:text-lime focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime',
          variant === 'mobile' && 'mt-2 w-full'
        )}
      >
        Entrar
      </Link>
    )
  }

  const personName = session.user.name?.trim() || session.user.email
  // With several venues the trigger shows the first; the menu lists them all.
  const mainVenue = access?.venues[0] ?? null

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
        className={cn(
          'inline-flex items-center gap-2 rounded-xl border px-3 py-2 font-display text-label-lg uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime',
          mainVenue
            ? 'border-lime text-lime hover:opacity-80'
            : 'border-secondary hover:border-lime hover:text-lime',
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
          render={<Link href='/mi-historia'>{mainVenue ? 'Verlo como rumbero' : 'Mi historia'}</Link>}
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
