/**
 * Test accounts for checking permissions by hand.
 *
 *   bun run seed:cuentas
 *
 * WHY IT EXISTS. The one thing this product cannot afford is staff from venue A
 * touching anything of venue B, and TypeScript does not catch that, `bun lint`
 * does not catch it, and it works perfectly with the right session. It only
 * shows up when you test with the WRONG session — which is exactly what nobody
 * does out of habit, because setting up the second session is a chore.
 *
 * This removes the chore: verified accounts owning DIFFERENT venues, with a
 * known password, so the awkward test costs the same as the comfortable one.
 *
 * It only writes when the account is missing, so it can be run repeatedly.
 * NEVER run against production: it creates users with a published password.
 */
import { eq } from 'drizzle-orm'

import { db } from '@/database'
import { user, venue, venueMember } from '@/database/schema'
import { auth } from '@/lib/auth/auth'

const PASSWORD = 'Prueba-2026-tumbenla'

if (process.env.NODE_ENV === 'production') {
  throw new Error('This script does not run in production.')
}

const venues = await db
  .select({ id: venue.id, slug: venue.slug, name: venue.name })
  .from(venue)
  .orderBy(venue.slug)
  .limit(2)

if (venues.length < 2) {
  throw new Error('Need at least two venues. Run: bun scripts/seed-tumbenla.ts')
}

/**
 * The operator has NO venue membership on purpose. Platform power comes from
 * ADMIN_EMAILS (decision 17), not from a row, and keeping the two apart is what
 * lets us check that an operator can review and settle without belonging to any
 * venue.
 */
const accounts = [
  { email: 'duenoa@prueba.local', name: 'Dueño A', venue: venues[0], role: 'owner' as const },
  { email: 'duenob@prueba.local', name: 'Dueño B', venue: venues[1], role: 'owner' as const },
  { email: 'mesero@prueba.local', name: 'Mesero A', venue: venues[0], role: 'staff' as const },
  { email: 'operador@prueba.local', name: 'Operación', venue: null, role: null },
]

for (const account of accounts) {
  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, account.email))
    .limit(1)

  let userId = existing?.id

  if (!userId) {
    await auth.api.signUpEmail({
      body: { email: account.email, password: PASSWORD, name: account.name },
    })
    const [created] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, account.email))
      .limit(1)
    userId = created?.id
  }

  if (!userId) throw new Error(`Could not create ${account.email}`)

  // Forced verified: the verification email goes nowhere useful locally, and
  // both assertVenueAccess and assertAdmin require emailVerified.
  await db.update(user).set({ emailVerified: true }).where(eq(user.id, userId))

  if (account.venue && account.role) {
    await db
      .insert(venueMember)
      .values({ venueId: account.venue.id, userId, role: account.role })
      .onConflictDoNothing()
    console.log(`  ${account.email.padEnd(22)} → ${account.venue.slug} (${account.role})`)
  } else {
    console.log(`  ${account.email.padEnd(22)} → operador (necesita estar en ADMIN_EMAILS)`)
  }
}

console.log(`\n  contraseña de todas: ${PASSWORD}`)
console.log('\n  Para que el operador entre, el servidor tiene que arrancar con:')
console.log('    ADMIN_EMAILS=operador@prueba.local bun dev\n')

process.exit(0)
