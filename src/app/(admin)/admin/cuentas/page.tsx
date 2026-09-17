import { CuentasCola } from '@/components/admin/cuentas-cola'
import { CreditPolicyPanel } from '@/components/admin/credit-policy-panel'
import { FinanceOperationsPanel } from '@/components/admin/finance-operations-panel'
import { db } from '@/database'
import { libroCuadra } from '@/lib/comercio/libro'
import { saldosDeTodosLosSitios } from '@/lib/comercio/queries'
import { CreditPolicyService } from '@/lib/commerce/credit-policy-service'
import { loadAdminFinanceOverview } from '@/lib/commerce/finance-admin-queries'

export const dynamic = 'force-dynamic'

export default async function CuentasPage() {
  const [saldos, cuadre, creditos, finanzas] = await Promise.all([
    saldosDeTodosLosSitios(),
    libroCuadra(),
    new CreditPolicyService({ database: db }).listOverview(),
    loadAdminFinanceOverview(db),
  ])

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

      <CreditPolicyPanel
        venues={creditos.map((credito) => ({
          venueId: credito.venueId,
          venueName: credito.venueName,
          venueSlug: credito.venueSlug,
          version: credito.version,
          limit: Number(credito.limitMinor) / 100,
          reserved: Number(credito.activeReservationMinor) / 100,
          outstanding: Number(credito.outstandingDebtMinor) / 100,
          available: Number(credito.availableMinor) / 100,
          overdue: credito.overdueDebtCount,
          maxActiveReservations: credito.maxActiveReservations,
          maxActivePerShopper: credito.maxActivePerShopper,
        }))}
      />

      <FinanceOperationsPanel
        data={{
          treasury: {
            real: finanzas.treasury.real
              ? {
                  cash: Number(finanzas.treasury.real.cashMinor) / 100,
                  refunds: Number(finanzas.treasury.real.customerRefundCoverageMinor) / 100,
                  disputes: Number(finanzas.treasury.real.disputeCoverageMinor) / 100,
                  pendingPayouts: Number(finanzas.treasury.real.pendingPayoutMinor) / 100,
                  minimumReserve: Number(finanzas.treasury.real.minimumOperatingReserveMinor) / 100,
                  available: Number(finanzas.treasury.real.availableForNewPayoutMinor) / 100,
                }
              : null,
            sandbox: finanzas.treasury.sandbox
              ? {
                  cash: Number(finanzas.treasury.sandbox.cashMinor) / 100,
                  refunds: Number(finanzas.treasury.sandbox.customerRefundCoverageMinor) / 100,
                  disputes: Number(finanzas.treasury.sandbox.disputeCoverageMinor) / 100,
                  pendingPayouts: Number(finanzas.treasury.sandbox.pendingPayoutMinor) / 100,
                  minimumReserve:
                    Number(finanzas.treasury.sandbox.minimumOperatingReserveMinor) / 100,
                  available: Number(finanzas.treasury.sandbox.availableForNewPayoutMinor) / 100,
                }
              : null,
          },
          operations: finanzas.operations.map(
            ({ amountMinor, createdAt: _createdAt, ...operation }) => ({
              ...operation,
              amount: Number(amountMinor) / 100,
            })
          ),
          beneficiaries: finanzas.beneficiaries,
          evidence: finanzas.evidence.map(({ createdAt: _createdAt, ...item }) => item),
          charges: finanzas.charges.map((charge) => ({
            id: charge.id,
            orderId: charge.orderId,
            venueName: charge.venueName,
            gross: Number(charge.grossMinor) / 100,
            fundingClassification: charge.fundingClassification,
            cleared: Boolean(charge.clearedAt),
            allocationRevision: charge.allocationRevision,
          })),
          disputes: finanzas.disputes.map(({ grossMinor, ...dispute }) => ({
            ...dispute,
            gross: Number(grossMinor) / 100,
            openedAt: dispute.openedAt.toISOString(),
            resolvedAt: dispute.resolvedAt?.toISOString() ?? null,
          })),
          payoutSources: finanzas.payoutSources.map(
            ({ venueAvailableMinor, foundationAvailableMinor, ...source }) => ({
              ...source,
              venueAvailable: Number(venueAvailableMinor) / 100,
              foundationAvailable: Number(foundationAvailableMinor) / 100,
            })
          ),
          purchases: finanzas.purchases.map(({ amountMinor, ...purchase }) => ({
            ...purchase,
            amount: Number(amountMinor) / 100,
          })),
          purchaseFundingSources: finanzas.purchaseFundingSources.map(
            ({ amountMinor, availableMinor, ...source }) => ({
              ...source,
              amount: Number(amountMinor) / 100,
              available: Number(availableMinor) / 100,
            })
          ),
          recoveryAttempts: finanzas.recoveryAttempts.map((attempt) => ({
            ...attempt,
            createdAt: attempt.createdAt.toISOString(),
            lastCheckedAt: attempt.lastCheckedAt?.toISOString() ?? null,
          })),
          recovery: finanzas.recovery
            ? {
                lastStartedAt: finanzas.recovery.lastStartedAt?.toISOString() ?? null,
                lastSucceededAt: finanzas.recovery.lastSucceededAt?.toISOString() ?? null,
                lastError: finanzas.recovery.lastError,
                leaseExpiresAt: finanzas.recovery.leaseExpiresAt?.toISOString() ?? null,
              }
            : null,
        }}
      />

      <CuentasCola saldos={saldos} />
    </div>
  )
}
