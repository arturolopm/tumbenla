import { SolicitudesCola } from '@/components/admin/solicitudes-cola'
import { listClaimRequests } from '@/lib/venues/claims'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Solicitudes' }

export default async function SolicitudesPage() {
  const solicitudes = await listClaimRequests()
  const pendientes = solicitudes.filter((s) => s.status === 'pending')
  const resueltas = solicitudes.filter((s) => s.status !== 'pending')

  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <header>
        <h1 className="font-display font-black text-3xl uppercase tracking-tighter">
          Solicitudes de sitio
        </h1>
        <p className="mt-2 max-w-prose text-body-md text-muted-foreground">
          Alguien dice que un sitio ya cargado es suyo. Aprobar le da el panel; NO publica el
          sitio. Publicarlo es aparte, cuando confirmes lo que pone.
        </p>
      </header>

      <SolicitudesCola
        pendientes={pendientes.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() }))}
        resueltas={resueltas.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() }))}
      />
    </div>
  )
}
