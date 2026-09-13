'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { db } from '@/database'
import { assertAdmin } from '@/lib/auth/admin'
import { AllocationService, type ReconciledDeduction } from '@/lib/commerce/allocation-service'
import { BeneficiaryService } from '@/lib/commerce/beneficiary-service'
import { ChargeDisputeService } from '@/lib/commerce/charge-dispute-service'
import { CommerceEvidenceStorage } from '@/lib/commerce/commerce-evidence-storage'
import { FinanceEvidenceService } from '@/lib/commerce/finance-evidence-service'
import {
  FoundationPurchaseService,
  type PurchaseItemInput,
} from '@/lib/commerce/foundation-purchase-service'
import { parseMinorUnits } from '@/lib/commerce/money'
import { PayoutService } from '@/lib/commerce/payout-service'
import { CommerceRefundService } from '@/lib/commerce/refund-service'
import { createCommercePaymentService } from '@/lib/commerce/payment-service-factory'
import { CommerceRateLimitService } from '@/lib/commerce/rate-limit-service'
import { CommerceRecoveryService } from '@/lib/commerce/recovery-service'
import { TreasuryService } from '@/lib/commerce/treasury-service'
import { CommerceUnitService } from '@/lib/commerce/unit-lifecycle-service'

export type FinanceAdminState =
  | { status: 'idle' }
  | { status: 'error'; error: string }
  | { status: 'success'; message: string }

const operationKey = z.string().regex(/^[A-Za-z0-9:_-]{8,180}$/)
const fingerprint = z.string().regex(/^[a-f0-9]{64}$/)
const requiredText = z.string().trim().min(1).max(500)
const id = z.string().trim().min(1).max(180)
const evidenceFile = z.object({
  contentType: z.enum(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
  contentLength: z
    .number()
    .int()
    .positive()
    .max(20 * 1024 * 1024),
  sha256: fingerprint,
})
const financeRateLimits = new CommerceRateLimitService({ database: db })

const result = async (operation: () => Promise<string>): Promise<FinanceAdminState> => {
  try {
    const message = await operation()
    revalidatePath('/admin/cuentas')
    return { status: 'success', message }
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'No se pudo completar la operación.',
    }
  }
}

const invalid = (message = 'Revisa los datos.'): FinanceAdminState => ({
  status: 'error',
  error: message,
})

const splitIds = (value: string): string[] =>
  value
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean)

const parseSources = (
  value: string
): readonly Readonly<{ unitAllocationId: string; amountMinor: bigint }>[] => {
  const sources = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [unitAllocationId, pesos, ...extra] = line.split(',').map((part) => part.trim())
      if (!unitAllocationId || !pesos || extra.length > 0) {
        throw new Error('Cada fuente debe usar el formato ID_ASIGNACIÓN,monto_en_pesos')
      }
      const amountMinor = parseMinorUnits(pesos)
      if (amountMinor <= BigInt(0)) throw new Error('Cada monto de giro debe ser positivo')
      return { unitAllocationId, amountMinor }
    })
  if (sources.length === 0) throw new Error('Agrega al menos una fuente exacta para el giro')
  return sources
}

const purchaseUnits = new Set<PurchaseItemInput['unit']>([
  'bulto',
  'unidad',
  'm3',
  'lamina',
  'metro',
  'galon',
])

const parsePurchaseItems = (value: string): PurchaseItemInput[] => {
  const items = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, quantity, unit, unitCost, subtotal, ...extra] = line
        .split(',')
        .map((part) => part.trim())
      if (
        !name ||
        !quantity ||
        !unit ||
        !subtotal ||
        extra.length > 0 ||
        !purchaseUnits.has(unit as PurchaseItemInput['unit'])
      ) {
        throw new Error(
          'Cada ítem debe usar: nombre,cantidad,unidad,costo_unitario_opcional,subtotal'
        )
      }
      return {
        name,
        quantity,
        unit: unit as PurchaseItemInput['unit'],
        unitCostMinor: unitCost ? parseMinorUnits(unitCost) : undefined,
        subtotalMinor: parseMinorUnits(subtotal),
      }
    })
  if (items.length === 0) throw new Error('Agrega al menos un ítem de compra')
  return items
}

const parsePurchaseFunding = (
  value: string
): readonly Readonly<{ payoutAllocationId: string; amountMinor: bigint }>[] => {
  const allocations = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [payoutAllocationId, amount, ...extra] = line.split(',').map((part) => part.trim())
      if (!payoutAllocationId || !amount || extra.length > 0) {
        throw new Error('Cada atribución debe usar: ID_ASIGNACIÓN_GIRO,monto_en_pesos')
      }
      return { payoutAllocationId, amountMinor: parseMinorUnits(amount) }
    })
  if (allocations.length === 0) throw new Error('Agrega al menos una fuente de compra')
  return allocations
}

const deductionKinds = new Set([
  'gateway_fee',
  'withholding',
  'tax',
  'temporary_hold',
  'correction',
])
const deductionFinalities = new Set(['estimated', 'final', 'reversed'])

const parseDeductions = (value: string): ReconciledDeduction[] =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [externalKey, kind, amount, finality, evidenceId, ...extra] = line
        .split(',')
        .map((part) => part.trim())
      if (
        !externalKey ||
        !kind ||
        !amount ||
        !finality ||
        extra.length > 0 ||
        !deductionKinds.has(kind) ||
        !deductionFinalities.has(finality)
      ) {
        throw new Error('Cada deducción debe usar: clave,tipo,monto,finalidad,evidencia_opcional')
      }
      return {
        externalKey,
        kind: kind as ReconciledDeduction['kind'],
        amount,
        finality: finality as ReconciledDeduction['finality'],
        evidenceId: evidenceId || undefined,
      }
    })

export const reconcileChargeAction = async (
  _previous: FinanceAdminState,
  formData: FormData
): Promise<FinanceAdminState> => {
  const admin = await assertAdmin()
  if (!admin.ok) return invalid(admin.error)
  const parsed = z
    .object({ operationKey, chargeId: id, deductions: z.string().trim().max(50_000) })
    .safeParse({
      operationKey: formData.get('operationKey'),
      chargeId: formData.get('chargeId'),
      deductions: String(formData.get('deductions') ?? ''),
    })
  if (!parsed.success) return invalid('Revisa el cobro y el reporte de deducciones.')
  const rate = await financeRateLimits.consume({
    scope: 'reconciliation',
    key: `charge:${admin.userId}`,
    limit: 60,
    windowSeconds: 10 * 60,
  })
  if (!rate.allowed) return invalid('Demasiadas conciliaciones seguidas. Espera unos minutos.')
  return result(async () => {
    const reconciled = await new AllocationService({ database: db }).reconcileCharge({
      chargeId: parsed.data.chargeId,
      operationKey: parsed.data.operationKey,
      deductions: parseDeductions(parsed.data.deductions),
      createdByUserId: admin.userId,
    })
    return reconciled.duplicate
      ? `La conciliación ${reconciled.allocationRunId} ya existía.`
      : `Conciliación v${reconciled.revision} guardada: neto ${reconciled.netMinor} centavos.`
  })
}

export const openChargeDisputeAction = async (
  _previous: FinanceAdminState,
  formData: FormData
): Promise<FinanceAdminState> => {
  const admin = await assertAdmin()
  if (!admin.ok) return invalid(admin.error)
  const parsed = z
    .object({
      operationKey,
      chargeId: id,
      providerCaseReference: requiredText,
      reason: requiredText,
      evidenceId: id,
    })
    .safeParse({
      operationKey: formData.get('operationKey'),
      chargeId: formData.get('chargeId'),
      providerCaseReference: formData.get('providerCaseReference'),
      reason: formData.get('reason'),
      evidenceId: formData.get('evidenceId'),
    })
  if (!parsed.success) return invalid('Revisa el cobro, caso, motivo y evidencia de la disputa.')
  const rate = await financeRateLimits.consume({
    scope: 'reconciliation',
    key: `dispute:${admin.userId}`,
    limit: 30,
    windowSeconds: 10 * 60,
  })
  if (!rate.allowed) return invalid('Demasiadas operaciones de disputa. Espera unos minutos.')
  return result(async () => {
    const saved = await new ChargeDisputeService({ database: db }).open({
      ...parsed.data,
      openedByUserId: admin.userId,
    })
    return saved.duplicate
      ? `La disputa ${saved.disputeId} ya estaba registrada.`
      : `Disputa ${saved.disputeId} abierta; el cobro quedó bloqueado para nuevos giros.`
  })
}

export const resolveChargeDisputeAction = async (
  _previous: FinanceAdminState,
  formData: FormData
): Promise<FinanceAdminState> => {
  const admin = await assertAdmin()
  if (!admin.ok) return invalid(admin.error)
  const parsed = z
    .object({
      operationKey,
      disputeId: id,
      outcome: z.enum(['won', 'lost']),
      resolutionReference: requiredText,
      detail: requiredText,
      evidenceId: id,
    })
    .safeParse({
      operationKey: formData.get('operationKey'),
      disputeId: formData.get('disputeId'),
      outcome: formData.get('outcome'),
      resolutionReference: formData.get('resolutionReference'),
      detail: formData.get('detail'),
      evidenceId: formData.get('evidenceId'),
    })
  if (!parsed.success) return invalid('Revisa la disputa, resultado y evidencia de resolución.')
  const rate = await financeRateLimits.consume({
    scope: 'reconciliation',
    key: `dispute:${admin.userId}`,
    limit: 30,
    windowSeconds: 10 * 60,
  })
  if (!rate.allowed) return invalid('Demasiadas operaciones de disputa. Espera unos minutos.')
  return result(async () => {
    const saved = await new ChargeDisputeService({ database: db }).resolve({
      ...parsed.data,
      resolvedByUserId: admin.userId,
    })
    return saved.duplicate
      ? `La resolución de ${saved.disputeId} ya estaba registrada.`
      : saved.status === 'won'
        ? `Disputa ${saved.disputeId} ganada; el cobro volvió a estar aprobado.`
        : `Disputa ${saved.disputeId} perdida; la pérdida se cargó a la reserva operativa.`
  })
}

export const configureTreasuryPolicyAction = async (
  _previous: FinanceAdminState,
  formData: FormData
): Promise<FinanceAdminState> => {
  const admin = await assertAdmin()
  if (!admin.ok) return invalid(admin.error)
  const parsed = z
    .object({
      operationKey,
      fundingClassification: z.enum(['real', 'sandbox']),
      minimumReservePesos: z.string().trim().min(1),
    })
    .safeParse({
      operationKey: formData.get('operationKey'),
      fundingClassification: formData.get('fundingClassification'),
      minimumReservePesos: formData.get('minimumReservePesos'),
    })
  if (!parsed.success) return invalid('Revisa la clasificación y la reserva mínima.')
  return result(async () => {
    const minimumOperatingReserveMinor = parseMinorUnits(parsed.data.minimumReservePesos)
    if (minimumOperatingReserveMinor < BigInt(0))
      throw new Error('La reserva no puede ser negativa')
    const saved = await new TreasuryService({ database: db }).configurePolicy({
      operationKey: parsed.data.operationKey,
      fundingClassification: parsed.data.fundingClassification,
      minimumOperatingReserveMinor,
      approvedByUserId: admin.userId,
    })
    return saved.duplicate
      ? 'Esa política ya estaba guardada.'
      : `Reserva v${saved.version} activada.`
  })
}

export type EvidenceTransferResult =
  | { ok: false; error: string }
  | {
      ok: true
      key: string
      uploadUrl: string
      headers: Record<string, string>
    }

export const signPrivateEvidenceUploadAction = async (input: {
  ownerType: string
  ownerId: string
  file: z.infer<typeof evidenceFile>
}): Promise<EvidenceTransferResult> => {
  const admin = await assertAdmin()
  if (!admin.ok) return { ok: false, error: admin.error }
  const parsed = z
    .object({
      ownerType: requiredText,
      ownerId: id,
      file: evidenceFile,
    })
    .safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Revisa el dueño y el archivo privado.' }
  try {
    const prepared = await new CommerceEvidenceStorage({ database: db }).preparePrivateUpload(
      parsed.data
    )
    return { ok: true, ...prepared }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'No se pudo preparar la carga privada.',
    }
  }
}

export const finalizePrivateEvidenceUploadAction = async (input: {
  ownerType: string
  ownerId: string
  kind: string
  key: string
  file: z.infer<typeof evidenceFile>
}): Promise<FinanceAdminState> => {
  const admin = await assertAdmin()
  if (!admin.ok) return invalid(admin.error)
  const parsed = z
    .object({
      ownerType: requiredText,
      ownerId: id,
      kind: requiredText,
      key: z.string().trim().min(8).max(500),
      file: evidenceFile,
    })
    .safeParse(input)
  if (!parsed.success) return invalid('Revisa el dueño, tipo y archivo privado.')
  return result(async () => {
    const saved = await new CommerceEvidenceStorage({ database: db }).finalizePrivate({
      ...parsed.data,
      actorUserId: admin.userId,
    })
    return saved.duplicate
      ? `La evidencia ${saved.evidenceId} ya estaba verificada en R2.`
      : `Evidencia ${saved.evidenceId} verificada en R2 y registrada como privada.`
  })
}

export const signPublicEvidenceUploadAction = async (input: {
  evidenceId: string
  file: z.infer<typeof evidenceFile>
}): Promise<EvidenceTransferResult> => {
  const admin = await assertAdmin()
  if (!admin.ok) return { ok: false, error: admin.error }
  const parsed = z.object({ evidenceId: id, file: evidenceFile }).safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Revisa la evidencia y el archivo público.' }
  try {
    const prepared = await new CommerceEvidenceStorage({ database: db }).preparePublicRedaction(
      parsed.data
    )
    return { ok: true, ...prepared }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'No se pudo preparar la copia pública.',
    }
  }
}

export const publishPublicEvidenceAction = async (input: {
  evidenceId: string
  key: string
  file: z.infer<typeof evidenceFile>
}): Promise<FinanceAdminState> => {
  const admin = await assertAdmin()
  if (!admin.ok) return invalid(admin.error)
  const parsed = z
    .object({ evidenceId: id, key: z.string().trim().min(8).max(500), file: evidenceFile })
    .safeParse(input)
  if (!parsed.success) return invalid('Revisa la evidencia y su copia pública.')
  return result(async () => {
    const published = await new CommerceEvidenceStorage({ database: db }).publishRedaction({
      ...parsed.data,
      reviewedByUserId: admin.userId,
    })
    return published.duplicate
      ? 'Esa copia pública ya estaba publicada.'
      : 'Copia redactada publicada; el original privado se conservó por separado.'
  })
}

export const withdrawPublicEvidenceAction = async (
  _previous: FinanceAdminState,
  formData: FormData
): Promise<FinanceAdminState> => {
  const admin = await assertAdmin()
  if (!admin.ok) return invalid(admin.error)
  const parsed = z.object({ evidenceId: id, reason: requiredText }).safeParse({
    evidenceId: formData.get('evidenceId'),
    reason: formData.get('reason'),
  })
  if (!parsed.success) return invalid('Indica evidencia y motivo de retiro.')
  return result(async () => {
    await new CommerceEvidenceStorage({ database: db }).withdraw({
      ...parsed.data,
      actorUserId: admin.userId,
    })
    return 'Publicación retirada. El original privado y la auditoría permanecen.'
  })
}

export const probeEvidenceStorageAction = async (
  _previous: FinanceAdminState,
  _formData: FormData
): Promise<FinanceAdminState> => {
  const admin = await assertAdmin()
  if (!admin.ok) return invalid(admin.error)
  return result(async () => {
    await new CommerceEvidenceStorage({ database: db }).probeConfiguration()
    return 'R2 privado, R2 público y la URL pública están configurados.'
  })
}

export const reconcilePaymentAttemptAction = async (
  _previous: FinanceAdminState,
  formData: FormData
): Promise<FinanceAdminState> => {
  const admin = await assertAdmin()
  if (!admin.ok) return invalid(admin.error)
  const parsed = z.object({ attemptId: id, reference: requiredText }).safeParse({
    attemptId: formData.get('attemptId'),
    reference: formData.get('reference'),
  })
  if (!parsed.success) return invalid('Indica intento y referencia de la pasarela.')
  const rate = await financeRateLimits.consume({
    scope: 'reconciliation',
    key: `attempt:${admin.userId}`,
    limit: 60,
    windowSeconds: 10 * 60,
  })
  if (!rate.allowed) return invalid('Demasiadas consultas seguidas. Espera unos minutos.')
  return result(async () => {
    const recovered = await createCommercePaymentService().reconcileAttempt(parsed.data)
    if (recovered.kind === 'retryable') {
      throw new Error(
        `La consulta sigue incierta: ${recovered.reason ?? 'sin respuesta definitiva'}`
      )
    }
    const messages = {
      applied: 'Pago recuperado y aplicado desde la consulta autoritativa.',
      pending: 'La pasarela confirma que el pago sigue pendiente.',
      rejected: 'La consulta autoritativa rechazó el pago; no se emitió ningún QR.',
      'not-found': 'No existe un intento local para esa referencia.',
    } as const
    return messages[recovered.kind]
  })
}

export const runCommerceRecoveryAction = async (
  _previous: FinanceAdminState,
  _formData: FormData
): Promise<FinanceAdminState> => {
  const admin = await assertAdmin()
  if (!admin.ok) return invalid(admin.error)
  return result(async () => {
    const recovered = await new CommerceRecoveryService({
      database: db,
      payments: createCommercePaymentService(),
      units: new CommerceUnitService({ database: db }),
    }).run()
    if (recovered.status === 'completed_with_errors') {
      throw new Error(
        `La recuperación terminó con ${recovered.errors.length} errores y ${recovered.attemptBacklog} pendientes.`
      )
    }
    if (recovered.status === 'overlap') return 'Ya hay otra recuperación en curso.'
    return `Recuperación completa: ${recovered.attemptsReviewed} pagos revisados, ${recovered.units.expired} unidades vencidas y ${recovered.attemptBacklog} pendientes.`
  })
}

export const getPrivateEvidenceDownloadAction = async (
  evidenceId: string
): Promise<{ ok: true; url: string } | { ok: false; error: string }> => {
  const admin = await assertAdmin()
  if (!admin.ok) return { ok: false, error: admin.error }
  const parsed = id.safeParse(evidenceId)
  if (!parsed.success) return { ok: false, error: 'Indica una evidencia privada válida.' }
  try {
    return {
      ok: true,
      url: await new CommerceEvidenceStorage({ database: db }).privateDownloadUrl(parsed.data),
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'No se pudo abrir el original privado.',
    }
  }
}

export const reviewFinanceEvidenceAction = async (
  _previous: FinanceAdminState,
  formData: FormData
): Promise<FinanceAdminState> => {
  const admin = await assertAdmin()
  if (!admin.ok) return invalid(admin.error)
  const parsed = z.object({ evidenceId: id }).safeParse({ evidenceId: formData.get('evidenceId') })
  if (!parsed.success) return invalid('Indica la evidencia que revisaste.')
  return result(async () => {
    const reviewed = await new FinanceEvidenceService({ database: db }).review({
      evidenceId: parsed.data.evidenceId,
      reviewedByUserId: admin.userId,
    })
    return reviewed.duplicate
      ? 'La evidencia ya estaba revisada.'
      : 'Evidencia marcada como revisada.'
  })
}

export const recordFoundationPurchaseAction = async (
  _previous: FinanceAdminState,
  formData: FormData
): Promise<FinanceAdminState> => {
  const admin = await assertAdmin()
  if (!admin.ok) return invalid(admin.error)
  const parsed = z
    .object({
      operationKey,
      beneficiaryId: id,
      amountPesos: z.string().trim().min(1),
      correctionOfId: z.string().trim().max(180).optional(),
      slug: z.string().trim().min(1).max(160),
      title: z.string().trim().min(2).max(180),
      summary: z.string().trim().max(500).optional(),
      story: z.string().trim().max(10_000).optional(),
      municipality: z.string().trim().min(2).max(120),
      department: z.string().trim().min(2).max(120),
      beneficiaryLabel: z.string().trim().max(180).optional(),
      householdsHelped: z.string().trim().max(8).optional(),
      supplierName: z.string().trim().max(180).optional(),
      receiptNumber: z.string().trim().max(180).optional(),
      purchasedAt: z.string().trim().min(1),
      items: z.string().trim().min(1).max(50_000),
    })
    .safeParse({
      operationKey: formData.get('operationKey'),
      beneficiaryId: formData.get('beneficiaryId'),
      amountPesos: formData.get('amountPesos'),
      correctionOfId: String(formData.get('correctionOfId') ?? '').trim() || undefined,
      slug: formData.get('slug'),
      title: formData.get('title'),
      summary: String(formData.get('summary') ?? '').trim() || undefined,
      story: String(formData.get('story') ?? '').trim() || undefined,
      municipality: formData.get('municipality'),
      department: formData.get('department'),
      beneficiaryLabel: String(formData.get('beneficiaryLabel') ?? '').trim() || undefined,
      householdsHelped: String(formData.get('householdsHelped') ?? '').trim() || undefined,
      supplierName: String(formData.get('supplierName') ?? '').trim() || undefined,
      receiptNumber: String(formData.get('receiptNumber') ?? '').trim() || undefined,
      purchasedAt: formData.get('purchasedAt'),
      items: formData.get('items'),
    })
  if (!parsed.success) return invalid('Revisa los datos y renglones de la compra.')
  return result(async () => {
    const purchasedAt = new Date(parsed.data.purchasedAt)
    const householdsHelped = parsed.data.householdsHelped
      ? Number(parsed.data.householdsHelped)
      : undefined
    const saved = await new FoundationPurchaseService({ database: db }).record({
      operationKey: parsed.data.operationKey,
      beneficiaryId: parsed.data.beneficiaryId,
      amountMinor: parseMinorUnits(parsed.data.amountPesos),
      currency: 'COP',
      correctionOfId: parsed.data.correctionOfId,
      details: {
        slug: parsed.data.slug,
        title: parsed.data.title,
        summary: parsed.data.summary,
        story: parsed.data.story,
        municipality: parsed.data.municipality,
        department: parsed.data.department,
        beneficiaryLabel: parsed.data.beneficiaryLabel,
        householdsHelped,
        supplierName: parsed.data.supplierName,
        receiptNumber: parsed.data.receiptNumber,
        purchasedAt,
        items: parsePurchaseItems(parsed.data.items),
      },
      actorUserId: admin.userId,
    })
    return saved.duplicate
      ? `La compra ${saved.purchaseId} ya estaba registrada.`
      : `Compra ${saved.purchaseId} registrada. Carga su recibo con ese ID como dueño.`
  })
}

export const verifyFoundationPurchaseAction = async (
  _previous: FinanceAdminState,
  formData: FormData
): Promise<FinanceAdminState> => {
  const admin = await assertAdmin()
  if (!admin.ok) return invalid(admin.error)
  const parsed = z.object({ purchaseId: id, receiptEvidenceId: id }).safeParse({
    purchaseId: formData.get('purchaseId'),
    receiptEvidenceId: formData.get('receiptEvidenceId'),
  })
  if (!parsed.success) return invalid('Indica compra y recibo revisado.')
  return result(async () => {
    const saved = await new FoundationPurchaseService({ database: db }).verify({
      ...parsed.data,
      verifiedByUserId: admin.userId,
    })
    return saved.duplicate ? 'La compra ya estaba verificada.' : 'Compra verificada con su recibo.'
  })
}

export const allocateFoundationPurchaseAction = async (
  _previous: FinanceAdminState,
  formData: FormData
): Promise<FinanceAdminState> => {
  const admin = await assertAdmin()
  if (!admin.ok) return invalid(admin.error)
  const parsed = z.object({ purchaseId: id, allocations: z.string().trim().min(1) }).safeParse({
    purchaseId: formData.get('purchaseId'),
    allocations: formData.get('allocations'),
  })
  if (!parsed.success) return invalid('Indica compra y fuentes de giro.')
  return result(async () => {
    const saved = await new FoundationPurchaseService({ database: db }).allocateFunding({
      purchaseId: parsed.data.purchaseId,
      allocations: parsePurchaseFunding(parsed.data.allocations),
      actorUserId: admin.userId,
    })
    return saved.duplicate
      ? 'Esa atribución ya estaba registrada.'
      : `Se atribuyeron ${saved.allocatedMinor} centavos sin exceder la compra ni el giro.`
  })
}

export const publishFoundationPurchaseAction = async (
  _previous: FinanceAdminState,
  formData: FormData
): Promise<FinanceAdminState> => {
  const admin = await assertAdmin()
  if (!admin.ok) return invalid(admin.error)
  const parsed = z.object({ purchaseId: id }).safeParse({ purchaseId: formData.get('purchaseId') })
  if (!parsed.success) return invalid('Indica la compra verificada.')
  return result(async () => {
    const saved = await new FoundationPurchaseService({ database: db }).publish({
      purchaseId: parsed.data.purchaseId,
      actorUserId: admin.userId,
    })
    return saved.duplicate
      ? 'La compra ya estaba publicada.'
      : 'Compra publicada con su recibo redactado.'
  })
}

export const rejectFoundationPurchaseAction = async (
  _previous: FinanceAdminState,
  formData: FormData
): Promise<FinanceAdminState> => {
  const admin = await assertAdmin()
  if (!admin.ok) return invalid(admin.error)
  const parsed = z.object({ purchaseId: id, reason: requiredText }).safeParse({
    purchaseId: formData.get('purchaseId'),
    reason: formData.get('reason'),
  })
  if (!parsed.success) return invalid('Indica compra y motivo de rechazo.')
  return result(async () => {
    await new FoundationPurchaseService({ database: db }).reject({
      ...parsed.data,
      actorUserId: admin.userId,
    })
    return 'Compra rechazada y retirada de la vista pública; la auditoría permanece.'
  })
}

export const registerBeneficiaryAction = async (
  _previous: FinanceAdminState,
  formData: FormData
): Promise<FinanceAdminState> => {
  const admin = await assertAdmin()
  if (!admin.ok) return invalid(admin.error)
  const parsed = z
    .object({
      kind: z.enum(['foundation', 'venue']),
      venueId: z.string().trim().max(180).optional(),
      legalName: z.string().trim().min(2).max(180),
      legalIdentifierHash: fingerprint,
    })
    .safeParse({
      kind: formData.get('kind'),
      venueId: String(formData.get('venueId') ?? '').trim() || undefined,
      legalName: formData.get('legalName'),
      legalIdentifierHash: formData.get('legalIdentifierHash'),
    })
  if (!parsed.success) return invalid('Revisa la identidad legal del beneficiario.')
  return result(async () => {
    const saved = await new BeneficiaryService({ database: db }).register({
      ...parsed.data,
      actorUserId: admin.userId,
    })
    return saved.duplicate
      ? `El beneficiario ${saved.beneficiaryId} ya existía.`
      : `Beneficiario ${saved.beneficiaryId} registrado y pendiente de verificación.`
  })
}

export const verifyBeneficiaryAction = async (
  _previous: FinanceAdminState,
  formData: FormData
): Promise<FinanceAdminState> => {
  const admin = await assertAdmin()
  if (!admin.ok) return invalid(admin.error)
  const parsed = z.object({ beneficiaryId: id, agreementEvidenceId: id }).safeParse({
    beneficiaryId: formData.get('beneficiaryId'),
    agreementEvidenceId: formData.get('agreementEvidenceId'),
  })
  if (!parsed.success) return invalid('Indica beneficiario y acuerdo revisado.')
  return result(async () => {
    await new BeneficiaryService({ database: db }).verify({
      ...parsed.data,
      verifiedByUserId: admin.userId,
    })
    return 'Beneficiario verificado.'
  })
}

export const addBeneficiaryBankVersionAction = async (
  _previous: FinanceAdminState,
  formData: FormData
): Promise<FinanceAdminState> => {
  const admin = await assertAdmin()
  if (!admin.ok) return invalid(admin.error)
  const parsed = z
    .object({
      beneficiaryId: id,
      destinationFingerprint: fingerprint,
      encryptedDetailsStorageKey: z.string().trim().min(8).max(500),
    })
    .safeParse({
      beneficiaryId: formData.get('beneficiaryId'),
      destinationFingerprint: formData.get('destinationFingerprint'),
      encryptedDetailsStorageKey: formData.get('encryptedDetailsStorageKey'),
    })
  if (!parsed.success) return invalid('Revisa el beneficiario y el destino bancario cifrado.')
  return result(async () => {
    const saved = await new BeneficiaryService({ database: db }).addBankVersion({
      ...parsed.data,
      actorUserId: admin.userId,
    })
    return `Destino bancario ${saved.bankVersionId} v${saved.version} pendiente de verificación.`
  })
}

export const verifyBeneficiaryBankVersionAction = async (
  _previous: FinanceAdminState,
  formData: FormData
): Promise<FinanceAdminState> => {
  const admin = await assertAdmin()
  if (!admin.ok) return invalid(admin.error)
  const parsed = z
    .object({
      bankVersionId: id,
      evidenceId: id,
      verificationMethod: requiredText,
      verificationReference: requiredText,
    })
    .safeParse({
      bankVersionId: formData.get('bankVersionId'),
      evidenceId: formData.get('evidenceId'),
      verificationMethod: formData.get('verificationMethod'),
      verificationReference: formData.get('verificationReference'),
    })
  if (!parsed.success) return invalid('Revisa la versión, evidencia y referencia bancaria.')
  return result(async () => {
    await new BeneficiaryService({ database: db }).verifyBankVersion({
      ...parsed.data,
      verifiedByUserId: admin.userId,
    })
    return 'Destino bancario verificado.'
  })
}

export const reserveRefundAction = async (
  _previous: FinanceAdminState,
  formData: FormData
): Promise<FinanceAdminState> => {
  const admin = await assertAdmin()
  if (!admin.ok) return invalid(admin.error)
  const parsed = z
    .object({
      operationKey,
      orderId: id,
      unitIds: z.string().trim().min(1).max(10_000),
      destinationFingerprint: fingerprint,
    })
    .safeParse({
      operationKey: formData.get('operationKey'),
      orderId: formData.get('orderId'),
      unitIds: formData.get('unitIds'),
      destinationFingerprint: formData.get('destinationFingerprint'),
    })
  if (!parsed.success) return invalid('Revisa pedido, unidades y destino original verificado.')
  return result(async () => {
    const saved = await new CommerceRefundService({ database: db }).reserveRefund({
      operationKey: parsed.data.operationKey,
      orderId: parsed.data.orderId,
      unitIds: splitIds(parsed.data.unitIds),
      destinationFingerprint: parsed.data.destinationFingerprint,
      requestedByUserId: admin.userId,
    })
    return saved.duplicate
      ? `La devolución ${saved.operationId} ya estaba reservada.`
      : `Devolución ${saved.operationId} reservada por ${saved.amountMinor} centavos.`
  })
}

export const preparePayoutAction = async (
  _previous: FinanceAdminState,
  formData: FormData
): Promise<FinanceAdminState> => {
  const admin = await assertAdmin()
  if (!admin.ok) return invalid(admin.error)
  const parsed = z
    .object({
      operationKey,
      kind: z.enum(['venue_payout', 'foundation_payout']),
      beneficiaryBankVersionId: id,
      fundingClassification: z.enum(['real', 'sandbox']),
      sources: z.string().trim().min(1).max(50_000),
    })
    .safeParse({
      operationKey: formData.get('operationKey'),
      kind: formData.get('kind'),
      beneficiaryBankVersionId: formData.get('beneficiaryBankVersionId'),
      fundingClassification: formData.get('fundingClassification'),
      sources: formData.get('sources'),
    })
  if (!parsed.success) return invalid('Revisa beneficiario, clasificación y fuentes del giro.')
  return result(async () => {
    const saved = await new PayoutService({ database: db }).prepare({
      ...parsed.data,
      sources: parseSources(parsed.data.sources),
      requestedByUserId: admin.userId,
    })
    return saved.duplicate
      ? `El giro ${saved.operationId} ya estaba preparado.`
      : `Giro ${saved.operationId} preparado por ${saved.amountMinor} centavos.`
  })
}

export const transitionFinancialOperationAction = async (
  _previous: FinanceAdminState,
  formData: FormData
): Promise<FinanceAdminState> => {
  const admin = await assertAdmin()
  if (!admin.ok) return invalid(admin.error)
  const parsed = z
    .object({
      operationType: z.enum(['refund', 'payout']),
      transition: z.enum(['submitted_unknown', 'confirm', 'fail', 'reverse']),
      operationId: id,
      operationKey: z.string().trim().max(180).optional(),
      externalReference: z.string().trim().max(180).optional(),
      evidenceId: z.string().trim().max(180).optional(),
      destinationFingerprint: z.string().trim().max(64).optional(),
      detail: z.string().trim().max(500).optional(),
    })
    .safeParse({
      operationType: formData.get('operationType'),
      transition: formData.get('transition'),
      operationId: formData.get('operationId'),
      operationKey: String(formData.get('operationKey') ?? '').trim() || undefined,
      externalReference: String(formData.get('externalReference') ?? '').trim() || undefined,
      evidenceId: String(formData.get('evidenceId') ?? '').trim() || undefined,
      destinationFingerprint:
        String(formData.get('destinationFingerprint') ?? '').trim() || undefined,
      detail: String(formData.get('detail') ?? '').trim() || undefined,
    })
  if (!parsed.success) return invalid('Revisa la transición financiera.')

  return result(async () => {
    const refunds = new CommerceRefundService({ database: db })
    const payouts = new PayoutService({ database: db })
    const data = parsed.data
    if (data.transition === 'submitted_unknown') {
      if (!data.detail) throw new Error('Describe por qué el resultado quedó incierto')
      if (data.operationType === 'refund') {
        await refunds.markSubmittedUnknown({
          operationId: data.operationId,
          submittedByUserId: admin.userId,
          statusDetail: data.detail,
          externalReference: data.externalReference,
        })
      } else {
        await payouts.markSubmittedUnknown({
          operationId: data.operationId,
          submittedByUserId: admin.userId,
          statusDetail: data.detail,
          externalReference: data.externalReference,
        })
      }
      return 'La operación quedó reservada con resultado incierto; no se creará otra.'
    }
    if (data.transition === 'confirm') {
      if (!data.externalReference || !data.evidenceId || !data.destinationFingerprint) {
        throw new Error('Confirmar exige referencia, evidencia revisada y huella del destino')
      }
      if (data.operationType === 'refund') {
        await refunds.confirm({
          operationId: data.operationId,
          externalReference: data.externalReference,
          bankEvidenceId: data.evidenceId,
          destinationFingerprint: data.destinationFingerprint,
          verifiedByUserId: admin.userId,
        })
      } else {
        await payouts.confirm({
          operationId: data.operationId,
          externalReference: data.externalReference,
          bankEvidenceId: data.evidenceId,
          destinationFingerprint: data.destinationFingerprint,
          verifiedByUserId: admin.userId,
        })
      }
      return data.operationType === 'refund'
        ? 'Devolución confirmada con evidencia.'
        : 'Giro confirmado con evidencia.'
    }
    if (data.transition === 'fail') {
      if (!data.detail) throw new Error('Registra el motivo verificado del fallo')
      if (data.operationType === 'refund') {
        await refunds.fail({
          operationId: data.operationId,
          reason: data.detail,
          evidenceId: data.evidenceId,
          verifiedByUserId: admin.userId,
        })
      } else {
        if (!data.evidenceId) throw new Error('El fallo de un giro exige evidencia revisada')
        await payouts.fail({
          operationId: data.operationId,
          reason: data.detail,
          evidenceId: data.evidenceId,
          verifiedByUserId: admin.userId,
        })
      }
      return 'Fallo registrado; las fuentes vuelven a estar disponibles cuando corresponde.'
    }
    if (data.operationType !== 'payout') throw new Error('Solo un giro confirmado puede revertirse')
    if (!data.operationKey || !data.externalReference || !data.evidenceId) {
      throw new Error('La reversión exige clave, referencia y evidencia revisada')
    }
    await payouts.reverse({
      operationId: data.operationId,
      operationKey: data.operationKey,
      externalReference: data.externalReference,
      evidenceId: data.evidenceId,
      verifiedByUserId: admin.userId,
    })
    return 'Reversión bancaria registrada con un asiento compensatorio.'
  })
}
