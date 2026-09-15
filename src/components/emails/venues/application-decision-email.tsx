import { Link, Text } from '@react-email/components'

import { baseStyles } from '@/components/emails/_styles'
import { CORREO_CONTACTO } from '@/config/contacto'
import { getBaseUrl } from '@/lib/utils'
import { EmailLayout } from '../components/email-layout'

interface Props {
  venueName: string
  approved: boolean
  note?: string
  ownerIsReady?: boolean
  contactEmail?: string
}

/** Closes the loop after the operator has resolved a venue application. */
export function ApplicationDecisionEmail({
  venueName,
  approved,
  note,
  ownerIsReady = false,
  contactEmail,
}: Props) {
  const baseUrl = getBaseUrl()
  const registerHref = `${baseUrl}/register?correo=${encodeURIComponent(
    contactEmail ?? ''
  )}&redirectAfter=${encodeURIComponent('/entrar')}`

  return (
    <EmailLayout
      preview={
        approved
          ? ownerIsReady
            ? `${venueName} ya es tuyo en Tumbenla`
            : `${venueName} ya fue aprobado en Tumbenla`
          : `Sobre tu solicitud para ${venueName}`
      }
    >
      <Text style={{ ...baseStyles.paragraph, marginTop: 0 }}>Hola,</Text>

      {approved ? (
        <>
          <Text style={baseStyles.paragraph}>
            Listo: <strong>{venueName}</strong> ya quedó aprobado en Tumbenla.
          </Text>

          {ownerIsReady ? (
            <>
              <Text style={baseStyles.paragraph}>
                Tu cuenta ya tiene el panel. Desde ahí puedes subir las fotos de las noches, aprobar
                las que suba la gente, armar tu primer trago e invitar a tu equipo.
              </Text>

              <Link href={`${baseUrl}/panel`} style={{ textDecoration: 'none' }}>
                <Text style={baseStyles.button}>Entrar al panel</Text>
              </Link>
            </>
          ) : (
            <>
              <Text style={baseStyles.paragraph}>
                Crea tu cuenta —o entra si ya la tienes— con <strong>{contactEmail}</strong>. Al
                verificar el código, el panel aparece solo: no tienes que aceptar una invitación ni
                pedir otro enlace.
              </Text>

              <Link href={registerHref} style={{ textDecoration: 'none' }}>
                <Text style={baseStyles.button}>Crear mi cuenta</Text>
              </Link>
            </>
          )}

          <Text style={baseStyles.paragraph}>
            El sitio solo aparece en el mapa si el operador lo dejó publicado. Si quedó en borrador,
            puedes terminar de dejar el perfil listo desde el panel.
          </Text>
        </>
      ) : (
        <>
          <Text style={baseStyles.paragraph}>
            Por ahora no pudimos aprobar tu solicitud para <strong>{venueName}</strong>.
          </Text>
          {note ? <Text style={baseStyles.paragraph}>{note}</Text> : null}
          <Text style={baseStyles.paragraph}>
            Si crees que hay un error, respóndenos a este correo o escríbenos a{' '}
            <strong>{CORREO_CONTACTO}</strong> y lo miramos.
          </Text>
        </>
      )}
    </EmailLayout>
  )
}

export default ApplicationDecisionEmail
