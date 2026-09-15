/**
 * Regression coverage for approving a venue application without an account and
 * claiming it later through a verified contact email.
 *
 *   bun run prueba:alta
 *
 * Local development only. This writes and removes isolated test rows.
 */
import { eq, inArray } from 'drizzle-orm'

import { db } from '@/database'
import { user, venue, venueApplication, venueMember } from '@/database/schema'
import { approveVenueApplication } from '@/lib/venues/approve-application'
import { generarToken } from '@/lib/venues/invitations'
import { linkGuestVenueApplications } from '@/lib/venues/link-applications'
import type { VenueInput } from '@/lib/venues/schemas'
import { ID_PREFIX, createId } from '@/lib/utils/id'

if (process.env.NODE_ENV === 'production') {
  throw new Error('This script does not run in production.')
}

const runId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
const contactEmail = `owner-${runId}@prueba.local`
const differentEmail = `different-${runId}@prueba.local`
const unmatchedContactEmail = `unmatched-${runId}@prueba.local`
const adminEmail = `admin-${runId}@prueba.local`

const accountIds = {
  owner: `test-owner-${runId}`,
  different: `test-different-${runId}`,
  admin: `test-admin-${runId}`,
}

const applicationIds: string[] = []
const venueIds: string[] = []
let passed = true

const check = (label: string, condition: boolean) => {
  console.log(`${condition ? '✓' : '✗'} ${label}`)
  if (!condition) passed = false
}

const venueInput = (name: string): VenueInput => ({
  name,
  type: 'bar',
  tagline: null,
  description: null,
  addressLine: 'Carrera 23 # 64-11',
  neighborhood: 'El Cable',
  city: 'Manizales',
  department: 'Caldas',
  latitude: 5.0703,
  longitude: -75.5138,
  phone: null,
  whatsapp: '3001112233',
  instagram: null,
  tiktok: null,
  email: null,
  website: null,
  openingHours: null,
  coverImageUrl: null,
  logoUrl: null,
  estimatedPerPersonNight: null,
  verifiedNote: null,
  status: 'draft',
})

try {
  await db.insert(user).values([
    {
      id: accountIds.different,
      name: 'Different email test',
      email: differentEmail,
      emailVerified: true,
    },
    {
      id: accountIds.admin,
      name: 'Admin test',
      email: adminEmail,
      emailVerified: true,
    },
  ])

  const [withoutAccount] = await db
    .insert(venueApplication)
    .values({
      id: createId(ID_PREFIX.venueApplication),
      name: `Bar without account ${runId}`,
      instagram: `withoutaccount${runId.replaceAll('-', '')}`,
      contactEmail,
      whatsapp: '3001112233',
      publicToken: generarToken(),
    })
    .returning({ id: venueApplication.id })
  applicationIds.push(withoutAccount.id)

  const approvedWithoutAccount = await approveVenueApplication({
    applicationId: withoutAccount.id,
    adminUserId: accountIds.admin,
    input: venueInput(`Bar approved without account ${runId}`),
  })
  venueIds.push(approvedWithoutAccount.venue.id)

  const [savedWithoutAccount] = await db
    .select({
      status: venueApplication.status,
      venueId: venueApplication.venueId,
      userId: venueApplication.userId,
      venueStatus: venue.status,
    })
    .from(venueApplication)
    .innerJoin(venue, eq(venueApplication.venueId, venue.id))
    .where(eq(venueApplication.id, withoutAccount.id))
  const membersBeforeClaim = await db
    .select({ id: venueMember.id })
    .from(venueMember)
    .where(eq(venueMember.venueId, approvedWithoutAccount.venue.id))

  check(
    'approval without an account creates an approved, unowned draft venue',
    savedWithoutAccount?.status === 'approved' &&
      savedWithoutAccount.venueId === approvedWithoutAccount.venue.id &&
      savedWithoutAccount.userId === null &&
      savedWithoutAccount.venueStatus === 'draft' &&
      membersBeforeClaim.length === 0
  )
  check('approval reports that the owner is pending', !approvedWithoutAccount.ownerIsReady)

  const differentEmailResult = await linkGuestVenueApplications({
    id: accountIds.different,
    email: differentEmail,
    emailVerified: true,
  })
  check('a different verified email claims nothing', differentEmailResult === 0)

  const unverifiedResult = await linkGuestVenueApplications({
    id: accountIds.owner,
    email: contactEmail,
    emailVerified: false,
  })
  check('the matching but unverified email claims nothing', unverifiedResult === 0)

  await db.insert(user).values({
    id: accountIds.owner,
    name: 'Owner test',
    email: contactEmail,
    emailVerified: true,
  })

  const verifiedResult = await linkGuestVenueApplications({
    id: accountIds.owner,
    email: contactEmail,
    emailVerified: true,
  })
  const secondPass = await linkGuestVenueApplications({
    id: accountIds.owner,
    email: contactEmail,
    emailVerified: true,
  })
  const [claimedApplication] = await db
    .select({ userId: venueApplication.userId })
    .from(venueApplication)
    .where(eq(venueApplication.id, withoutAccount.id))
  const claimedOwners = await db
    .select({ userId: venueMember.userId, role: venueMember.role })
    .from(venueMember)
    .where(eq(venueMember.venueId, approvedWithoutAccount.venue.id))

  check(
    'the matching verified email claims the venue with exactly one owner',
    verifiedResult === 1 &&
      claimedApplication?.userId === accountIds.owner &&
      claimedOwners.length === 1 &&
      claimedOwners[0]?.userId === accountIds.owner &&
      claimedOwners[0]?.role === 'owner'
  )
  check('a second verified claim is idempotent', secondPass === 0)

  const [mismatchedAccount] = await db
    .insert(venueApplication)
    .values({
      id: createId(ID_PREFIX.venueApplication),
      userId: accountIds.different,
      name: `Bar with mismatched account ${runId}`,
      instagram: `mismatchedaccount${runId.replaceAll('-', '')}`,
      contactEmail: unmatchedContactEmail,
      whatsapp: '3001112233',
      publicToken: generarToken(),
    })
    .returning({ id: venueApplication.id })
  applicationIds.push(mismatchedAccount.id)

  const approvedMismatchedAccount = await approveVenueApplication({
    applicationId: mismatchedAccount.id,
    adminUserId: accountIds.admin,
    input: venueInput(`Bar with mismatched account ${runId}`),
  })
  venueIds.push(approvedMismatchedAccount.venue.id)

  const [savedMismatchedAccount] = await db
    .select({ userId: venueApplication.userId })
    .from(venueApplication)
    .where(eq(venueApplication.id, mismatchedAccount.id))
  const mismatchedOwners = await db
    .select({ userId: venueMember.userId })
    .from(venueMember)
    .where(eq(venueMember.venueId, approvedMismatchedAccount.venue.id))

  check(
    'an existing account with another email never receives ownership',
    !approvedMismatchedAccount.ownerIsReady &&
      savedMismatchedAccount?.userId === null &&
      mismatchedOwners.length === 0
  )

  const [matchingAccount] = await db
    .insert(venueApplication)
    .values({
      id: createId(ID_PREFIX.venueApplication),
      userId: accountIds.owner,
      name: `Bar with matching account ${runId}`,
      instagram: `matchingaccount${runId.replaceAll('-', '')}`,
      contactEmail,
      whatsapp: '3001112233',
      publicToken: generarToken(),
    })
    .returning({ id: venueApplication.id })
  applicationIds.push(matchingAccount.id)

  const approvedMatchingAccount = await approveVenueApplication({
    applicationId: matchingAccount.id,
    adminUserId: accountIds.admin,
    input: venueInput(`Bar with matching account ${runId}`),
  })
  venueIds.push(approvedMatchingAccount.venue.id)

  const matchingOwners = await db
    .select({ userId: venueMember.userId, role: venueMember.role })
    .from(venueMember)
    .where(eq(venueMember.venueId, approvedMatchingAccount.venue.id))

  check(
    'a matching verified account receives ownership during approval',
    approvedMatchingAccount.ownerIsReady &&
      matchingOwners.length === 1 &&
      matchingOwners[0]?.userId === accountIds.owner &&
      matchingOwners[0]?.role === 'owner'
  )
} catch (error) {
  passed = false
  console.error(error)
} finally {
  if (applicationIds.length > 0) {
    await db.delete(venueApplication).where(inArray(venueApplication.id, applicationIds))
  }
  if (venueIds.length > 0) {
    await db.delete(venueMember).where(inArray(venueMember.venueId, venueIds))
    await db.delete(venue).where(inArray(venue.id, venueIds))
  }
  await db.delete(user).where(inArray(user.id, Object.values(accountIds)))
}

process.exit(passed ? 0 : 1)
