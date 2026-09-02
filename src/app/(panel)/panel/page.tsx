import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { auth } from '@/lib/auth/auth'
import { listMyVenues } from '@/lib/auth/venue-access'

/**
 * La puerta del panel: con un sitio entra directo, con varios pregunta.
 *
 * Con ninguno NO es un error. Es alguien que entro a una URL que oyo nombrar, o
 * un dueno cuya invitacion todavia no acepta. Se le explica y se le ofrece la
 * salida, en vez de un 404 que lo deja adivinando.
 */
export const dynamic = 'force-dynamic'

export default async function PanelIndexPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect('/login?redirectAfter=/panel')

  const sitios = await listMyVenues(session.user.id)

  if (sitios.length === 1) redirect(`/panel/${sitios[0].slug}`)

  if (sitios.length === 0) {
    return (
      <div className='mx-auto max-w-2xl px-margin-mobile py-section-gap'>
        <h1 className='font-display font-black text-3xl uppercase tracking-tighter'>
          No manejas ningún sitio
        </h1>
        <p className='mt-3 text-body-md text-muted-foreground'>
          Este panel es para los sitios de la red. Si trabajas en uno, pídele al dueño que te invite
          con tu correo; la invitación te llega acá mismo.
        </p>
        <Link
          href='/mi-historia'
          className='mt-6 inline-block rounded-xl bg-primary px-5 py-3 font-display text-label-lg text-primary-foreground uppercase'
        >
          Ir a mi historia
        </Link>
      </div>
    )
  }

  return (
    <div className='mx-auto max-w-2xl px-margin-mobile py-section-gap'>
      <h1 className='font-display font-black text-3xl uppercase tracking-tighter'>¿Cuál sitio?</h1>
      <ul className='mt-6 flex flex-col gap-2'>
        {sitios.map((sitio) => (
          <li key={sitio.slug}>
            <Link
              href={`/panel/${sitio.slug}`}
              className='flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary'
            >
              <span className='font-display font-bold uppercase'>{sitio.nombre}</span>
              <span className='text-muted-foreground text-xs uppercase'>
                {sitio.role === 'owner' ? 'Dueño' : 'Equipo'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
