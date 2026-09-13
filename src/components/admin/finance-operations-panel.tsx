'use client'

import { type FormEvent, type ReactNode, useActionState, useEffect, useState } from 'react'

import {
  addBeneficiaryBankVersionAction,
  allocateFoundationPurchaseAction,
  configureTreasuryPolicyAction,
  type FinanceAdminState,
  finalizePrivateEvidenceUploadAction,
  getPrivateEvidenceDownloadAction,
  openChargeDisputeAction,
  preparePayoutAction,
  probeEvidenceStorageAction,
  publishFoundationPurchaseAction,
  publishPublicEvidenceAction,
  reconcileChargeAction,
  reconcilePaymentAttemptAction,
  registerBeneficiaryAction,
  recordFoundationPurchaseAction,
  rejectFoundationPurchaseAction,
  reserveRefundAction,
  resolveChargeDisputeAction,
  reviewFinanceEvidenceAction,
  runCommerceRecoveryAction,
  signPrivateEvidenceUploadAction,
  signPublicEvidenceUploadAction,
  transitionFinancialOperationAction,
  verifyBeneficiaryAction,
  verifyBeneficiaryBankVersionAction,
  verifyFoundationPurchaseAction,
  withdrawPublicEvidenceAction,
} from '@/app/actions/finanzas'
import { toastManager } from '@/components/ui/toast'
import { formatCOP, formatDate } from '@/lib/utils/format'

type Action = (state: FinanceAdminState, formData: FormData) => Promise<FinanceAdminState>

type TreasuryView = Readonly<{
  cash: number
  refunds: number
  disputes: number
  pendingPayouts: number
  minimumReserve: number
  available: number
}>

export type FinanceOperationsView = Readonly<{
  treasury: Readonly<Record<'real' | 'sandbox', TreasuryView | null>>
  operations: readonly Readonly<{
    id: string
    kind: string
    status: string
    amount: number
    fundingClassification: string | null
    externalReference: string | null
    destinationFingerprint: string | null
    bankEvidenceId: string | null
    statusDetail: string | null
  }>[]
  beneficiaries: readonly Readonly<{
    id: string
    kind: string
    legalName: string
    status: string
    venueName: string | null
    bankVersionId: string | null
    bankVersion: number | null
    bankStatus: string | null
    destinationFingerprint: string | null
  }>[]
  evidence: readonly Readonly<{
    id: string
    ownerType: string
    ownerId: string
    kind: string
    status: string
    sha256: string
  }>[]
  charges: readonly Readonly<{
    id: string
    orderId: string
    venueName: string
    gross: number
    fundingClassification: string
    cleared: boolean
    allocationRevision: number | null
  }>[]
  disputes: readonly Readonly<{
    id: string
    chargeId: string
    providerCaseReference: string
    reason: string
    status: string
    gross: number
    venueName: string
    openedAt: string
    resolvedAt: string | null
  }>[]
  payoutSources: readonly Readonly<{
    id: string
    venueName: string
    venueId: string
    foundationBeneficiaryId: string | null
    fundingClassification: string
    venueAvailable: number
    foundationAvailable: number
  }>[]
  purchases: readonly Readonly<{
    id: string
    title: string
    status: string
    amount: number
    beneficiaryId: string
    receiptEvidenceId: string | null
    publicStatus: string
  }>[]
  purchaseFundingSources: readonly Readonly<{
    id: string
    externalReference: string | null
    beneficiaryName: string
    amount: number
    available: number
  }>[]
  recoveryAttempts: readonly Readonly<{
    id: string
    status: string
    provider: string
    reference: string | null
    outcomeDetail: string | null
    lastCheckedAt: string | null
    createdAt: string
  }>[]
  recovery: Readonly<{
    lastStartedAt: string | null
    lastSucceededAt: string | null
    lastError: string | null
    leaseExpiresAt: string | null
  }> | null
}>

const field =
  'w-full rounded-lg border border-border bg-background px-3 py-2 font-sans text-sm placeholder:text-muted-foreground'

const newOperationKey = (prefix: string): string =>
  typeof globalThis.crypto?.randomUUID === 'function'
    ? `${prefix}:${globalThis.crypto.randomUUID()}`
    : `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}`

function OperationKey({ prefix }: { prefix: string }) {
  const [value, setValue] = useState('')
  useEffect(() => setValue(newOperationKey(prefix)), [prefix])
  return <input type='hidden' name='operationKey' value={value} readOnly />
}

function ActionForm({
  action,
  title,
  description,
  children,
}: {
  action: Action
  title: string
  description?: string
  children: ReactNode
}) {
  const [state, formAction, pending] = useActionState(action, { status: 'idle' })
  const [formVersion, setFormVersion] = useState(0)
  useEffect(() => {
    if (state.status === 'success') {
      toastManager.add({ title: state.message, type: 'success' })
      setFormVersion((version) => version + 1)
    } else if (state.status === 'error') {
      toastManager.add({ title: 'No se pudo completar', description: state.error, type: 'error' })
    }
  }, [state])
  return (
    <form
      key={formVersion}
      action={formAction}
      className='rounded-xl border border-border bg-card p-4'
    >
      <h3 className='font-display font-bold text-base'>{title}</h3>
      {description ? <p className='mt-1 text-muted-foreground text-sm'>{description}</p> : null}
      <div className='mt-3 grid gap-3'>{children}</div>
      <button
        type='submit'
        disabled={pending}
        className='mt-3 rounded-lg bg-primary px-4 py-2 font-display text-label-lg text-primary-foreground uppercase disabled:opacity-50'
      >
        {pending ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  )
}

function TextInput({
  name,
  placeholder,
  type = 'text',
  required = true,
}: {
  name: string
  placeholder: string
  type?: string
  required?: boolean
}) {
  return (
    <input
      className={field}
      name={name}
      type={type}
      placeholder={placeholder}
      required={required}
    />
  )
}

const fileSha256 = async (file: File): Promise<string> => {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function EvidenceUploadForm({ mode }: { mode: 'private' | 'public' }) {
  const [pending, setPending] = useState(false)
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPending(true)
    try {
      const form = event.currentTarget
      const data = new FormData(form)
      const file = data.get('file')
      if (!(file instanceof File) || file.size === 0) throw new Error('Selecciona un archivo')
      const contentType = file.type as 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp'
      const metadata = {
        contentType,
        contentLength: file.size,
        sha256: await fileSha256(file),
      }
      const evidenceId = String(data.get('evidenceId') ?? '')
      const ownerType = String(data.get('ownerType') ?? '')
      const ownerId = String(data.get('ownerId') ?? '')
      const signed =
        mode === 'private'
          ? await signPrivateEvidenceUploadAction({ ownerType, ownerId, file: metadata })
          : await signPublicEvidenceUploadAction({ evidenceId, file: metadata })
      if (!signed.ok) throw new Error(signed.error)
      const upload = await fetch(signed.uploadUrl, {
        method: 'PUT',
        headers: signed.headers,
        body: file,
      })
      if (!upload.ok) throw new Error(`R2 rechazó la carga (${upload.status})`)
      const saved =
        mode === 'private'
          ? await finalizePrivateEvidenceUploadAction({
              ownerType,
              ownerId,
              kind: String(data.get('kind') ?? ''),
              key: signed.key,
              file: metadata,
            })
          : await publishPublicEvidenceAction({ evidenceId, key: signed.key, file: metadata })
      if (saved.status !== 'success') {
        throw new Error(saved.status === 'error' ? saved.error : 'La carga no se confirmó')
      }
      toastManager.add({ title: saved.message, type: 'success' })
      form.reset()
    } catch (error) {
      toastManager.add({
        title: 'No se pudo completar la carga',
        description: error instanceof Error ? error.message : 'Error desconocido',
        type: 'error',
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} className='rounded-xl border border-border bg-card p-4'>
      <h3 className='font-display font-bold text-base'>
        {mode === 'private' ? 'Cargar original privado' : 'Publicar copia redactada'}
      </h3>
      <p className='mt-1 text-muted-foreground text-sm'>
        {mode === 'private'
          ? 'Se firma la carga, se verifica tamaño, tipo y SHA-256 en el bucket privado, y solo entonces se registra.'
          : 'Solo evidencia revisada. Usa una copia sin datos bancarios ni personales; nunca el original.'}
      </p>
      <div className='mt-3 grid gap-3'>
        {mode === 'private' ? (
          <>
            <TextInput name='ownerType' placeholder='Tipo de dueño: foundation_purchase, …' />
            <TextInput name='ownerId' placeholder='ID del dueño' />
            <TextInput name='kind' placeholder='Tipo de evidencia: purchase_receipt, …' />
          </>
        ) : (
          <TextInput name='evidenceId' placeholder='ID de evidencia revisada' />
        )}
        <input
          className={field}
          name='file'
          type='file'
          accept='application/pdf,image/jpeg,image/png,image/webp'
          required
        />
      </div>
      <button
        type='submit'
        disabled={pending}
        className='mt-3 rounded-lg bg-primary px-4 py-2 font-display text-label-lg text-primary-foreground uppercase disabled:opacity-50'
      >
        {pending ? 'Cargando…' : mode === 'private' ? 'Cargar y verificar' : 'Publicar redacción'}
      </button>
    </form>
  )
}

function PrivateEvidenceButton({ evidenceId }: { evidenceId: string }) {
  const [pending, setPending] = useState(false)
  const open = async () => {
    setPending(true)
    const result = await getPrivateEvidenceDownloadAction(evidenceId)
    setPending(false)
    if (!result.ok) {
      toastManager.add({ title: 'No se pudo abrir', description: result.error, type: 'error' })
      return
    }
    window.open(result.url, '_blank', 'noopener,noreferrer')
  }
  return (
    <button type='button' onClick={open} disabled={pending} className='mt-1 underline'>
      {pending ? 'Firmando acceso…' : 'Abrir original privado'}
    </button>
  )
}

function TreasuryCard({
  classification,
  snapshot,
}: {
  classification: 'real' | 'sandbox'
  snapshot: TreasuryView | null
}) {
  return (
    <div className='rounded-xl border border-border bg-card p-4'>
      <div className='flex items-center justify-between gap-3'>
        <h3 className='font-display font-bold text-lg uppercase'>{classification}</h3>
        <span className='rounded-full border border-border px-2 py-1 text-muted-foreground text-xs'>
          {snapshot ? 'Política activa' : 'Sin política: giros bloqueados'}
        </span>
      </div>
      {snapshot ? (
        <dl className='mt-3 grid grid-cols-2 gap-2 text-sm'>
          <Metric label='Efectivo conciliado' value={snapshot.cash} />
          <Metric label='Cobertura devoluciones' value={snapshot.refunds} />
          <Metric label='Disputas' value={snapshot.disputes} />
          <Metric label='Giros reservados' value={snapshot.pendingPayouts} />
          <Metric label='Reserva operativa' value={snapshot.minimumReserve} />
          <Metric label='Disponible para giro' value={snapshot.available} />
        </dl>
      ) : null}
      <div className='mt-4 border-border border-t pt-4'>
        <ActionForm
          action={configureTreasuryPolicyAction}
          title='Reemplazar política de reserva'
          description='Crea una nueva versión; no edita la anterior.'
        >
          <OperationKey prefix={`treasury-${classification}`} />
          <input type='hidden' name='fundingClassification' value={classification} />
          <TextInput
            name='minimumReservePesos'
            placeholder='Reserva mínima en pesos'
            type='number'
          />
        </ActionForm>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className='text-muted-foreground'>{label}</dt>
      <dd
        className={value < 0 ? 'font-display font-bold text-destructive' : 'font-display font-bold'}
      >
        {formatCOP(value)}
      </dd>
    </div>
  )
}

export function FinanceOperationsPanel({ data }: { data: FinanceOperationsView }) {
  return (
    <section className='flex flex-col gap-6 border-border border-t pt-8'>
      <div>
        <h2 className='font-display text-label-lg uppercase'>Finanzas verificadas V2</h2>
        <p className='mt-1 max-w-prose text-body-md text-muted-foreground'>
          Preparar reserva fondos; confirmar exige referencia y evidencia revisada. Un resultado
          incierto conserva la reserva y nunca autoriza un segundo giro.
        </p>
      </div>

      <div className='grid gap-4 lg:grid-cols-2'>
        <TreasuryCard classification='real' snapshot={data.treasury.real} />
        <TreasuryCard classification='sandbox' snapshot={data.treasury.sandbox} />
      </div>

      <details className='rounded-xl border border-border p-4'>
        <summary className='cursor-pointer font-display font-bold text-lg'>
          Beneficiarios y bancos
        </summary>
        <div className='mt-4 grid gap-4 lg:grid-cols-2'>
          <ActionForm action={registerBeneficiaryAction} title='Registrar beneficiario legal'>
            <select className={field} name='kind' required defaultValue='venue'>
              <option value='venue'>Sitio</option>
              <option value='foundation'>Fundación</option>
            </select>
            <TextInput
              name='venueId'
              placeholder='ID del sitio (vacío para fundación)'
              required={false}
            />
            <TextInput name='legalName' placeholder='Razón social o nombre legal' />
            <TextInput name='legalIdentifierHash' placeholder='SHA-256 de identificación legal' />
          </ActionForm>
          <ActionForm action={verifyBeneficiaryAction} title='Verificar beneficiario'>
            <TextInput name='beneficiaryId' placeholder='ID del beneficiario' />
            <TextInput name='agreementEvidenceId' placeholder='ID del acuerdo revisado' />
          </ActionForm>
          <ActionForm action={addBeneficiaryBankVersionAction} title='Agregar destino bancario'>
            <TextInput name='beneficiaryId' placeholder='ID del beneficiario verificado' />
            <TextInput name='destinationFingerprint' placeholder='SHA-256 del destino' />
            <TextInput
              name='encryptedDetailsStorageKey'
              placeholder='Llave privada de datos bancarios cifrados'
            />
          </ActionForm>
          <ActionForm
            action={verifyBeneficiaryBankVersionAction}
            title='Verificar destino bancario'
          >
            <TextInput name='bankVersionId' placeholder='ID de versión bancaria' />
            <TextInput name='evidenceId' placeholder='ID de evidencia revisada' />
            <TextInput name='verificationMethod' placeholder='Método de verificación' />
            <TextInput name='verificationReference' placeholder='Referencia de verificación' />
          </ActionForm>
        </div>
        <ul className='mt-4 grid gap-2'>
          {data.beneficiaries.map((beneficiary) => (
            <li
              key={`${beneficiary.id}:${beneficiary.bankVersionId ?? 'none'}`}
              className='rounded-lg bg-muted/30 p-3 text-sm'
            >
              <strong>{beneficiary.legalName}</strong> · {beneficiary.kind} · {beneficiary.status}
              <div className='break-all text-muted-foreground'>
                {beneficiary.id}
                {beneficiary.venueName ? ` · ${beneficiary.venueName}` : ''}
                {beneficiary.bankVersionId
                  ? ` · banco v${beneficiary.bankVersion} ${beneficiary.bankStatus}: ${beneficiary.bankVersionId}`
                  : ' · sin banco'}
              </div>
            </li>
          ))}
        </ul>
      </details>

      <details className='rounded-xl border border-border p-4' open>
        <summary className='cursor-pointer font-display font-bold text-lg'>
          Conciliar cobros
        </summary>
        <div className='mt-4 grid gap-4 lg:grid-cols-2'>
          <ActionForm
            action={reconcileChargeAction}
            title='Guardar reporte de deducciones'
            description='Una línea por concepto: clave,tipo,monto,finalidad,evidencia. Las líneas finales o reversadas exigen evidencia revisada; deja vacío si no hubo deducciones.'
          >
            <OperationKey prefix='reconcile-charge' />
            <TextInput name='chargeId' placeholder='ID del cobro aprobado' />
            <textarea
              className={field}
              name='deductions'
              placeholder='fee-2026,gateway_fee,1250.75,final,fev_…'
            />
          </ActionForm>
          <ul className='grid content-start gap-2'>
            {data.charges.map((charge) => (
              <li key={charge.id} className='rounded-lg bg-muted/30 p-3 text-sm'>
                <strong>{charge.venueName}</strong> · {formatCOP(charge.gross)} ·{' '}
                {charge.fundingClassification}
                <div className='break-all text-muted-foreground'>
                  {charge.id} · pedido {charge.orderId} ·{' '}
                  {charge.allocationRevision
                    ? `conciliación v${charge.allocationRevision}`
                    : 'sin conciliar'}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </details>

      <details className='rounded-xl border border-border p-4'>
        <summary className='cursor-pointer font-display font-bold text-lg'>
          Disputas de cobros
        </summary>
        <p className='mt-2 text-muted-foreground text-sm'>
          Abrir una disputa reserva el valor bruto completo y bloquea nuevas fuentes del cobro. Una
          pérdida verificada consume caja operativa; una disputa ganada restaura el cobro.
        </p>
        <div className='mt-4 grid gap-4 lg:grid-cols-2'>
          <ActionForm
            action={openChargeDisputeAction}
            title='Abrir disputa verificada'
            description='La evidencia debe estar revisada, pertenecer al payment_charge y usar el tipo provider_dispute_notice.'
          >
            <OperationKey prefix='charge-dispute-open' />
            <TextInput name='chargeId' placeholder='ID del cobro' />
            <TextInput
              name='providerCaseReference'
              placeholder='Referencia del caso del proveedor'
            />
            <TextInput name='evidenceId' placeholder='ID del aviso revisado' />
            <textarea
              className={field}
              name='reason'
              placeholder='Motivo informado por el proveedor'
            />
          </ActionForm>
          <ActionForm
            action={resolveChargeDisputeAction}
            title='Resolver disputa'
            description='La evidencia debe pertenecer al charge_dispute y usar provider_dispute_resolution.'
          >
            <OperationKey prefix='charge-dispute-resolve' />
            <TextInput name='disputeId' placeholder='ID de la disputa' />
            <select className={field} name='outcome' defaultValue='won'>
              <option value='won'>Ganada</option>
              <option value='lost'>Perdida</option>
            </select>
            <TextInput name='resolutionReference' placeholder='Referencia de resolución' />
            <TextInput name='evidenceId' placeholder='ID de resolución revisada' />
            <textarea className={field} name='detail' placeholder='Resultado verificable' />
          </ActionForm>
        </div>
        <ul className='mt-4 grid gap-2'>
          {data.disputes.map((dispute) => (
            <li key={dispute.id} className='rounded-lg bg-muted/30 p-3 text-sm'>
              <strong>{dispute.venueName}</strong> · {formatCOP(dispute.gross)} · {dispute.status}
              <div className='break-all text-muted-foreground'>
                {dispute.id} · cobro {dispute.chargeId} · caso {dispute.providerCaseReference}
              </div>
              <p>{dispute.reason}</p>
              <p className='text-muted-foreground'>
                Abierta {formatDate(new Date(dispute.openedAt))}
                {dispute.resolvedAt
                  ? ` · resuelta ${formatDate(new Date(dispute.resolvedAt))}`
                  : ''}
              </p>
            </li>
          ))}
        </ul>
      </details>

      <details className='rounded-xl border border-border p-4' open>
        <summary className='cursor-pointer font-display font-bold text-lg'>
          Recuperación de pagos
        </summary>
        <p className='mt-2 text-muted-foreground text-sm'>
          La tarea diaria consulta intentos estancados en lotes acotados, vence reservas y corre
          controles de integridad. También puedes recuperar una referencia puntual.
        </p>
        <div className='mt-4 grid gap-4 lg:grid-cols-2'>
          <ActionForm action={reconcilePaymentAttemptAction} title='Recuperar intento puntual'>
            <TextInput name='attemptId' placeholder='ID del intento' />
            <TextInput name='reference' placeholder='Referencia exacta de ePayco' />
          </ActionForm>
          <ActionForm
            action={runCommerceRecoveryAction}
            title='Ejecutar recuperación ahora'
            description='Respeta el mismo lease que el cron; dos corridas no se solapan.'
          >
            <p className='text-muted-foreground text-sm'>
              El resultado queda persistido para mostrar antigüedad, errores y continuidad.
            </p>
          </ActionForm>
        </div>
        <div className='mt-4 rounded-lg bg-muted/30 p-3 text-sm'>
          {data.recovery ? (
            <>
              <p>
                Último inicio:{' '}
                {data.recovery.lastStartedAt
                  ? formatDate(new Date(data.recovery.lastStartedAt))
                  : 'nunca'}
                {' · '}último éxito:{' '}
                {data.recovery.lastSucceededAt
                  ? formatDate(new Date(data.recovery.lastSucceededAt))
                  : 'ninguno'}
              </p>
              {data.recovery.lastError ? (
                <p className='mt-1 whitespace-pre-wrap text-destructive'>
                  {data.recovery.lastError}
                </p>
              ) : null}
            </>
          ) : (
            'El cron todavía no ha corrido.'
          )}
        </div>
        <ul className='mt-4 grid gap-2'>
          {data.recoveryAttempts.map((attempt) => (
            <li key={attempt.id} className='rounded-lg bg-muted/30 p-3 text-sm'>
              <strong>{attempt.status}</strong> · {attempt.provider} ·{' '}
              {attempt.reference ?? 'sin referencia: revisión operativa'}
              <div className='break-all text-muted-foreground'>
                {attempt.id} · creado {formatDate(new Date(attempt.createdAt))}
                {attempt.lastCheckedAt
                  ? ` · revisado ${formatDate(new Date(attempt.lastCheckedAt))}`
                  : ''}
              </div>
              {attempt.outcomeDetail ? <p>{attempt.outcomeDetail}</p> : null}
            </li>
          ))}
        </ul>
      </details>

      <details className='rounded-xl border border-border p-4'>
        <summary className='cursor-pointer font-display font-bold text-lg'>
          Evidencia privada y pública
        </summary>
        <p className='mt-2 text-muted-foreground text-sm'>
          Originales y redacciones viven en buckets y rutas distintas. La revisión habilita una
          redacción pública, pero no la publica por sí sola.
        </p>
        <div className='mt-4 grid gap-4 lg:grid-cols-2'>
          <EvidenceUploadForm mode='private' />
          <EvidenceUploadForm mode='public' />
          <ActionForm action={reviewFinanceEvidenceAction} title='Marcar evidencia revisada'>
            <TextInput name='evidenceId' placeholder='ID de evidencia' />
          </ActionForm>
          <ActionForm
            action={withdrawPublicEvidenceAction}
            title='Retirar publicación'
            description='La URL deja de aparecer en consultas públicas; el original y la auditoría permanecen.'
          >
            <TextInput name='evidenceId' placeholder='ID de evidencia publicada' />
            <TextInput name='reason' placeholder='Motivo del retiro' />
          </ActionForm>
          <ActionForm
            action={probeEvidenceStorageAction}
            title='Probar configuración R2'
            description='Comprueba credenciales, ambos buckets y la base URL pública sin escribir objetos.'
          >
            <p className='text-muted-foreground text-sm'>
              Úsalo después de configurar las variables del entorno del despliegue.
            </p>
          </ActionForm>
        </div>
        <ul className='mt-4 grid gap-2'>
          {data.evidence.map((item) => (
            <li key={item.id} className='rounded-lg bg-muted/30 p-3 text-sm'>
              <strong>{item.kind}</strong> · {item.status}
              <div className='break-all text-muted-foreground'>
                {item.id} · {item.ownerType}:{item.ownerId} · SHA {item.sha256.slice(0, 12)}…
              </div>
              <PrivateEvidenceButton evidenceId={item.id} />
            </li>
          ))}
        </ul>
      </details>

      <details className='rounded-xl border border-border p-4' open>
        <summary className='cursor-pointer font-display font-bold text-lg'>
          Compras de la fundación
        </summary>
        <p className='mt-2 text-muted-foreground text-sm'>
          Registrar no publica. Después carga y revisa el recibo con dueño{' '}
          <code>foundation_purchase</code>, verifica la compra, atribuye giros confirmados y publica
          únicamente la redacción.
        </p>
        <div className='mt-4 grid gap-4 lg:grid-cols-2'>
          <ActionForm
            action={recordFoundationPurchaseAction}
            title='Registrar compra'
            description='Los subtotales deben ser exactamente iguales al total. Una corrección crea otra compra y conserva la anterior.'
          >
            <OperationKey prefix='foundation-purchase' />
            <TextInput name='beneficiaryId' placeholder='ID de fundación verificada' />
            <TextInput name='amountPesos' placeholder='Total en pesos' type='number' />
            <TextInput
              name='correctionOfId'
              placeholder='ID de compra corregida (opcional)'
              required={false}
            />
            <TextInput name='slug' placeholder='URL: compra-de-cemento' />
            <TextInput name='title' placeholder='Título público' />
            <TextInput name='summary' placeholder='Resumen público (opcional)' required={false} />
            <textarea className={field} name='story' placeholder='Historia pública (opcional)' />
            <TextInput name='municipality' placeholder='Municipio' />
            <TextInput name='department' placeholder='Departamento' />
            <TextInput
              name='beneficiaryLabel'
              placeholder='Etiqueta no identificable (opcional)'
              required={false}
            />
            <TextInput
              name='householdsHelped'
              placeholder='Hogares ayudados (opcional)'
              type='number'
              required={false}
            />
            <TextInput name='supplierName' placeholder='Proveedor (opcional)' required={false} />
            <TextInput
              name='receiptNumber'
              placeholder='Número de recibo (opcional)'
              required={false}
            />
            <TextInput name='purchasedAt' placeholder='Fecha de compra' type='date' />
            <textarea
              className={field}
              name='items'
              placeholder={'Material,2,bulto,35000,70000\nArena,1,m3,,50000'}
              required
            />
          </ActionForm>
          <div className='grid gap-4'>
            <ActionForm action={verifyFoundationPurchaseAction} title='Verificar compra y recibo'>
              <TextInput name='purchaseId' placeholder='ID de compra' />
              <TextInput name='receiptEvidenceId' placeholder='ID de recibo revisado' />
            </ActionForm>
            <ActionForm
              action={allocateFoundationPurchaseAction}
              title='Atribuir fuentes confirmadas'
              description='Cada línea: ID de asignación del giro,monto en pesos.'
            >
              <TextInput name='purchaseId' placeholder='ID de compra verificada' />
              <textarea
                className={field}
                name='allocations'
                placeholder={'foa_…,50000\nfoa_…,25000'}
                required
              />
            </ActionForm>
            <ActionForm action={publishFoundationPurchaseAction} title='Publicar compra'>
              <TextInput name='purchaseId' placeholder='ID de compra verificada' />
            </ActionForm>
            <ActionForm action={rejectFoundationPurchaseAction} title='Rechazar o retirar compra'>
              <TextInput name='purchaseId' placeholder='ID de compra' />
              <TextInput name='reason' placeholder='Motivo verificable' />
            </ActionForm>
          </div>
        </div>

        <h3 className='mt-6 font-display font-bold text-base'>Compras registradas</h3>
        <ul className='mt-3 grid gap-2'>
          {data.purchases.map((purchase) => (
            <li key={purchase.id} className='rounded-lg bg-muted/30 p-3 text-sm'>
              <strong>{purchase.title}</strong> · {formatCOP(purchase.amount)} · {purchase.status} ·{' '}
              {purchase.publicStatus}
              <div className='break-all text-muted-foreground'>
                {purchase.id} · fundación {purchase.beneficiaryId} · recibo{' '}
                {purchase.receiptEvidenceId ?? 'pendiente'}
              </div>
            </li>
          ))}
        </ul>

        <h3 className='mt-6 font-display font-bold text-base'>Giros disponibles para atribuir</h3>
        <ul className='mt-3 grid gap-2'>
          {data.purchaseFundingSources.map((source) => (
            <li key={source.id} className='rounded-lg bg-muted/30 p-3 text-sm'>
              <strong>{source.beneficiaryName}</strong> · disponible {formatCOP(source.available)}{' '}
              de {formatCOP(source.amount)}
              <div className='break-all text-muted-foreground'>
                {source.id} · {source.externalReference ?? 'sin referencia'}
              </div>
            </li>
          ))}
        </ul>
      </details>

      <div className='grid gap-4 lg:grid-cols-2'>
        <ActionForm
          action={reserveRefundAction}
          title='Reservar devolución'
          description='Solo unidades app no reclamadas. La huella debe pertenecer al pagador original.'
        >
          <OperationKey prefix='refund-admin' />
          <TextInput name='orderId' placeholder='ID del pedido' />
          <textarea
            className={field}
            name='unitIds'
            placeholder='IDs de unidades, separados por coma'
            required
          />
          <TextInput
            name='destinationFingerprint'
            placeholder='SHA-256 del destino original verificado'
          />
        </ActionForm>
        <ActionForm
          action={preparePayoutAction}
          title='Preparar giro'
          description='Cada línea: ID de asignación,monto en pesos.'
        >
          <OperationKey prefix='payout-admin' />
          <select className={field} name='kind' defaultValue='venue_payout'>
            <option value='venue_payout'>Giro a sitio</option>
            <option value='foundation_payout'>Giro a fundación</option>
          </select>
          <select className={field} name='fundingClassification' defaultValue='real'>
            <option value='real'>Real</option>
            <option value='sandbox'>Sandbox</option>
          </select>
          <TextInput
            name='beneficiaryBankVersionId'
            placeholder='ID de versión bancaria verificada'
          />
          <textarea
            className={field}
            name='sources'
            placeholder={'ual_…,25000\nual_…,12000'}
            required
          />
        </ActionForm>
      </div>

      <details className='rounded-xl border border-border p-4'>
        <summary className='cursor-pointer font-display font-bold text-lg'>
          Fuentes elegibles de giro
        </summary>
        <ul className='mt-3 grid gap-2'>
          {data.payoutSources.map((source) => (
            <li key={source.id} className='rounded-lg bg-muted/30 p-3 text-sm'>
              <strong>{source.venueName}</strong> · {source.fundingClassification}
              <div className='break-all text-muted-foreground'>{source.id}</div>
              <div>
                Sitio: {formatCOP(source.venueAvailable)} · Fundación:{' '}
                {formatCOP(source.foundationAvailable)}
              </div>
            </li>
          ))}
        </ul>
      </details>

      <ActionForm
        action={transitionFinancialOperationAction}
        title='Registrar resultado externo'
        description='No confirmes con captura de pantalla: exige registro bancario real y evidencia revisada.'
      >
        <select className={field} name='operationType' defaultValue='payout'>
          <option value='payout'>Giro</option>
          <option value='refund'>Devolución</option>
        </select>
        <select className={field} name='transition' defaultValue='submitted_unknown'>
          <option value='submitted_unknown'>Enviado, resultado incierto</option>
          <option value='confirm'>Confirmado por banco/proveedor</option>
          <option value='fail'>Fallo verificado</option>
          <option value='reverse'>Reversión verificada (solo giro)</option>
        </select>
        <TextInput name='operationId' placeholder='ID de operación' />
        <input className={field} name='operationKey' placeholder='Clave durable (solo reversión)' />
        <input
          className={field}
          name='externalReference'
          placeholder='Referencia bancaria/proveedor'
        />
        <input className={field} name='evidenceId' placeholder='ID de evidencia revisada' />
        <input
          className={field}
          name='destinationFingerprint'
          placeholder='SHA-256 del destino congelado'
        />
        <textarea
          className={field}
          name='detail'
          placeholder='Detalle de resultado incierto o fallo'
        />
      </ActionForm>

      <div>
        <h3 className='font-display font-bold text-lg'>Operaciones recientes</h3>
        <ul className='mt-3 grid gap-2'>
          {data.operations.map((operation) => (
            <li key={operation.id} className='rounded-lg border border-border bg-card p-3 text-sm'>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <strong>{operation.kind}</strong>
                <span>{formatCOP(operation.amount)}</span>
              </div>
              <div className='break-all text-muted-foreground'>
                {operation.id} · {operation.status} ·{' '}
                {operation.fundingClassification ?? 'sin clasificar'}
              </div>
              {operation.statusDetail ? <p className='mt-1'>{operation.statusDetail}</p> : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
