import type { Metadata } from 'next'

import { AdminShell } from '@/components/admin/admin-shell'
import { requireAdmin } from '@/lib/auth/admin'
import { countOpenApplications } from '@/lib/venues/claims'

/**
 * El gate del panel. requireAdmin() no devuelve para un no-admin: redirige a
 * /login sin sesion, y lanza notFound() con una sesion que no esta en la
 * allowlist, de modo que el panel ni siquiera anuncia que existe.
 *
 * ESTO NO PROTEGE LAS SERVER ACTIONS. Cada una llama assertAdmin() por su
 * cuenta; ver src/app/actions/venues.ts.
 */

export const metadata: Metadata = {
  title: 'Panel',
  robots: { index: false, follow: false },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin()
  const solicitudesAbiertas = await countOpenApplications()

  return (
    <AdminShell
      email={session.user.email}
      pendientes={{
        '/admin/solicitudes': solicitudesAbiertas,
      }}
    >
      {children}
    </AdminShell>
  )
}
