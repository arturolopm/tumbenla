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
import { MenuCuenta } from '@/components/layout/menu-cuenta'

/**
 * Reusa src/components/ui/sidebar.tsx, que eran 21.8 KB ya construidos y sin
 * un solo consumidor en el repo. Trae gratis el comportamiento en movil (hoja
 * lateral), la persistencia en cookie y el atajo de teclado.
 */

const NAV = [
  { href: '/admin', label: 'Resumen' },
  { href: '/admin/sitios', label: 'Sitios' },
  { href: '/admin/solicitudes', label: 'Solicitudes' },
  { href: '/admin/aportes', label: 'Aportes' },
]

export function AdminShell({
  email,
  solicitudesAbiertas = 0,
  children,
}: {
  email: string
  /** Cuantas solicitudes esperan respuesta. Va en el menu porque una solicitud
   *  sin mirar es alguien esperando, y no hay ninguna otra senal de que exista. */
  solicitudesAbiertas?: number
  children: React.ReactNode
}) {
  const pathname = usePathname()

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
            <SidebarGroupLabel>Panel</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={
                        item.href === '/admin'
                          ? pathname === '/admin'
                          : pathname.startsWith(item.href)
                      }
                      render={
                        <Link href={item.href}>
                          {item.label}
                          {item.href === '/admin/solicitudes' && solicitudesAbiertas > 0 ? (
                            <span className="ml-auto rounded-full bg-primary px-2 text-primary-foreground text-xs">
                              {solicitudesAbiertas}
                            </span>
                          ) : null}
                        </Link>
                      }
                    />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
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
          <p className="font-medium text-sm">Operación</p>
          <div className="ml-auto">
            <MenuCuenta />
          </div>
        </header>
        <div className="p-4 sm:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
