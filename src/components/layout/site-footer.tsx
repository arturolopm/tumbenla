import { HeartIcon, MusicIcon, ZapIcon } from 'lucide-react'
import Link from 'next/link'

import { getReplyToAddress } from '@/lib/messaging/email/utils'

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
  const contactEmail = getReplyToAddress() ?? 'hastaabajo@tumbenla.com'

  return (
    <footer className='texture-grain relative mt-section-gap w-full border-surface-variant border-t-4 bg-surface-container-lowest py-section-gap'>
      <div className='relative z-10 grid w-full grid-cols-1 gap-gutter px-margin-mobile md:grid-cols-4 md:gap-section-gap lg:px-margin-desktop'>
        <div className='md:col-span-2'>
          <p className='mb-6 font-display font-extrabold text-headline-md text-primary-text uppercase tracking-tighter'>
            TUMBENLA
          </p>
          <p className='max-w-md text-body-md text-muted-foreground'>
            Nos reímos primero. Ayudamos siempre. Salir de rumba en los sitios de esta lista pone
            material de construcción donde hace falta.
          </p>
        </div>

        <div className='flex flex-col gap-4'>
          <h2 className='font-display text-label-lg text-lime uppercase tracking-widest'>
            Conéctate
          </h2>
          <a
            href={`mailto:${contactEmail}`}
            className='text-body-md text-muted-foreground transition-colors hover:text-street-white'
          >
            {contactEmail}
          </a>
        </div>

        <div className='flex flex-col gap-4'>
          <h2 className='font-display text-label-lg text-lime uppercase tracking-widest'>
            Nosotros
          </h2>
          {NOSOTROS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className='text-body-md text-muted-foreground transition-colors hover:text-street-white'
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      {/* El remate de la marca. Sale del video de lanzamiento y se queda fijo:
          es lo que el producto es en paisa — usted sale, se parcha, rumbea, y
          de paso ayuda. Va en lima porque es el punto mas brillante del
          sistema y aca no compite con ninguna seleccion. */}
      <div className='relative z-10 mt-16 w-full px-margin-mobile lg:px-margin-desktop'>
        <p className='max-w-3xl text-pretty text-body-lg text-muted-foreground'>
          Así usted sale, se parcha, rumbea, y de paso ayuda.
        </p>
        <p className='mt-3 font-display font-black text-4xl text-lime uppercase leading-none tracking-tighter sm:text-6xl'>
          ¿Qué chimba cierto?
        </p>
      </div>

      <div className='relative z-10 mt-16 flex w-full flex-col items-center justify-between gap-4 border-surface-variant border-t px-margin-mobile pt-8 md:flex-row lg:px-margin-desktop'>
        <span className='text-label-sm text-muted-foreground uppercase'>
          Hecho con orgullo en Colombia © {new Date().getFullYear()}
        </span>
        <div className='halftone-overlay relative flex gap-6 rounded-xl p-4'>
          <ZapIcon className='size-5 text-primary-text' />
          <HeartIcon className='size-5 text-lime' />
          <MusicIcon className='size-5 text-party' />
        </div>
      </div>
    </footer>
  )
}
