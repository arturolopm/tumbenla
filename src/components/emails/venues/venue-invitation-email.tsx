import { Link, Text } from '@react-email/components'

import { baseStyles } from '@/components/emails/_styles'
import { getBaseUrl } from '@/lib/utils'
import { EmailLayout } from '../components/email-layout'
import { DIAS_DE_VIGENCIA } from '@/lib/venues/invitations'

interface VenueInvitationEmailProps {
  venueName: string
  role: 'owner' | 'staff'
  token: string
}

const ROL_TEXTO: Record<VenueInvitationEmailProps['role'], string> = {
  owner: 'dueño',
  staff: 'parte del equipo',
}

/**
 * "Te invitaron a manejar el perfil de tu sitio."
 *
 * El correo dice QUE SITIO y QUE ROL antes del enlace, a proposito. Quien lo
 * recibe casi nunca esperaba nada de Tumbenla, y un boton sin contexto en un
 * correo inesperado es indistinguible de una estafa.
 *
 * Tambien dice a que correo llego: aceptar exige entrar con ese mismo correo, y
 * es mejor saberlo antes de hacer clic que despues.
 */
export function VenueInvitationEmail({ venueName, role, token }: VenueInvitationEmailProps) {
  const enlace = `${getBaseUrl()}/invitacion/${token}`

  return (
    <EmailLayout preview={`Te invitaron a manejar ${venueName} en Tumbenla`}>
      <Text style={{ ...baseStyles.paragraph, marginTop: 0 }}>Hola,</Text>

      <Text style={baseStyles.paragraph}>
        Te invitaron a entrar como <strong>{ROL_TEXTO[role]}</strong> de{' '}
        <strong>{venueName}</strong> en Tumbenla, el directorio de sitios que ponen una parte
        de sus ventas en material de construcción.
      </Text>

      <Text style={baseStyles.paragraph}>
        Desde ahí vas a poder subir las fotos de las noches, aprobar las que suba la gente y
        reportar lo que el sitio entregó.
      </Text>

      <Link href={enlace} style={{ textDecoration: 'none' }}>
        <Text style={baseStyles.button}>Aceptar la invitación</Text>
      </Link>

      <Text style={baseStyles.paragraph}>
        El enlace sirve por {DIAS_DE_VIGENCIA} días. Para aceptar tienes que entrar con este
        mismo correo, el que estás leyendo ahora.
      </Text>

      <Text style={baseStyles.paragraph}>
        Si no esperabas esta invitación, ignórala: sin abrir el enlace no pasa nada.
      </Text>
    </EmailLayout>
  )
}

export default VenueInvitationEmail
