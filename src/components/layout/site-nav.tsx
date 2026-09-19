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
 * Fixed translucent Stitch navigation with grain and an orange bottom border. The active item is
 * marked in lime. The mockup's events item is omitted because the product has no events table.
 */

const LINKS = [
  { href: '/sitios', label: 'Mapa del parche' },
  { href: '/transparencia', label: 'A dónde va la plata' },
  { href: '/como-funciona', label: 'Cómo funciona' },
]

export function SiteNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  // "Mi historia" only exists for someone with a history. Rendering it for everyone would send
  // anonymous visitors to /login without explaining why.
  const { data: session, isPending } = useSession()
  const { data: access } = useMyAccess(Boolean(session))
  const mainVenue = access?.venues[0] ?? null

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))

  // Before the session arrives, both candidate links render and the session hint on <html>
  // (see account-menu.tsx) shows the right one, or neither. "Mi bar" points at /panel, which
  // forwards a single-venue person to their bar; the exact slug is not known yet.
  const hintedAccountLinks = (onClick?: () => void) => (
    <>
      <NavLink
        href='/panel'
        label='Mi bar'
        active={pathname.startsWith('/panel')}
        onClick={onClick}
        className='hidden in-data-[session=venue]:block'
      />
      <NavLink
        href='/mi-historia'
        label='Mi historia'
        active={isActive('/mi-historia')}
        onClick={onClick}
        className='hidden in-data-[session=person]:block'
      />
    </>
  )

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
          {/* For venue staff the main link is their bar, not "Mi historia". Keeping it in the main
              navigation avoids opening the account menu and searching a list. */}
          {isPending ? (
            hintedAccountLinks()
          ) : mainVenue ? (
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
          {isPending ? (
            hintedAccountLinks(() => setOpen(false))
          ) : session ? (
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
  className,
}: {
  href: string
  label: string
  active: boolean
  onClick?: () => void
  className?: string
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'py-2 font-display text-label-lg uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime',
        active ? 'border-lime border-b-2 text-lime' : 'text-muted-foreground hover:text-lime',
        className
      )}
    >
      {label}
    </Link>
  )
}
