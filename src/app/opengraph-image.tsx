import {
  TAMANO,
  TEXTO_ALTERNATIVO,
  TIPO_DE_CONTENIDO,
  dibujarImagenSocial,
} from './_og/imagen'

// Se dibuja en el build y no por peticion: un rastreador que mire el enlace no
// puede costarnos CU. Ver la nota larga en `_og/imagen.tsx`.
export const dynamic = 'force-static'

export const alt = TEXTO_ALTERNATIVO
export const size = TAMANO
export const contentType = TIPO_DE_CONTENIDO

export default dibujarImagenSocial
