import { notFound } from 'next/navigation'

import { CuentaDelSitio } from '@/components/panel/cuenta-del-sitio'
import { db } from '@/database'
import { getVenueForPanel, requireVenueAccess } from '@/lib/auth/venue-access'
import { saldoDeSitio } from '@/lib/comercio/libro'
import { liquidacionesDeSitio, movimientosDeSitio } from '@/lib/comercio/queries'
import { getVenueFinanceView } from '@/lib/commerce/venue-finance-view'

export const dynamic = 'force-dynamic'

/**
 * Lo que el sitio debe o le deben, y de donde sale.
 *
 * Solo el DUEÑO. Un mesero entrega tragos; la cuenta con nosotros no es asunto
 * suyo y ensenarsela es ensenar cuanto factura el bar.
 */
export default async function CuentaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const sitio = await getVenueForPanel(slug)
  if (!sitio) notFound()

  await requireVenueAccess(sitio.id, `/panel/${slug}/cuenta`, ['owner'])

  const [saldo, movimientos, liquidaciones, finanzas] = await Promise.all([
    saldoDeSitio(sitio.id),
    movimientosDeSitio(sitio.id),
    liquidacionesDeSitio(sitio.id),
    getVenueFinanceView(db, sitio.id),
  ])

  return (
    <CuentaDelSitio
      saldo={saldo}
      movimientos={movimientos.map((m) => ({ ...m, fecha: m.fecha.toISOString() }))}
      liquidaciones={liquidaciones.map((l) => ({ ...l, fecha: l.fecha.toISOString() }))}
      finanzas={{
        earned: Number(finanzas.earnedMinor) / 100,
        pending: Number(finanzas.pendingMinor) / 100,
        payoutReserved: Number(finanzas.payoutReservedMinor) / 100,
        paid: Number(finanzas.paidMinor) / 100,
        debt: Number(finanzas.debtMinor) / 100,
        creditLimit: Number(finanzas.creditLimitMinor) / 100,
        creditAvailable: Number(finanzas.creditAvailableMinor) / 100,
        oldestDebtDueAt: finanzas.oldestDebtDueAt?.toISOString() ?? null,
      }}
    />
  )
}
