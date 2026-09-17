import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { auth } from '@/lib/auth/auth'
import { DESTINO_POR_DEFECTO, esDestinoValido } from '@/lib/auth/redirect'
import { generateMetadata } from '@/lib/seo'
import { VerifyContent } from './verify-content'

export const dynamic = 'force-dynamic'

export const metadata = generateMetadata({
  title: 'Verifica tu correo',
})

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectAfter?: string }>
}) {
  const [session, params] = await Promise.all([
    auth.api.getSession({ headers: await headers() }),
    searchParams,
  ])

  if (session?.user.emailVerified) {
    // Quien ya verifico y vuelve a caer aca por un enlace viejo sigue al
    // destino que traia, no al despachador.
    const destino = params.redirectAfter
    redirect(destino && esDestinoValido(destino) ? destino : DESTINO_POR_DEFECTO)
  }

  return <VerifyContent initialEmail={session?.user.email ?? null} />
}
