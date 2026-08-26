import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { VenueForm } from '@/components/admin/venue-form'
import { auth } from '@/lib/auth/auth'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Registrar un sitio',
  robots: { index: false, follow: false },
}

export default async function NuevoSitioPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/login?redirectAfter=/registrar-sitio/nuevo')

  return (
    <div className="mx-auto w-full max-w-3xl px-margin-mobile py-section-gap lg:px-margin-desktop">
      <header className="mb-8">
        <h1 className="font-display font-black text-4xl uppercase leading-none tracking-tighter">
          Tu sitio
        </h1>
        <p className="mt-4 max-w-prose text-pretty text-body-lg text-muted-foreground">
          Lo que escribas acá es lo que va a ver la gente. Queda en borrador —sin salir en el
          mapa— hasta que hablemos contigo y confirmemos lo que vas a poner.
        </p>
      </header>

      <VenueForm modo="registro" />
    </div>
  )
}
