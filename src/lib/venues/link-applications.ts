import 'server-only'

import { and, eq, isNotNull, isNull, ne, or, sql } from 'drizzle-orm'

import { db } from '@/database'
import { venueApplication, venueMember } from '@/database/schema'

/**
 * Links guest venue applications to the account that proves control of their
 * contact email.
 *
 * Open applications become visible to that account. Approved applications with
 * no owner also create the one owner membership, without an invitation or a
 * second acceptance step.
 *
 * `emailVerified` is essential: a public form can name any email address, so a
 * session alone must never claim a venue. A legacy userId is also not trusted;
 * the matching, verified account wins when it enters.
 *
 * It is deliberately separate from guest-order linking. The rule is shared,
 * but a venue application can grant authority and deserves its own reviewable
 * code path. All writes are idempotent and run from /entrar on every login.
 */
export const linkGuestVenueApplications = async (account: {
  id: string
  email: string
  emailVerified: boolean
}): Promise<number> => {
  if (!account.emailVerified) return 0

  const email = account.email.trim().toLowerCase()
  if (!email) return 0

  return db.transaction(async (tx) => {
    const needsLink = or(isNull(venueApplication.userId), ne(venueApplication.userId, account.id))

    const openApplications = await tx
      .update(venueApplication)
      .set({ userId: account.id, updatedAt: new Date() })
      .where(
        and(
          sql`lower(${venueApplication.contactEmail}) = ${email}`,
          needsLink,
          sql`${venueApplication.status} in ('pending', 'verifying')`
        )
      )
      .returning({ id: venueApplication.id })

    const approvedApplications = await tx
      .select({ id: venueApplication.id, venueId: venueApplication.venueId })
      .from(venueApplication)
      .where(
        and(
          sql`lower(${venueApplication.contactEmail}) = ${email}`,
          eq(venueApplication.status, 'approved'),
          isNotNull(venueApplication.venueId)
        )
      )

    let linked = openApplications.length

    for (const application of approvedApplications) {
      if (!application.venueId) continue

      const [owner] = await tx
        .select({ userId: venueMember.userId })
        .from(venueMember)
        .where(and(eq(venueMember.venueId, application.venueId), eq(venueMember.role, 'owner')))
        .limit(1)

      if (owner && owner.userId !== account.id) continue

      const linkedApplication = await tx
        .update(venueApplication)
        .set({ userId: account.id, updatedAt: new Date() })
        .where(and(eq(venueApplication.id, application.id), needsLink))
        .returning({ id: venueApplication.id })

      if (owner) {
        linked += linkedApplication.length
        continue
      }

      await tx
        .insert(venueMember)
        .values({ venueId: application.venueId, userId: account.id, role: 'owner' })
        .onConflictDoUpdate({
          target: [venueMember.venueId, venueMember.userId],
          set: { role: 'owner', updatedAt: new Date() },
        })

      // The membership transition is the observable work when an application
      // was already linked but had not yet received an owner.
      linked += Math.max(linkedApplication.length, 1)
    }

    return linked
  })
}
