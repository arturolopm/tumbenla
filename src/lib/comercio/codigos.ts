import 'server-only'

/**
 * El codigo de un QR.
 *
 * SE GUARDA EL HASH, SE MANDA EL CLARO — igual que `venues/invitations.ts`, y
 * por la misma razon: el codigo en claro vive en el QR y en el correo, y en
 * ningun otro lado. Una copia de seguridad o una consulta de soporte no
 * entregan la capacidad de reclamar tragos ajenos.
 *
 * POR QUE 8 CARACTERES Y NO 32 BYTES COMO UNA INVITACION. Un codigo tambien se
 * teclea a mano: bar oscuro, pantalla rayada, lente sucio, permiso de camara
 * negado. Teclear un UUID en esas condiciones no pasa. Ocho caracteres de este
 * alfabeto son ~40 bits, y alcanzan porque la accion que redime EXIGE SESION DE
 * PERSONAL DEL SITIO: quien podria sentarse a probar codigos ya tiene permiso
 * de entregar el trago. La entropia aqui protege contra el que adivina de
 * afuera, y afuera no hay puerta.
 *
 * El alfabeto es Crockford base32: sin I, L, O ni U. Las tres primeras porque
 * se confunden con 1 y 0 al leerlas de una pantalla, y la U para que el azar no
 * escriba groserias en el codigo de un cliente.
 */

const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const LARGO = 8

/**
 * 256 es multiplo exacto de 32, asi que `byte % 32` reparte parejo y no hay
 * sesgo que corregir. Con un alfabeto de otro tamano habria que descartar los
 * bytes sobrantes en vez de tomar el modulo.
 */
export const generarCodigo = (): string => {
  const bytes = new Uint8Array(LARGO)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join('')
}

export const hashDeCodigo = async (codigo: string): Promise<string> => {
  const datos = new TextEncoder().encode(normalizarCodigo(codigo))
  const digest = await crypto.subtle.digest('SHA-256', datos)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Lo que se teclea no es lo que se guardo.
 *
 * En pantalla el codigo se muestra partido (`XXXX-XXXX`) porque asi se lee y se
 * dicta mejor, y quien lo teclea puede escribirlo con guion, sin guion, en
 * minuscula o con espacios de mas. El hash se calcula SIEMPRE sobre la forma
 * normalizada, o el mismo codigo da dos hashes distintos y el trago no aparece.
 */
export const normalizarCodigo = (entrada: string): string =>
  entrada
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    // Cortesia con quien teclea: las letras que el alfabeto excluye casi
    // siempre son el digito que se le parece.
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0')

/** `XXXX-XXXX`, que es como se muestra y como se dicta. */
export const formatearCodigo = (codigo: string): string => {
  const limpio = normalizarCodigo(codigo)
  return limpio.length === LARGO ? `${limpio.slice(0, 4)}-${limpio.slice(4)}` : limpio
}

export const esCodigoValido = (entrada: string): boolean =>
  normalizarCodigo(entrada).length === LARGO

/** Por que un codigo no sirve. Cada caso tiene su mensaje: "no sirve" a secas
 *  deja al mesero sin saber si insistir, cobrar, o llamar al dueno. */
export type MotivoNoRedime =
  | 'no_existe'
  | 'ya_redimido'
  | 'anulado'
  | 'otro_sitio'
  | 'orden_caducada'
  | 'orden_sin_pagar'

export const MOTIVO_TEXTO: Record<MotivoNoRedime, string> = {
  no_existe: 'Ese código no existe. Revisa que esté bien escrito.',
  ya_redimido: 'Ese trago ya se entregó.',
  anulado: 'Ese código fue anulado.',
  otro_sitio: 'Ese código no es de este sitio.',
  orden_caducada: 'Ese pedido ya caducó.',
  orden_sin_pagar: 'Ese pedido está cancelado.',
}
