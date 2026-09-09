import { ProductosCola } from '@/components/admin/productos-cola'
import { listarProductosParaRevisar } from '@/lib/comercio/queries'

export const dynamic = 'force-dynamic'

export default async function ProductosPage() {
  const productos = await listarProductosParaRevisar()

  return (
    <div className='flex max-w-4xl flex-col gap-8'>
      <header>
        <h1 className='font-display font-black text-3xl uppercase leading-none tracking-tighter'>
          Productos
        </h1>
        <p className='mt-2 max-w-prose text-body-md text-muted-foreground'>
          Consulta la carta activa de los sitios. Cada dueño publica sus productos directamente;
          todos deben destinar al menos 40% para reconstruir.
        </p>
      </header>

      <ProductosCola
        productos={productos.map((p) => ({ ...p, creadoEn: p.creadoEn.toISOString() }))}
      />
    </div>
  )
}
