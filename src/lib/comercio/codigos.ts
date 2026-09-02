import 'server-only'

/**
 * El codigo de un QR.
 *
 * SE GUARDA EN CLARO, a diferencia de `venues/invitations.ts`, y es una
 * decision corregida: al principio se hasheaba copiando ese archivo. Estaba mal
 * aca por una razon operativa —el comprador tiene que poder LEER el codigo de
 * su pantalla y el mesero tiene que poder TECLEARLO cuando la camara no
 * enfoca—, y un hash no se puede mostrar, asi que hashearlo eliminaba en
 * silencio el respaldo del que depende todo el escaner.
 *
 * Los dos casos no se parecen: una invitacion da acceso al panel de un sitio,
 * esto es un vale por un trago en un bar, redimible solo por un endpoint que ya
 * exige sesion de personal de ESE sitio.
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

import { ALFABETO, LARGO_DEL_CODIGO as LARGO } from '@/lib/comercio/codigos-cliente'

/** Se reexportan para que el servidor no tenga que saber que viven al lado. */
export {
  esCodigoValido,
  formatearCodigo,
  normalizarCodigo,
} from '@/lib/comercio/codigos-cliente'

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
