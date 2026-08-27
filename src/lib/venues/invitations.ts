import 'server-only'

/**
 * El token de una invitacion.
 *
 * SE GUARDA EL HASH, SE MANDA EL CLARO. El token en claro existe en el correo y
 * en ningun otro lado. Si se guardara tal cual, cualquier lectura de la tabla
 * —una copia de seguridad, un log, una consulta de soporte— entregaria la
 * capacidad de meterse al panel de un sitio ajeno. Guardando el hash, esa misma
 * lectura no sirve de nada.
 *
 * SHA-256 sin sal y sin estiramiento a proposito, que aqui es lo correcto y no
 * un atajo: esto no es una contraseña. Son 32 bytes aleatorios de un generador
 * criptografico, asi que no hay diccionario que probar ni entropia baja que
 * proteger. Estirarlo solo haria mas lento el unico camino honesto.
 */

const BYTES = 32

/** Duracion de una invitacion. Larga para que quepa un fin de semana, corta
 *  para que un correo viejo no sirva de llave para siempre. */
export const DIAS_DE_VIGENCIA = 7

export const generarToken = () => {
  const bytes = new Uint8Array(BYTES)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export const hashDeToken = async (token: string) => {
  const datos = new TextEncoder().encode(token)
  const digest = await crypto.subtle.digest('SHA-256', datos)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

export const fechaDeVencimiento = () =>
  new Date(Date.now() + DIAS_DE_VIGENCIA * 24 * 60 * 60 * 1000)

/** Por que una invitacion no sirve. Cada caso tiene su mensaje en pantalla:
 *  "no sirve" a secas deja a la persona sin saber si insistir o pedir otra. */
export type MotivoInvalida = 'no_existe' | 'vencida' | 'revocada' | 'usada' | 'otro_correo'

export const MOTIVO_TEXTO: Record<MotivoInvalida, string> = {
  no_existe: 'Ese enlace no corresponde a ninguna invitación.',
  vencida: 'Esa invitación ya venció. Pídele al sitio que te mande otra.',
  revocada: 'Esa invitación fue cancelada.',
  usada: 'Esa invitación ya se usó.',
  otro_correo: 'Esa invitación es para otro correo. Entra con el correo al que llegó.',
}
