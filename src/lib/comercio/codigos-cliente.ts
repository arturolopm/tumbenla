/**
 * Lo que del codigo tambien necesita el navegador.
 *
 * Vive aparte de `codigos.ts` porque ese es `server-only` —genera codigos, y
 * generarlos en el cliente no tiene sentido— pero DOS pantallas de cliente
 * tienen que hablar de codigos igual: la del comprador, que lo muestra, y la
 * del escaner, que lo recibe tecleado. Son funciones puras, sin base y sin
 * secretos, asi que cruzar la frontera no cuesta nada.
 */

export const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
export const LARGO_DEL_CODIGO = 8

/**
 * Lo que se teclea no es siempre lo que se guardo.
 *
 * En pantalla el codigo va partido (`XXXX-XXXX`) porque asi se lee y se dicta
 * mejor, y quien lo escribe puede meterle guion, no meterlo, escribirlo en
 * minuscula o dejar un espacio. La busqueda va SIEMPRE contra esta forma, o el
 * mismo codigo no encuentra su fila y el trago "no existe".
 *
 * I, L y O se mapean a 1 y 0 porque el alfabeto no las contiene: si alguien las
 * escribio, quiso escribir el digito que se les parece. La U tambien esta fuera
 * del alfabeto (para que el azar no arme groserias) pero no se mapea a nada:
 * no hay ningun caracter con el que se confunda.
 */
export const normalizarCodigo = (entrada: string): string =>
  entrada
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0')

/** `XXXX-XXXX`, que es como se muestra y como se dicta. */
export const formatearCodigo = (codigo: string): string => {
  const limpio = normalizarCodigo(codigo)
  return limpio.length === LARGO_DEL_CODIGO ? `${limpio.slice(0, 4)}-${limpio.slice(4)}` : limpio
}

export const esCodigoValido = (entrada: string): boolean =>
  normalizarCodigo(entrada).length === LARGO_DEL_CODIGO
