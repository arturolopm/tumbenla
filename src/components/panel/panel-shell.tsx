'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'

/**
 * El panel de un sitio, para su dueno y su personal.
 *
 * Es hermano de AdminShell y no el mismo componente a proposito. Se parecen hoy
 * y no van a parecerse manana: el de la plataforma modera toda la red, este
 * administra un sitio. Compartirlos obligaria a que cada item del menu supiera
 * cual de los dos paneles lo esta pintando, que es como se termina con un
 * enlace de operacion visible para el mesero de un bar.
 */

type Sitio = { slug: string; nombre: string; role: string }

const items = (slug: string, esDueno: boolean) => [
  { href: `/panel/${slug}`, label: 'Resumen', exacto: true },
  { href: `/panel/${slug}/sitio`, label: 'El sitio' },
  ...(esDueno ? [{ href: `/panel/${slug}/equipo`, label: 'Equipo' }] : []),
]

export function PanelShell({
  sitio,
  sitios,
  email,
  esDueno,
  esPlataforma,
  children,
}: {
  sitio: Sitio
  sitios: Sitio[]
  email: string
  esDueno: boolean
  esPlataforma: boolean
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const nav = items(sitio.slug, esDueno)

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <Link href="/" className="px-2 py-1 font-display font-extrabold text-lg">
            TUMBENLA
          </Link>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="truncate">{sitio.nombre}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {nav.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={
                        item.exacto ? pathname === item.href : pathname.startsWith(item.href)
                      }
                      render={<Link href={item.href}>{item.label}</Link>}
                    />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Solo si de verdad hay entre que escoger. Un selector de un elemento
              es ruido que hay que leer para descubrir que no hacia falta. */}
          {sitios.length > 1 ? (
            <SidebarGroup>
              <SidebarGroupLabel>Tus otros sitios</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {sitios
                    .filter((s) => s.slug !== sitio.slug)
                    .map((s) => (
                      <SidebarMenuItem key={s.slug}>
                        <SidebarMenuButton
                          render={<Link href={`/panel/${s.slug}`}>{s.nombre}</Link>}
                        />
                      </SidebarMenuItem>
                    ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ) : null}
        </SidebarContent>

        <SidebarFooter>
          <p className="truncate px-2 py-1 text-muted-foreground text-xs" title={email}>
            {email}
          </p>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-14 items-center gap-3 border-border border-b px-4">
          <SidebarTrigger />
          <p className="truncate font-medium text-sm">{sitio.nombre}</p>
          {/* Un operador entrando al panel de un sitio ajeno tiene que verlo.
              Sin este aviso es facil creer que se esta mirando el propio y
              tocar datos de alguien mas. */}
          {esPlataforma ? (
            <span className="rounded-full border border-primary px-2 py-0.5 text-primary-text text-xs">
              Estás entrando como operación
            </span>
          ) : null}
        </header>
        <div className="p-4 sm:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
