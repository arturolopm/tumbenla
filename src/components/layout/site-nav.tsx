'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

import { cn } from '@/lib/utils/css'

const LINKS = [
  { href: '/sitios', label: 'Sitios' },
  { href: '/transparencia', label: 'En que se fue' },
  { href: '/como-funciona', label: 'Como funciona' },
]

export function SiteNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    // Translucent rather than opaque, with content scrolling underneath. The
    // saturate() is what keeps colour behind the bar from going grey.
    <header className="sticky top-0 z-40 border-border/60 border-b bg-glass backdrop-blur-xl backdrop-saturate-150">
      <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6">
        <Link
          href="/"
          className="font-display text-lg tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Tumbenla
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm transition-colors',
                pathname.startsWith(link.href)
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/como-funciona#para-sitios"
            className="hidden rounded-lg bg-primary px-3 py-1.5 font-medium text-primary-foreground text-sm transition-opacity hover:opacity-90 sm:block"
          >
            Quiero poner
          </Link>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label="Menu"
            className="rounded-lg border border-border p-2 text-muted-foreground md:hidden"
          >
            <span className="block h-0.5 w-4 bg-current" />
            <span className="mt-1 block h-0.5 w-4 bg-current" />
          </button>
        </div>
      </nav>

      {open ? (
        <div className="border-border/60 border-t px-4 py-2 md:hidden">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-2 py-2 text-muted-foreground text-sm hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}
    </header>
  )
}
