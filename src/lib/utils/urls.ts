import { env } from '@/config/env'
import { isProd } from '@/lib/constants'

/** Las variables de sistema de Vercel llegan SIN esquema: `mi-sitio.vercel.app`. */
const conEsquema = (host: string) =>
  host.startsWith('http://') || host.startsWith('https://')
    ? host
    : `${isProd ? 'https://' : 'http://'}${host}`

const limpia = (valor: string | undefined) => valor?.trim() || undefined

/**
 * La URL publica de la aplicacion, para enlaces de correo, callbacks de sesion
 * y canonicals.
 *
 * Se deduce sola en Vercel, en este orden:
 *
 *   1. NEXT_PUBLIC_APP_URL, si esta puesta. Es la anulacion explicita y gana
 *      siempre: es donde va el dominio propio cuando exista.
 *   2. En produccion, NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL. Vercel la
 *      define como "el dominio de produccion propio mas corto, o el de
 *      vercel.app si no hay ninguno". Por eso el paso a un dominio propio no
 *      pide tocar nada: la variable empieza a devolver el dominio nuevo sola.
 *   3. En preview, la URL de la RAMA antes que la del despliegue suelto. La de
 *      la rama sobrevive al siguiente push, asi que el enlace de un correo
 *      enviado hace una hora sigue abriendo algo.
 *   4. En local, localhost:3000.
 *
 * OJO CON EL MOMENTO: NEXT_PUBLIC_* se incrusta en el bundle DURANTE EL BUILD.
 * Cambiar cualquiera de estas en el panel no surte efecto hasta que se vuelve a
 * desplegar. Vale igual para el dominio propio.
 *
 * En produccion, si no hay ninguna, LANZA. La version anterior tenia un
 * .default() de localhost y devolvia 'http://localhost:3000' sin decir nada:
 * el despliegue quedaba verde con todos los enlaces de correo rotos. Un fallo
 * de build es mejor que eso.
 */
export function getBaseUrl(): string {
  const explicita = limpia(env.NEXT_PUBLIC_APP_URL)
  if (explicita) return conEsquema(explicita)

  if (env.NEXT_PUBLIC_VERCEL_ENV === 'production') {
    const produccion = limpia(env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL)
    if (produccion) return conEsquema(produccion)
  }

  const despliegue =
    limpia(env.NEXT_PUBLIC_VERCEL_BRANCH_URL) ?? limpia(env.NEXT_PUBLIC_VERCEL_URL)
  if (despliegue) return conEsquema(despliegue)

  if (!isProd) return 'http://localhost:3000'

  throw new Error(
    'No se pudo determinar la URL publica. Pon NEXT_PUBLIC_APP_URL, o activa ' +
      '"Enable access to System Environment Variables" en el proyecto de Vercel.'
  )
}
