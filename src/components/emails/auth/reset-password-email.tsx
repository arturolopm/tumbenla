import { Link, Text } from '@react-email/components'

import { baseStyles } from '@/components/emails/_styles'
import { getBrandConfig } from '@/config/branding'
import { EmailLayout } from '../components/email-layout'

interface ResetPasswordEmailProps {
  username?: string
  resetLink?: string
}

export function ResetPasswordEmail({ username = '', resetLink = '' }: ResetPasswordEmailProps) {
  const brand = getBrandConfig()

  return (
    <EmailLayout preview={`Cambia tu contraseña de ${brand.name}`}>
      <Text style={baseStyles.paragraph}>Hola {username},</Text>
      <Text style={baseStyles.paragraph}>
        Alguien pidió cambiar la contraseña de tu cuenta de {brand.name}. Si fuiste tú, entra
        acá y pon una nueva.
      </Text>

      <Link href={resetLink} style={{ textDecoration: 'none' }}>
        <Text style={baseStyles.button}>Cambiar la contraseña</Text>
      </Link>

      {/* Divider */}
      <div style={baseStyles.divider} />

      <Text style={{ ...baseStyles.footerText, textAlign: 'left' }}>
        Si no fuiste tú, ignora este correo: tu contraseña sigue igual. El enlace vence en 24
        horas.
      </Text>
    </EmailLayout>
  )
}

export default ResetPasswordEmail
