'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { db } from '@/database'
import { assertAdmin } from '@/lib/auth/admin'
import { CreditPolicyService } from '@/lib/commerce/credit-policy-service'

export type CreditPolicyState =
  | { status: 'idle' }
  | { status: 'error'; error: string }
  | { status: 'success'; message: string }

const schema = z.object({
  operationKey: z.string().regex(/^[A-Za-z0-9:_-]{8,180}$/),
  venueId: z.string().min(1),
  limitPesos: z.coerce.number().int().min(0).max(1_000_000_000),
  maxActiveReservations: z.coerce.number().int().min(1).max(1_000),
  maxActivePerShopper: z.coerce.number().int().min(1).max(100),
})

export const configureCreditPolicyAction = async (
  _previous: CreditPolicyState,
  formData: FormData
): Promise<CreditPolicyState> => {
  const admin = await assertAdmin()
  if (!admin.ok) return { status: 'error', error: admin.error }
  const parsed = schema.safeParse({
    operationKey: formData.get('operationKey'),
    venueId: formData.get('venueId'),
    limitPesos: formData.get('limitPesos'),
    maxActiveReservations: formData.get('maxActiveReservations'),
    maxActivePerShopper: formData.get('maxActivePerShopper'),
  })
  if (!parsed.success) {
    return { status: 'error', error: parsed.error.issues[0]?.message ?? 'Revisa los límites.' }
  }

  try {
    const result = await new CreditPolicyService({ database: db }).configurePolicy({
      operationKey: parsed.data.operationKey,
      venueId: parsed.data.venueId,
      limitMinor: BigInt(parsed.data.limitPesos) * BigInt(100),
      maxActiveReservations: parsed.data.maxActiveReservations,
      maxActivePerShopper: parsed.data.maxActivePerShopper,
      approvedByUserId: admin.userId,
    })
    revalidatePath('/admin/cuentas')
    return {
      status: 'success',
      message: result.duplicate
        ? 'Ese cambio ya estaba guardado.'
        : `Cupo v${result.version} guardado.`,
    }
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'No se pudo guardar el cupo.',
    }
  }
}
