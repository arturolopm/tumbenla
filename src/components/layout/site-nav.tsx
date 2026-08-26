'use client'

import { MenuIcon, XIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

import { useSession } from '@/lib/auth/auth-client'
import { cn } from '@/lib/utils/css'
import { MenuCuenta } from './menu-cuenta'

/**
 * La barra de Stitch: fija, translucida con grano, y con un borde inferior
 * grueso del naranja de marca. El item activo se marca en lima con subrayado,
 * que es el unico lugar del sitio donde la lima aparece fuera del mapa.
 *
 * La pantalla de Stitch tenia un cuarto item, "Eventos", y un avatar de perfil.
 * "Eventos" sigue sin existir: no hay tabla de eventos. El cuarto slot lo ocupa
 * Transparencia, que si tiene datos detras. El control de cuenta si existe ya,
 * en MenuCuenta, porque el producto tiene tres tipos de persona con sesion.
 */

const LINKS = [
  { href: '/sitios', label: 'Mapa del parche' },
  { href: '/transparencia', label: 'A dónde va la plata' },
  { href: '/como-funciona', label: 'Nuestra Causa' },
]

export function SiteNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  // Mi historia solo existe si hay con quien tener historia. Renderizar el
  // enlace para todo el mundo mandaria a los anonimos a /login sin explicarles
  // por que.
  const { data: session } = useSession()

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <header className="texture-grain fixed top-0 z-50 w-full border-primary border-b-2 bg-background/90 backdrop-blur-md">
      <div className="relative z-10 flex h-20 w-full items-center justify-between px-margin-mobile lg:px-margin-desktop">
        <Link
          href="/"
          className="font-display font-extrabold text-headline-md text-street-white uppercase tracking-tighter focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
        >
          Tumbenla
        </Link>

        <nav className="hidden items-center gap-10 lg:flex">
          <NavLink href="/" label="Inicio" active={isActive('/')} />
          {LINKS.map((link) => (
            <NavLink
              key={link.href}
              href={link.href}
              label={link.label}
              active={isActive(link.href)}
            />
          ))}
          {session ? (
            <NavLink
              href="/mi-historia"
              label="Mi historia"
              active={isActive('/mi-historia')}
            />
          ) : null}
          <MenuCuenta />
        </nav>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label={open ? 'Cerrar el menu' : 'Abrir el menu'}
          className="p-2 text-muted-foreground transition-colors hover:text-primary-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime lg:hidden"
        >
          {open ? <XIcon className="size-6" /> : <MenuIcon className="size-6" />}
        </button>
      </div>

      {open ? (
        <div className="relative z-10 flex flex-col gap-1 border-surface-variant border-t px-margin-mobile py-4 lg:hidden">
          <NavLink href="/" label="Inicio" active={isActive('/')} onClick={() => setOpen(false)} />
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
              href="/mi-historia"
              label="Mi historia"
              active={isActive('/mi-historia')}
              onClick={() => setOpen(false)}
            />
          ) : null}
          <MenuCuenta variant="movil" />
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
        active
          ? 'border-lime border-b-2 text-lime'
          : 'text-muted-foreground hover:text-lime'
      )}
    >
      {label}
    </Link>
  )
}
