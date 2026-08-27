import { getBrandConfig } from '@/config/branding'

/** Email subject type for all supported email templates */
export type EmailSubjectType =
  | 'sign-in'
  | 'email-verification'
  | 'forget-password'
  | 'reset-password'
  | 'invitation'
  | 'venue-invitation'
  | 'solicitud-dm'
  | 'solicitud-aprobada'
  | 'solicitud-rechazada'
  | 'welcome'

/**
 * Returns the email subject line for a given email type.
 * @param type - The type of email being sent
 * @returns The subject line for the email
 */
export function getEmailSubject(type: EmailSubjectType): string {
  const brandName = getBrandConfig().name

  switch (type) {
    case 'sign-in':
      return `Tu código para entrar a ${brandName}`
    case 'email-verification':
      return `Tu código de ${brandName}`
    case 'forget-password':
      return `Cambia tu contraseña de ${brandName}`
    case 'reset-password':
      return `Cambia tu contraseña de ${brandName}`
    case 'invitation':
      return `Te invitaron a un equipo en ${brandName}`
    // El unico asunto en espanol: es el unico de esta lista que le llega a
    // alguien del producto y no a una cuenta de prueba del boilerplate.
    case 'venue-invitation':
      return `Te invitaron a manejar tu sitio en ${brandName}`
    case 'solicitud-dm':
      return `Falta un paso para registrar tu sitio en ${brandName}`
    case 'solicitud-aprobada':
      return `Tu sitio ya quedó a tu nombre en ${brandName}`
    case 'solicitud-rechazada':
      return `Sobre tu solicitud en ${brandName}`
    case 'welcome':
      return `Bienvenido a ${brandName}`
    default:
      return brandName
  }
}
