import { eq } from 'drizzle-orm'

import { db } from '@/database'
import { user } from '@/database/schema'

export type ClearUnverifiedUserResult = 'deleted' | 'verified_exists' | 'not_found'

/**
 * Removes an unverified user so signup can be retried after a failed OTP flow.
 * Sessions and credential accounts cascade from the user row.
 */
export async function clearUnverifiedUserByEmail(
  email: string
): Promise<ClearUnverifiedUserResult> {
  const normalizedEmail = email.trim().toLowerCase()

  const [existing] = await db
    .select({ id: user.id, emailVerified: user.emailVerified })
    .from(user)
    .where(eq(user.email, normalizedEmail))
    .limit(1)

  if (!existing) {
    return 'not_found'
  }

  if (existing.emailVerified) {
    return 'verified_exists'
  }

  await db.delete(user).where(eq(user.id, existing.id))

  return 'deleted'
}
