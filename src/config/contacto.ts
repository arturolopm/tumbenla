/**
 * Por donde nos escribe un sitio, y desde donde lo verificamos.
 *
 * VIVE EN CODIGO Y NO EN UNA VARIABLE DE ENTORNO a proposito: son datos
 * publicos que salen impresos en el copy y en los correos, no secretos. Una
 * variable de entorno los volveria invisibles en el repo y agregaria una forma
 * mas de que produccion y preview no coincidan.
 */

/** La cuenta a la que el sitio manda el DM de verificacion. Sin arroba. */
export const INSTAGRAM_VERIFICACION = 'tumbenla'

/** El correo publico. El mismo del pie de pagina. */
export const CORREO_CONTACTO = 'hola@tumbenla.com'

export const urlInstagram = (handle: string) => `https://instagram.com/${handle.replace(/^@/, '')}`

/**
 * El handle como se guarda: sin arroba, sin URL, en minusculas.
 *
 * Se normaliza al ESCRIBIR y no al leer porque el indice unico parcial de
 * venue_application compara lower(instagram): si a la base llegaran
 * "@BarX", "barx" y "instagram.com/barx" como cadenas distintas, tres personas
 * podrian tener a la vez una solicitud viva por el mismo bar.
 */
export const normalizarHandle = (valor: string): string => {
  let v = valor.trim()
  // Acepta que peguen la URL completa, que es lo que hace la mayoria.
  v = v.replace(/^https?:\/\/(www\.)?(instagram|tiktok)\.com\//i, '')
  v = v.replace(/^@/, '')
  v = v.split(/[/?#]/)[0]
  return v.toLowerCase()
}
