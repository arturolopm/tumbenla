import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import { env } from '@/config/env'
import * as schema from './schema'

const databaseUrl = env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required. Please set it in your .env file.')
}

/**
 * El pool, acotado y con reciclaje.
 *
 * postgres() sin opciones abre hasta 10 conexiones y NO las suelta nunca: no
 * trae idle_timeout por defecto. Eso, multiplicado por cada instancia del
 * modulo, agota la base.
 *
 * Se veia asi: `next build` levanta 7 workers, cada worker importa este modulo
 * y abre su propio pool, y en dev Turbopack vuelve a instanciar el modulo en
 * cada hot reload dejando el pool anterior colgado. El resultado medido fueron
 * 82 conexiones idle contra un max_connections de 100, y el build cayo con
 * `53300: sorry, too many clients already` a mitad del prerender.
 *
 * En produccion serverless es el mismo problema con otra cara: cada instancia
 * de la lambda abre su pool contra una base con un tope de conexiones.
 */
/**
 * Contra que estamos hablando.
 *
 * Neon expone dos hosts para la misma base: el directo y el del pooler, que se
 * distingue por el `-pooler` en el nombre. El Postgres de Docker no tiene
 * ninguno de los dos, asi que esto da false en local y todo sigue como estaba.
 */
const isPooled = databaseUrl.includes('-pooler.')

const createClient = () =>
  postgres(databaseUrl, {
    // Por instancia del modulo, no en total. Con varios workers y varias
    // lambdas, el numero que importa es este por el numero de instancias.
    //
    // Contra el pooler se pide UNA sola: quien agrupa es PgBouncer, y cada
    // conexion que retiene una lambda es un cupo que le quita a las demas.
    //
    // COSTO CONOCIDO: con max 1 un Promise.all se serializa. La portada lanza
    // cuatro consultas a la vez y pasarian a ir una detras de otra. En ISR eso
    // ocurre en la revalidacion de fondo y el visitante nunca lo ve; en
    // /mi-historia son dos y se nota un viaje de ida y vuelta.
    max: isPooled ? 1 : 5,
    // El pooler de Neon es PgBouncer en modo transaccion: la conexion vuelve al
    // pool al terminar cada transaccion. postgres-js nombra y cachea sus
    // prepared statements POR CONEXION, y ese cache deja de tener sentido
    // cuando la conexion cambia de manos todo el tiempo. Contra el Postgres
    // local no hay pooler y los prepared statements si valen la pena.
    prepare: !isPooled,
    // Segundos. Esto es lo que faltaba: sin idle_timeout una conexion ociosa
    // se queda tomada hasta que el proceso muere.
    idle_timeout: 20,
    max_lifetime: 60 * 30,
    connect_timeout: 10,
  })

/**
 * Guardarrail para la mala configuracion que no da sintomas hasta que hay
 * trafico: apuntar produccion a la URL directa de Neon en vez de a la del
 * pooler. Con pocas visitas funciona igual, y el dia que llegan varias a la vez
 * se agotan las conexiones.
 *
 * Avisa, no lanza. Tumbar un sitio que funciona mal pero funciona es peor que
 * dejar el aviso en los logs.
 */
/**
 * Que base esta viendo este despliegue, dicho en voz alta.
 *
 * El error caro de este montaje no es que falle: es que funcione. Si
 * DATABASE_URL queda con ambito "Production and Preview", cada preview lee y
 * escribe la base de produccion, y ademas cada build de preview corre
 * `bun run migrate`, asi que una rama con una migracion nueva se la aplica a
 * produccion. Todo eso se ve verde.
 *
 * Cada rama de Neon tiene su propio endpoint (`ep-...`), asi que imprimirlo
 * convierte una equivocacion invisible en dos lineas de log comparables: si el
 * despliegue de preview y el de produccion muestran el MISMO endpoint, estan
 * compartiendo base.
 *
 * No lleva credenciales: solo el identificador del endpoint, el ambito y si va
 * por el pooler.
 */
if (process.env.VERCEL) {
  const endpoint = databaseUrl.match(/@([^.@]+)\./)?.[1] ?? 'desconocido'
  console.log(
    `[db] entorno=${process.env.VERCEL_ENV ?? '?'} endpoint=${endpoint} pooled=${isPooled}`
  )
}

if (process.env.NODE_ENV === 'production' && !isPooled) {
  console.warn(
    '[db] DATABASE_URL no apunta al pooler. En serverless usa el host con -pooler; ' +
      'la URL directa es solo para migraciones (DIRECT_DATABASE_URL).'
  )
}

/**
 * En dev el pool se guarda en globalThis para que sobreviva al hot reload. Sin
 * esto, cada guardado de un archivo deja atras un pool entero.
 */
const globalForDb = globalThis as unknown as {
  __tumbenlaDbClient?: ReturnType<typeof createClient>
}

const queryClient =
  globalForDb.__tumbenlaDbClient ?? (globalForDb.__tumbenlaDbClient = createClient())

if (process.env.NODE_ENV === 'production') {
  // En produccion no se comparte por globalThis: cada instancia es su propio
  // proceso y guardar el cliente ahi solo esconde fugas.
  globalForDb.__tumbenlaDbClient = undefined
}

export const db = drizzle({ client: queryClient, schema })
