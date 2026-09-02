import Link from 'next/link'

import { listVenuesForAdmin } from '@/lib/venues/queries'

export default async function AdminPage() {
  const venues = await listVenuesForAdmin()

  const counts = {
    published: venues.filter((v) => v.status === 'published').length,
    draft: venues.filter((v) => v.status === 'draft').length,
    paused: venues.filter((v) => v.status === 'paused').length,
  }

  return (
    <div className='flex flex-col gap-6'>
      <div>
        <h1 className='font-display font-extrabold text-3xl'>Resumen</h1>
        <p className='text-muted-foreground text-sm'>Lo que hay cargado ahora mismo.</p>
      </div>

      <div className='grid gap-4 sm:grid-cols-3'>
        <Stat label='Publicados' value={counts.published} />
        <Stat label='En borrador' value={counts.draft} />
        <Stat label='Pausados' value={counts.paused} />
      </div>

      <div className='flex gap-3'>
        <Link
          href='/admin/sitios/nuevo'
          className='rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground text-sm'
        >
          Agregar un sitio
        </Link>
        <Link
          href='/admin/sitios'
          className='rounded-md border border-border px-4 py-2 font-medium text-sm'
        >
          Ver todos
        </Link>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className='rounded-xl border border-border bg-card p-5'>
      <p className='text-muted-foreground text-sm'>{label}</p>
      <p className='mt-1 font-display font-extrabold text-4xl tabular-nums'>{value}</p>
    </div>
  )
}
