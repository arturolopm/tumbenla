/**
 * A donde vuelve alguien despues de iniciar sesion.
 *
 * POR QUE EXISTE ESTE ARCHIVO: habia dos nombres para lo mismo. Las paginas
 * protegidas redirigen con `?redirectAfter=` (lo hacen /mi-historia y
 * requireAdmin), pero el formulario de login solo leia `?callbackUrl=` y caia
 * en su valor por defecto. Entrar desde una pagina protegida nunca devolvia a
 * esa pagina. Aca se leen los dos, con `redirectAfter` de primero, y todo el
 * flujo de auth importa estas funciones en vez de tener su propia copia.
 *
 * No lleva 'server-only': lo usan los formularios de login y registro, que son
 * componentes de cliente.
 */

/**
 * El despachador por rol. No es una pantalla: lee la sesion y redirige a
 * /admin, /panel o /mi-historia. Asi el formulario de login no tiene que saber
 * que roles existen.
 */
export const DESTINO_POR_DEFECTO = '/entrar'

/**
 * Un destino solo vale si es una ruta de ESTE sitio.
 *
 * OJO CON LA DOBLE BARRA: `//evil.com` empieza por '/' y un `startsWith('/')`
 * pelado lo da por bueno, pero el navegador lo lee como URL relativa al
 * protocolo y navega a evil.com. Es la forma clasica de convertir un login en
 * un redirector abierto: el enlace se ve como tumbenla.com/login?... y termina
 * en otro dominio con la sesion recien creada. Por eso aca se exige que
 * empiece por '/' y que el segundo caracter no sea ni '/' ni '\' (Chrome y
 * Firefox normalizan '\' a '/' antes de resolver).
 */
export const esDestinoValido = (destino: string): boolean => {
  if (!destino || !destino.startsWith('/')) return false
  if (destino.startsWith('//') || destino.startsWith('/\\')) return false
  return true
}

/**
 * El destino pedido en la URL, o el despachador.
 *
 * `redirectAfter` manda sobre `callbackUrl` porque es el que emiten nuestras
 * paginas protegidas; `callbackUrl` se sigue leyendo porque lo emite el
 * boilerplate y los enlaces viejos que ya andan por ahi.
 */
export const leerDestino = (
  searchParams: URLSearchParams | null | undefined,
  porDefecto: string = DESTINO_POR_DEFECTO
): string => {
  if (!searchParams) return porDefecto

  const pedido = searchParams.get('redirectAfter') ?? searchParams.get('callbackUrl')
  if (!pedido) return porDefecto

  if (!esDestinoValido(pedido)) {
    console.warn('Destino de redireccion invalido, se ignora:', pedido)
    return porDefecto
  }

  return pedido
}

/** El enlace a login que devuelve a donde estaba la persona. */
export const enlaceDeLogin = (destino: string): string =>
  esDestinoValido(destino)
    ? `/login?redirectAfter=${encodeURIComponent(destino)}`
    : '/login'
