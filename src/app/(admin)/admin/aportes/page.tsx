import { AportesCola } from '@/components/admin/aportes-cola'
import { listContributionsForAdmin, listPurchasesForLinking } from '@/lib/venues/contributions'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Aportes' }

export default async function AdminAportesPage() {
  const [aportes, compras] = await Promise.all([
    listContributionsForAdmin(),
    listPurchasesForLinking(),
  ])

  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <header>
        <h1 className="font-display font-black text-3xl uppercase tracking-tighter">Aportes</h1>
        <p className="mt-2 max-w-prose text-body-md text-muted-foreground">
          Lo que cada sitio dice que entregó. Nada de esto se ve en público hasta que lo
          verifiques: lo que publicamos lleva nuestro nombre encima.
        </p>
      </header>

      <AportesCola
        aportes={aportes.map((a) => ({
          ...a,
          periodStart: a.periodStart.toISOString(),
          periodEnd: a.periodEnd.toISOString(),
          createdAt: a.createdAt.toISOString(),
        }))}
        compras={compras.map((c) => ({ ...c, purchasedAt: c.purchasedAt.toISOString() }))}
      />
    </div>
  )
}
