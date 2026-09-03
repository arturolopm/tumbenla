/**
 * El amarre de una solicitud de alta hecha SIN cuenta.
 *
 *   bun run prueba:alta
 *
 * POR QUE EXISTE. Desde la decision 35 una solicitud nace sin dueno y se amarra
 * cuando esa persona entra con el correo verificado. Las dos condiciones que lo
 * hacen seguro —correo VERIFICADO, y que sea el MISMO correo— no las atrapa
 * TypeScript ni el linter, y con la sesion correcta todo funciona igual de bien
 * con o sin ellas. Solo se ven probando el caso equivocado, que es justo el que
 * nadie prueba por costumbre.
 *
 * Sin la segunda condicion, cualquiera se registra con el correo de un bar
 * ajeno y se queda con su solicitud — y por esa via, con el sitio.
 *
 * NUNCA contra produccion: escribe y borra filas.
 */
import { eq } from 'drizzle-orm'
import { db } from '@/database'
import { user, venueApplication } from '@/database/schema'
import { vincularSolicitudesDeInvitado } from '@/lib/venues/vincular'
import { createId, ID_PREFIX } from '@/lib/utils/id'

const CORREO = 'dueno-invitado@prueba.local'
const OTRO = 'otra-persona@prueba.local'

await db.delete(venueApplication).where(eq(venueApplication.contactEmail, CORREO))

const [app] = await db
  .insert(venueApplication)
  .values({
    id: createId(ID_PREFIX.venueApplication),
    userId: null,
    name: 'Bar Sin Cuenta',
    instagram: `barsincuenta${Date.now()}`,
    contactEmail: CORREO,
    whatsapp: '3001112233',
    publicToken: `tok${Date.now()}`,
  })
  .returning({ id: venueApplication.id, userId: venueApplication.userId })

console.log('1. solicitud creada sin dueno:', app.userId === null ? 'OK (userId null)' : 'FALLA')

const [u] = await db
  .select({ id: user.id })
  .from(user)
  .where(eq(user.email, 'duenoa@prueba.local'))
  .limit(1)

// a) correo distinto -> no amarra
const n1 = await vincularSolicitudesDeInvitado({ id: u.id, email: OTRO, emailVerified: true })
console.log('2. correo distinto:', n1 === 0 ? 'OK (no amarra)' : `FALLA (amarro ${n1})`)

// b) correo correcto pero SIN verificar -> no amarra
const n2 = await vincularSolicitudesDeInvitado({ id: u.id, email: CORREO, emailVerified: false })
console.log('3. sin verificar:', n2 === 0 ? 'OK (no amarra)' : `FALLA (amarro ${n2})`)

// c) correo correcto y verificado -> amarra
const n3 = await vincularSolicitudesDeInvitado({ id: u.id, email: CORREO, emailVerified: true })
console.log('4. verificado y correcto:', n3 === 1 ? 'OK (amarro 1)' : `FALLA (amarro ${n3})`)

// d) idempotente
const n4 = await vincularSolicitudesDeInvitado({ id: u.id, email: CORREO, emailVerified: true })
console.log('5. segunda pasada:', n4 === 0 ? 'OK (idempotente)' : `FALLA (amarro ${n4})`)

const [final] = await db
  .select({ userId: venueApplication.userId })
  .from(venueApplication)
  .where(eq(venueApplication.id, app.id))
console.log('6. dueno final:', final.userId === u.id ? 'OK' : 'FALLA')

await db.delete(venueApplication).where(eq(venueApplication.id, app.id))
process.exit(0)
