'use client'

import { MenuIcon, XIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

import { useMyAccess } from '@/hooks/use-my-access'
import { useSession } from '@/lib/auth/auth-client'
import { cn } from '@/lib/utils/css'
import { AccountMenu } from './account-menu'

/**
 * The Stitch bar: fixed, translucent with grain, and with a thick bottom border
 * in the brand orange. The active item is marked in lime with an underline,
 * which is the only place on the site where lime shows up outside the map.
 *
 * The Stitch screen had a fourth item, "Eventos", and a profile avatar.
 * "Eventos" still does not exist: there is no events table. The fourth slot is
 * taken by Transparencia, which does have data behind it. The account control
 * does already exist, in AccountMenu, because the product has three kinds of
 * person with a session.
 */

const LINKS = [
  { href: '/sitios', label: 'Mapa del parche' },
  { href: '/transparencia', label: 'A dónde va la plata' },
  { href: '/como-funciona', label: 'Nuestra Causa' },
]

export function SiteNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  // "Mi historia" only exists if there is someone to have a history with.
  // Rendering the link for everybody would send anonymous visitors to /login
  // without explaining why.
  const { data: session } = useSession()
  const { data: access } = useMyAccess(Boolean(session))
  const mainVenue = access?.venues[0] ?? null

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))

  return (
    <header className='texture-grain fixed top-0 z-50 w-full border-primary border-b-2 bg-background/90 backdrop-blur-md'>
      <div className='relative z-10 flex h-20 w-full items-center justify-between px-margin-mobile lg:px-margin-desktop'>
        <Link
          href='/'
          className='font-display font-extrabold text-headline-md text-street-white uppercase tracking-tighter focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime'
        >
          Tumbenla
        </Link>

        <nav className='hidden items-center gap-10 lg:flex'>
          <NavLink href='/' label='Inicio' active={isActive('/')} />
          {LINKS.map((link) => (
            <NavLink
              key={link.href}
              href={link.href}
              label={link.label}
              active={isActive(link.href)}
            />
          ))}
          {/* For someone who works at a venue the main link is THEIR BAR, not
              "Mi historia". Their panel used to live inside the account menu,
              which meant: open it, wait for the request, and find it in a list.
              Three steps to get back to what they were doing, while the tourist
              link sat in plain sight. */}
          {mainVenue ? (
            <NavLink
              href={`/panel/${mainVenue.slug}`}
              label='Mi bar'
              active={pathname.startsWith('/panel')}
            />
          ) : session ? (
            <NavLink href='/mi-historia' label='Mi historia' active={isActive('/mi-historia')} />
          ) : null}
          <AccountMenu />
        </nav>

        <button
          type='button'
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label={open ? 'Cerrar el menu' : 'Abrir el menu'}
          className='p-2 text-muted-foreground transition-colors hover:text-primary-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime lg:hidden'
        >
          {open ? <XIcon className='size-6' /> : <MenuIcon className='size-6' />}
        </button>
      </div>

      {open ? (
        <div className='relative z-10 flex flex-col gap-1 border-surface-variant border-t px-margin-mobile py-4 lg:hidden'>
          <NavLink href='/' label='Inicio' active={isActive('/')} onClick={() => setOpen(false)} />
          {LINKS.map((link) => (
            <NavLink
              key={link.href}
              href={link.href}
              label={link.label}
              active={isActive(link.href)}
              onClick={() => setOpen(false)}
            />
          ))}
          {session ? (
            <NavLink
              href={mainVenue ? `/panel/${mainVenue.slug}` : '/mi-historia'}
              label={mainVenue ? 'Mi bar' : 'Mi historia'}
              active={mainVenue ? pathname.startsWith('/panel') : isActive('/mi-historia')}
              onClick={() => setOpen(false)}
            />
          ) : null}
          <AccountMenu variant='mobile' />
        </div>
      ) : null}
    </header>
  )
}

function NavLink({
  href,
  label,
  active,
  onClick,
}: {
  href: string
  label: string
  active: boolean
  onClick?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'py-2 font-display text-label-lg uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime',
        active ? 'border-lime border-b-2 text-lime' : 'text-muted-foreground hover:text-lime'
      )}
    >
      {label}
    </Link>
  )
}
