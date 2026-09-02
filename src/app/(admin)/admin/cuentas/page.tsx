import { CuentasCola } from '@/components/admin/cuentas-cola'
import { libroCuadra } from '@/lib/comercio/libro'
import { saldosDeTodosLosSitios } from '@/lib/comercio/queries'

export const dynamic = 'force-dynamic'

export default async function CuentasPage() {
  const [saldos, cuadre] = await Promise.all([saldosDeTodosLosSitios(), libroCuadra()])

  return (
    <div className='flex max-w-4xl flex-col gap-8'>
      <header>
        <h1 className='font-display font-black text-3xl uppercase leading-none tracking-tighter'>
          Cuentas
        </h1>
        <p className='mt-2 max-w-prose text-body-md text-muted-foreground'>
          Lo vendido en la app y lo vendido en la barra se cruzan solos. Aquí solo queda la
          diferencia, y solo eso se transfiere.
        </p>
      </header>

      {/* La prueba de integridad, a la vista y no escondida en un script. Si el
          libro no suma cero, ninguna cifra de esta pantalla sirve, y hay que
          verlo antes de girarle plata a alguien. */}
      {!cuadre.cuadra ? (
        <div className='rounded-xl border-2 border-destructive bg-destructive/10 p-5'>
          <p className='font-display font-black text-xl uppercase text-destructive-foreground'>
            El libro no cuadra
          </p>
          <p className='mt-1 text-body-md'>
            Descuadre de {cuadre.diferencia}. Hay un asiento sin escribir. No liquides nada hasta
            arreglarlo: ninguna cifra de esta pantalla es de fiar.
          </p>
        </div>
      ) : null}

      <CuentasCola saldos={saldos} />
    </div>
  )
}
