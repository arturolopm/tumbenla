/**
 * Cuando la peticion nunca llega al servidor.
 *
 * `fetch` solo rechaza cuando el navegador no pudo NI mandar la peticion: sin
 * internet, DNS caido, servidor sin responder, o un preflight de CORS que no
 * paso. En todos esos casos lanza el mismo `TypeError: Failed to fetch`, sin
 * status ni cuerpo. El navegador oculta el motivo a proposito, asi que desde
 * aca no hay forma de distinguirlos y el mensaje no puede prometer cual fue.
 *
 * Lo que si tiene que pasar es que la persona lo VEA. Los manejadores de error
 * de Better-Auth solo corren cuando hubo respuesta; si la peticion nunca sale,
 * la excepcion cae en el `catch` del formulario. Cuando ese `catch` solo hacia
 * `console.error`, el boton volvia a su estado normal y no aparecia nada: para
 * quien lo usa, entrar simplemente no hacia nada.
 */
export const esFalloDeRed = (error: unknown): boolean =>
  error instanceof TypeError && /fetch|network|load failed/i.test(error.message)

export const MENSAJE_FALLO_DE_RED =
  'No pudimos conectarnos con el servidor. Revisa tu internet e intenta de nuevo.'

/** El mensaje de red si la peticion no salio; si no, el que traiga el caso. */
export const mensajeDeError = (error: unknown, porDefecto: string): string =>
  esFalloDeRed(error) ? MENSAJE_FALLO_DE_RED : porDefecto
