/**
 * Email utility functions.
 */

import { env } from '@/config/env'

/**
 * Check if a string value is non-empty and not a placeholder.
 */
export function hasNonEmpty(value: string | undefined): value is string {
  return !!value && value !== 'placeholder' && value.trim() !== ''
}

/**
 * Get the default from email address.
 * Falls back to a constructed address using the Resend domain or a default.
 */
export function getFromEmailAddress(): string {
  const fromName = env.DEFAULT_FROM_NAME || 'Tumbenla'
  const fromEmail =
    env.DEFAULT_FROM_EMAIL ||
    (env.RESEND_DOMAIN ? `noreply@${env.RESEND_DOMAIN}` : 'noreply@example.com')

  return `${fromName} <${fromEmail}>`
}

/**
 * A donde contesta quien le da a "responder".
 *
 * SE ENVIA DESDE UN SUBDOMINIO QUE NO RECIBE. Resend firma y envia
 * send.tumbenla.com, pero no da buzon: nada llega ahi. El buzon vive en el
 * dominio principal, detras de un reenviador. Sin este Reply-To, cada respuesta
 * a un correo nuestro se pierde, y hay copy que la pide explicitamente (el
 * correo de rechazo de una solicitud dice "respondenos a este correo").
 *
 * Devuelve undefined si no esta configurado, para no mandar una cabecera vacia.
 */
export function getReplyToAddress(): string | undefined {
  return hasNonEmpty(env.DEFAULT_REPLY_TO) ? env.DEFAULT_REPLY_TO : undefined
}
