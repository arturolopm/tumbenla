import { HeartIcon, MusicIcon, ZapIcon } from 'lucide-react'
import Link from 'next/link'

/**
 * El footer de Stitch: cuatro columnas, borde superior grueso, y la barra de
 * abajo con los tres iconos sobre trama de puntos.
 *
 * Los enlaces sociales de la maqueta apuntaban a "#". Aca solo se renderiza lo
 * que existe de verdad; un enlace a un Instagram que no esta abierto es una
 * promesa rota en el primer clic.
 */

const NOSOTROS = [
  { href: '/como-funciona', label: 'Sobre la causa' },
  { href: '/transparencia', label: 'A dónde va la plata' },
  { href: '/terminos', label: 'Términos' },
  { href: '/privacidad', label: 'Privacidad' },
]

export function SiteFooter() {
  return (
    <footer className="texture-grain relative mt-section-gap w-full border-surface-variant border-t-4 bg-surface-container-lowest py-section-gap">
      <div className="relative z-10 grid w-full grid-cols-1 gap-gutter px-margin-mobile md:grid-cols-4 md:gap-section-gap lg:px-margin-desktop">
        <div className="md:col-span-2">
          <p className="mb-6 font-display font-extrabold text-headline-md text-primary-text uppercase tracking-tighter">
            Tumbenla
          </p>
          <p className="max-w-md text-body-md text-muted-foreground">
            Nos reímos primero. Ayudamos siempre. Salir de rumba en los sitios de esta lista
            pone material de construcción donde hace falta.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="font-display text-label-lg text-lime uppercase tracking-widest">
            Conéctate
          </h2>
          <a
            href="mailto:hola@tumbenla.co"
            className="text-body-md text-muted-foreground transition-colors hover:text-street-white"
          >
            hola@tumbenla.co
          </a>
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="font-display text-label-lg text-lime uppercase tracking-widest">
            Nosotros
          </h2>
          {NOSOTROS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-body-md text-muted-foreground transition-colors hover:text-street-white"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="relative z-10 mt-16 flex w-full flex-col items-center justify-between gap-4 border-surface-variant border-t px-margin-mobile pt-8 md:flex-row lg:px-margin-desktop">
        <span className="text-label-sm text-muted-foreground uppercase">
          Hecho con orgullo en Colombia © {new Date().getFullYear()}
        </span>
        <div className="halftone-overlay relative flex gap-6 rounded-xl p-4">
          <ZapIcon className="size-5 text-primary-text" />
          <HeartIcon className="size-5 text-lime" />
          <MusicIcon className="size-5 text-party" />
        </div>
      </div>
    </footer>
  )
}
