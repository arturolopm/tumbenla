/**
 * Cuentas de prueba para verificar permisos a mano.
 *
 *   bun run seed:cuentas
 *
 * POR QUE EXISTE. Lo unico que este producto no puede permitirse es que el
 * personal del bar A toque algo del bar B, y eso NO lo atrapa TypeScript, no lo
 * atrapa `bun lint`, y funciona perfecto con la sesion correcta. Solo se ve
 * probandolo con la sesion EQUIVOCADA, que es justo lo que nadie hace por
 * costumbre porque montar la segunda sesion cuesta.
 *
 * Esto la monta: tres cuentas verificadas, duenas de sitios DISTINTOS, con
 * contrasena conocida. Asi la prueba incomoda cuesta lo mismo que la comoda.
 *
 * Solo escribe si la cuenta no existe, asi que se puede correr muchas veces.
 * NUNCA correr contra produccion: crea usuarios con contrasena publicada.
 */
import { eq } from 'drizzle-orm'

import { db } from '@/database'
import { user, venue, venueMember } from '@/database/schema'
import { auth } from '@/lib/auth/auth'

const CLAVE = 'Prueba-2026-tumbenla'

if (process.env.NODE_ENV === 'production') {
  throw new Error('Este script no corre en produccion.')
}

const sitios = await db
  .select({ id: venue.id, slug: venue.slug, name: venue.name })
  .from(venue)
  .orderBy(venue.slug)
  .limit(2)

if (sitios.length < 2) {
  throw new Error('Hacen falta al menos dos sitios. Corre: bun scripts/seed-tumbenla.ts')
}

const cuentas = [
  { email: 'duenoa@prueba.local', name: 'Dueño A', sitio: sitios[0], role: 'owner' as const },
  { email: 'duenob@prueba.local', name: 'Dueño B', sitio: sitios[1], role: 'owner' as const },
  { email: 'mesero@prueba.local', name: 'Mesero A', sitio: sitios[0], role: 'staff' as const },
]

for (const cuenta of cuentas) {
  const [existente] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, cuenta.email))
    .limit(1)

  let userId = existente?.id

  if (!userId) {
    await auth.api.signUpEmail({
      body: { email: cuenta.email, password: CLAVE, name: cuenta.name },
    })
    const [creado] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, cuenta.email))
      .limit(1)
    userId = creado?.id
  }

  if (!userId) throw new Error(`No se pudo crear ${cuenta.email}`)

  // Verificado a la fuerza: el correo de verificacion no llega a ninguna parte
  // en local, y assertVenueAccess exige emailVerified.
  await db.update(user).set({ emailVerified: true }).where(eq(user.id, userId))

  await db
    .insert(venueMember)
    .values({ venueId: cuenta.sitio.id, userId, role: cuenta.role })
    .onConflictDoNothing()

  console.log(`  ${cuenta.email}  →  ${cuenta.sitio.slug} (${cuenta.role})`)
}

console.log(`\n  contraseña de todas: ${CLAVE}`)
console.log('\n  Para una sesion en curl:')
console.log(`    curl -s -c galletas.txt -X POST localhost:3000/api/auth/sign-in/email \\`)
console.log(`      -H 'content-type: application/json' \\`)
console.log(`      -d '{"email":"duenoa@prueba.local","password":"${CLAVE}"}'`)
console.log('    curl -s -b galletas.txt localhost:3000/panel/<slug>/carta\n')

process.exit(0)
