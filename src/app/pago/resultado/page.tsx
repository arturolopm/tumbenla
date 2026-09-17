import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Estado del pago',
  robots: { index: false, follow: false },
}

export default async function PaymentResultPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>
}) {
  const { estado } = await searchParams
  return (
    <main className='mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-5 px-margin-mobile py-10'>
      <h1 className='font-display font-black text-4xl uppercase leading-none tracking-tighter'>
        No pudimos identificar el cobro
      </h1>
      <p className='text-body-lg text-muted-foreground'>
        {estado === 'invalido'
          ? 'La respuesta no traía una referencia válida.'
          : 'El estado sigue pendiente. No iniciaremos otro cobro automáticamente.'}{' '}
        Guarda el correo de tu pedido o escríbenos para revisarlo.
      </p>
      <Link
        href='/sitios'
        className='rounded-xl bg-primary px-6 py-4 text-center font-display text-label-lg text-primary-foreground uppercase'
      >
        Ver sitios
      </Link>
    </main>
  )
}
