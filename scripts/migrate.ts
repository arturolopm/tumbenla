import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import process from 'node:process'
import postgres from 'postgres'

config()

/**
 * Aplica las migraciones pendientes.
 *
 * VA POR LA CONEXION DIRECTA, NO POR EL POOLER. El pooler de Neon es PgBouncer
 * en modo transaccion y las migraciones son DDL dentro de una transaccion, que
 * es justo lo que ese modo no sostiene. En local no hay pooler, asi que el
 * fallback a DATABASE_URL deja el flujo de siempre intacto.
 *
 * ESTE SCRIPT TIENE QUE SALIR CON CODIGO 1 SI FALLA. Corre dentro del build de
 * Vercel (`migrate && build`), asi que un fallo silencioso no seria un error de
 * consola: seria un deploy que sale al aire con la base sin migrar. Antes el
 * catch escribia el error y devolvia 0, y el build seguia como si nada.
 */
/**
 * `||` y no `??` a proposito. `??` solo atrapa null y undefined, asi que una
 * DIRECT_DATABASE_URL definida pero VACIA se colaba como cadena vacia y el
 * script moria diciendo que faltaban las dos, con DATABASE_URL ahi puesta.
 *
 * No es un caso rebuscado: es lo que deja `cp .env.example .env`, y es lo que
 * deja un campo en blanco en el panel de Vercel.
 */
const limpia = (valor: string | undefined) => valor?.trim() || undefined

const connectionString = limpia(process.env.DIRECT_DATABASE_URL) ?? limpia(process.env.DATABASE_URL)

if (!connectionString) {
  console.error('Falta DIRECT_DATABASE_URL o DATABASE_URL.')
  process.exit(1)
}

console.log('Conectando a:', connectionString.replace(/:[^:@]+@/, ':****@'))

if (connectionString.includes('-pooler.')) {
  console.warn(
    '\n  AVISO: esta es la URL con pooler. Las migraciones van por la directa\n' +
      '  (el host SIN -pooler). Ponla en DIRECT_DATABASE_URL.\n'
  )
}

const migrationClient = postgres(connectionString, { max: 1 })

async function main() {
  console.log('Corriendo migraciones...')
  try {
    await migrate(drizzle(migrationClient), { migrationsFolder: './migrations' })
    console.log('Migraciones aplicadas.')
  } finally {
    await migrationClient.end()
  }
}

main().catch((error) => {
  console.error('Las migraciones fallaron:', error)
  process.exit(1)
})
