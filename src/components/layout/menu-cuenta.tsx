'use client'

import { LogOutIcon, UserIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Menu, MenuItem, MenuPopup, MenuSeparator, MenuTrigger } from '@/components/ui/menu'
import { signOut, useSession } from '@/lib/auth/auth-client'
import { enlaceDeLogin } from '@/lib/auth/redirect'
import { cn } from '@/lib/utils/css'

/**
 * Entrar y salir, que hasta ahora no existian en ninguna parte de la barra.
 *
 * POR QUE LA SESION SE LEE EN EL CLIENTE Y NO EN EL LAYOUT: esta barra vive en
 * (publico)/layout.tsx, que cubre la portada, /sitios y /transparencia. Leer la
 * sesion en el servidor alli obliga a renderizar en cada peticion y se lleva por
 * delante el ISR de todo el sitio publico, que es de lo que depende que la base
 * de Neon duerma y el presupuesto de 100 CU-horas alcance. Se lee en el cliente
 * y las paginas siguen siendo estaticas.
 *
 * EL PRECIO ES EL PARPADEO, y por eso `isPending` no pinta un estado neutro
 * cualquiera: pinta un hueco del mismo ancho. Si mientras carga se mostrara
 * "Entrar", quien tiene sesion veria "Entrar" y despues su nombre, que es
 * exactamente lo que no se quiere que vea.
 */

type Acceso = { admin: boolean; sitios: { slug: string; nombre: string }[] }

export function MenuCuenta({ variant = 'barra' }: { variant?: 'barra' | 'movil' }) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session, isPending } = useSession()
  const [acceso, setAcceso] = useState<Acceso | null>(null)
  const [saliendo, startSalir] = useTransition()

  // Mientras no se sabe, un hueco del ancho del control. Ver la nota de arriba.
  if (isPending) {
    return <div aria-hidden className={cn('h-9', variant === 'barra' ? 'w-24' : 'w-full')} />
  }

  if (!session) {
    return (
      <Link
        href={enlaceDeLogin(pathname)}
        className={cn(
          'inline-flex items-center justify-center rounded-xl border border-secondary px-4 py-2 font-display text-label-lg uppercase transition-colors hover:border-lime hover:text-lime focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime',
          variant === 'movil' && 'mt-2 w-full'
        )}
      >
        Entrar
      </Link>
    )
  }

  const nombre = session.user.name?.trim() || session.user.email

  const handleSalir = () => {
    startSalir(async () => {
      await signOut()
      // refresh() ademas de push() porque las paginas que leen la sesion en el
      // servidor tienen que volver a renderizarse; sin el, /mi-historia se
      // queda pintada en el cache del router despues de salir.
      router.push('/')
      router.refresh()
    })
  }

  // El rol no viene en la sesion: ADMIN_EMAILS es del servidor. Se pregunta la
  // primera vez que se ABRE el menu y no en cada carga de pagina, porque la
  // barra sale en todo el sitio y casi nadie abre el menu.
  const handleOpen = (open: boolean) => {
    if (!open || acceso) return
    fetch('/api/mi-acceso')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Acceso | null) => data && setAcceso(data))
      .catch(() => {
        // Que falle sólo significa un menú sin los atajos de operador. No es
        // motivo para romper la barra.
      })
  }

  return (
    <Menu onOpenChange={handleOpen}>
      <MenuTrigger
        className={cn(
          'inline-flex items-center gap-2 rounded-xl border border-secondary px-3 py-2 font-display text-label-lg uppercase transition-colors hover:border-lime hover:text-lime focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime',
          variant === 'movil' && 'mt-2 w-full justify-center'
        )}
      >
        <UserIcon className="size-4" />
        <span className="max-w-32 truncate">{nombre}</span>
      </MenuTrigger>

      <MenuPopup align="end" sideOffset={8} className="min-w-52">
        <MenuItem render={<Link href="/mi-historia">Mi historia</Link>} />

        {acceso?.sitios.map((sitio) => (
          <MenuItem
            key={sitio.slug}
            render={<Link href={`/panel/${sitio.slug}`}>{sitio.nombre}</Link>}
          />
        ))}

        {acceso?.admin ? <MenuItem render={<Link href="/admin">Panel de operación</Link>} /> : null}

        <MenuSeparator />

        <MenuItem variant="destructive" disabled={saliendo} onClick={handleSalir}>
          <LogOutIcon />
          {saliendo ? 'Saliendo…' : 'Salir'}
        </MenuItem>
      </MenuPopup>
    </Menu>
  )
}
