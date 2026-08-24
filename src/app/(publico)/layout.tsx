import { SiteFooter } from '@/components/layout/site-footer'
import { SiteNav } from '@/components/layout/site-nav'

export default function PublicoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <SiteNav />
      {/* pt-20 compensa la altura de la barra, que es fixed y por lo tanto
          esta fuera del flujo. */}
      <main className="flex-1 pt-20">{children}</main>
      <SiteFooter />
    </div>
  )
}
