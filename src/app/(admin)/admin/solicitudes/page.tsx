import { SolicitudesCola } from '@/components/admin/solicitudes-cola'
import { INSTAGRAM_VERIFICACION } from '@/config/contacto'
import { listApplications } from '@/lib/venues/claims'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Solicitudes' }

export default async function SolicitudesPage() {
  const solicitudes = await listApplications()
  const abiertas = solicitudes.filter((s) => s.status === 'pending' || s.status === 'verifying')
  const resueltas = solicitudes.filter((s) => s.status === 'approved' || s.status === 'rejected')

  return (
    <div className='flex max-w-4xl flex-col gap-8'>
      <header>
        <h1 className='font-display font-black text-3xl uppercase tracking-tighter'>
          Solicitudes de sitio
        </h1>
        <p className='mt-2 max-w-prose text-body-md text-muted-foreground'>
          Para aprobar tienen que cumplirse <strong className='text-street-white'>dos</strong>{' '}
          cosas: que el DM a @{INSTAGRAM_VERIFICACION} venga de la cuenta del sitio, y que ese
          mensaje cite el correo de contacto de la solicitud. Lo primero prueba que la cuenta es del
          bar; lo segundo, que quien escribe es quien llenó el formulario.
        </p>
        <p className='mt-2 max-w-prose text-body-md text-muted-foreground'>
          Aprobar da el panel. <strong className='text-street-white'>No publica el sitio</strong>:
          eso es aparte, cuando confirmes lo que pone.
        </p>
      </header>

      <SolicitudesCola
        abiertas={abiertas.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() }))}
        resueltas={resueltas.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() }))}
      />
    </div>
  )
}
