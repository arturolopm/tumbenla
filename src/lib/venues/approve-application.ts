import 'server-only'

import { and, eq, sql } from 'drizzle-orm'

import { db } from '@/database'
import { user, venueApplication, venueMember } from '@/database/schema'
import { createVenue, updateVenue } from '@/lib/venues/mutations'
import type { VenueInput } from '@/lib/venues/schemas'
import type { VenueAdminRow } from '@/lib/venues/types'

export class VenueApplicationApprovalError extends Error {}

type ApprovalResult = {
  venue: VenueAdminRow
  contactEmail: string
  ownerIsReady: boolean
}

/**
 * Creates or updates the venue, resolves the application, and grants ownership
 * only when an account has verified the exact contact email.
 *
 * The three writes share one transaction so an approved application can never
 * point to a missing venue, nor can a venue be created with a half-applied
 * approval. A missing or untrusted account is a valid result: ownership is
 * claimed later from /entrar after that contact email is verified.
 */
export const approveVenueApplication = async (params: {
  applicationId: string
  adminUserId: string
  input: VenueInput
}): Promise<ApprovalResult> =>
  db.transaction(async (tx) => {
    const [application] = await tx
      .select({
        id: venueApplication.id,
        status: venueApplication.status,
        userId: venueApplication.userId,
        venueId: venueApplication.venueId,
        contactEmail: venueApplication.contactEmail,
      })
      .from(venueApplication)
      .where(eq(venueApplication.id, params.applicationId))
      .limit(1)

    if (!application) {
      throw new VenueApplicationApprovalError('Esa solicitud ya no existe.')
    }
    if (application.status === 'approved') {
      throw new VenueApplicationApprovalError('Esa solicitud ya estaba aprobada.')
    }
    if (application.status === 'rejected') {
      throw new VenueApplicationApprovalError('Esa solicitud ya estaba rechazada.')
    }

    const [verifiedAccount] = await tx
      .select({ id: user.id })
      .from(user)
      .where(
        and(
          sql`lower(${user.email}) = ${application.contactEmail.trim().toLowerCase()}`,
          eq(user.emailVerified, true)
        )
      )
      .limit(1)

    if (application.venueId) {
      const [owner] = await tx
        .select({ id: venueMember.id })
        .from(venueMember)
        .where(and(eq(venueMember.venueId, application.venueId), eq(venueMember.role, 'owner')))
        .limit(1)

      if (owner) {
        throw new VenueApplicationApprovalError('Ese sitio ya tiene dueño.')
      }
    }

    const venue = application.venueId
      ? await updateVenue(application.venueId, params.input, tx)
      : await createVenue(params.input, tx)

    // A pre-existing application userId is only a hint. The verified account
    // lookup by contact email is the authority boundary, including for an
    // anonymous application submitted before that account existed.
    const ownerId = verifiedAccount?.id ?? null

    if (ownerId) {
      await tx
        .insert(venueMember)
        .values({
          venueId: venue.id,
          userId: ownerId,
          role: 'owner',
          invitedByUserId: params.adminUserId,
        })
        .onConflictDoUpdate({
          target: [venueMember.venueId, venueMember.userId],
          set: { role: 'owner', invitedByUserId: params.adminUserId, updatedAt: new Date() },
        })
    }

    const updatedApplication = await tx
      .update(venueApplication)
      .set({
        status: 'approved',
        venueId: venue.id,
        // A historical userId is not proof of ownership. Clearing one that did
        // not match a verified contact email leaves the venue available for its
        // rightful owner to claim at /entrar.
        userId: ownerId,
        reviewedAt: new Date(),
        reviewedByUserId: params.adminUserId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(venueApplication.id, application.id),
          sql`${venueApplication.status} in ('pending', 'verifying')`
        )
      )
      .returning({ id: venueApplication.id })

    if (updatedApplication.length === 0) {
      // A concurrent operator resolved the application after our read. Throwing
      // rolls back the venue and membership writes from this transaction.
      throw new VenueApplicationApprovalError('Esa solicitud ya fue resuelta por otra persona.')
    }

    return { venue, contactEmail: application.contactEmail, ownerIsReady: Boolean(ownerId) }
  })
