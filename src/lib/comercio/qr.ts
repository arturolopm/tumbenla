import 'server-only'

import QRCode from 'qrcode'

/**
 * El QR, dibujado en el SERVIDOR como SVG.
 *
 * Se manda el marcado ya hecho en vez de una libreria al navegador: son unos
 * 40 KB de JavaScript menos en la unica pantalla que se abre de pie, en un bar,
 * con la senal que haya. El contenido del codigo ya se conoce en el servidor,
 * asi que no hay nada que calcular en el cliente.
 *
 * Nivel de correccion M (~15%): esto se lee de una pantalla con huellas, a
 * veces rota, bajo luces de colores. L ahorraria unos modulos y se leeria peor
 * justo cuando importa; H agranda el codigo sin que haga falta, porque el
 * papel no es el medio aca.
 */
export const svgDelCodigo = async (contenido: string): Promise<string> =>
  QRCode.toString(contenido, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 1,
    // Sin color de fondo: el SVG queda transparente y lo pinta el contenedor
    // blanco de la tarjeta. Un fondo oscuro heredado del tema volveria el
    // codigo ilegible para la mitad de los lectores.
    color: { dark: '#000000', light: '#FFFFFF' },
  })
