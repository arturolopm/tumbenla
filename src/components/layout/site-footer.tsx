import Link from 'next/link'

import { getBrandConfig } from '@/config/branding'

export function SiteFooter() {
  const brand = getBrandConfig()

  return (
    <footer className="border-border border-t">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-3">
          <span className="font-display text-lg tracking-tight">Tumbenla</span>
          <p className="max-w-md text-pretty text-muted-foreground text-sm">
            Nos reimos primero. Ayudamos siempre.
          </p>
        </div>

        <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <Link href="/sitios" className="text-muted-foreground hover:text-foreground">
            Sitios
          </Link>
          <Link href="/transparencia" className="text-muted-foreground hover:text-foreground">
            En que se fue la plata
          </Link>
          <Link href="/como-funciona" className="text-muted-foreground hover:text-foreground">
            Como funciona
          </Link>
          <Link href="/terminos" className="text-muted-foreground hover:text-foreground">
            Terminos
          </Link>
          <Link href="/privacidad" className="text-muted-foreground hover:text-foreground">
            Privacidad
          </Link>
          {brand.supportEmail ? (
            <a
              href={`mailto:${brand.supportEmail}`}
              className="text-muted-foreground hover:text-foreground"
            >
              {brand.supportEmail}
            </a>
          ) : null}
        </div>

        <p className="text-muted-foreground/70 text-xs">
          Tumbenla publica los compromisos que los sitios hacen publicos y los recibos de cada
          compra. No procesamos pagos.
        </p>
      </div>
    </footer>
  )
}
