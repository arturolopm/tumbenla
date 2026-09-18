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
import { AccountMenu } from '@/components/layout/account-menu'

/**
 * A venue's panel, for its owner and its staff.
 *
 * It is AdminShell's sibling and deliberately not the same component. They look
 * alike today and will not look alike tomorrow: the platform one moderates the
 * whole network, this one administers one venue. Sharing them would force every
 * menu item to know which of the two panels is painting it, which is how you end
 * up with an operations link visible to a bar's waiter.
 *
 * AccountMenu goes in the header, and not only in the public bar: it is the hat
 * switch. The same person can go out AND own a bar — the personal side hangs off
 * photo_claim, the work side off venue_member, on the SAME account — and until
 * now whoever entered the panel was left without either exit, neither to
 * /mi-historia nor to sign out, because SiteNav only renders under (publico).
 */

type Venue = { slug: string; name: string; role: string }

/**
 * Owners manage the whole venue. Staff also run nights and photos — they
 * upload, moderate, and resolve privacy reports in `noches.ts` — but not the
 * menu, the account, the site profile, or the team. Only platform operators
 * and owners see those.
 */
const items = (slug: string, { isOwner, isStaff }: { isOwner: boolean; isStaff: boolean }) => [
  { href: `/panel/${slug}/escanear`, label: 'Escanear' },
  ...(isOwner || isStaff
    ? [
        { href: `/panel/${slug}/noches`, label: 'Las noches' },
        { href: `/panel/${slug}/fotos`, label: 'Por revisar' },
      ]
    : []),
  ...(isOwner
    ? [
        { href: `/panel/${slug}`, label: 'Resumen', exact: true },
        { href: `/panel/${slug}/sitios`, label: 'Sitios' },
        { href: `/panel/${slug}/carta`, label: 'La carta' },
        { href: `/panel/${slug}/cuenta`, label: 'La cuenta' },
        { href: `/panel/${slug}/sitio`, label: 'El sitio' },
        { href: `/panel/${slug}/equipo`, label: 'Equipo' },
      ]
    : []),
]

export function PanelShell({
  venue,
  venues,
  email,
  isOwner,
  isStaff,
  isPlatform,
  children,
}: {
  venue: Venue
  venues: Venue[]
  email: string
  isOwner: boolean
  isStaff: boolean
  isPlatform: boolean
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const nav = items(venue.slug, { isOwner, isStaff })

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <Link href='/' className='px-2 py-1 font-display font-extrabold text-lg'>
            TUMBENLA
          </Link>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className='truncate'>{venue.name}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {nav.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={
                        item.exact ? pathname === item.href : pathname.startsWith(item.href)
                      }
                      render={<Link href={item.href}>{item.label}</Link>}
                    />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Only when there is genuinely something to choose between. A picker
              with one element is noise you have to read to find out it was not
              needed. */}
          {venues.length > 1 ? (
            <SidebarGroup>
              <SidebarGroupLabel>Tus otros sitios</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {venues
                    .filter((other) => other.slug !== venue.slug)
                    .map((other) => (
                      <SidebarMenuItem key={other.slug}>
                        <SidebarMenuButton
                          render={<Link href={`/panel/${other.slug}`}>{other.name}</Link>}
                        />
                      </SidebarMenuItem>
                    ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ) : null}
        </SidebarContent>

        <SidebarFooter>
          <p className='truncate px-2 py-1 text-muted-foreground text-xs' title={email}>
            {email}
          </p>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className='flex h-14 items-center gap-3 border-border border-b px-4'>
          <SidebarTrigger />
          <p className='truncate font-medium text-sm'>{venue.name}</p>
          {/* An operator entering someone else's panel has to see it. Without
              this notice it is easy to believe you are looking at your own and
              touch somebody else's data. */}
          {isPlatform ? (
            <span className='rounded-full border border-primary px-2 py-0.5 text-primary-text text-xs'>
              Estás entrando como operación
            </span>
          ) : null}
          <div className='ml-auto'>
            <AccountMenu />
          </div>
        </header>
        <div className='p-4 sm:p-6'>{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
