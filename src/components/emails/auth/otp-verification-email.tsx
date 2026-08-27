import { Section, Text } from '@react-email/components'

import { baseStyles } from '@/components/emails/_styles'
import { getBrandConfig } from '@/config/branding'
import { EmailLayout } from '../components/email-layout'

interface OTPVerificationEmailProps {
  otp: string
  email?: string
  type?: 'sign-in' | 'email-verification' | 'forget-password'
}

const getSubjectByType = (type: string, brandName: string) => {
  switch (type) {
    case 'sign-in':
      return `Tu código para entrar a ${brandName}`
    case 'email-verification':
      return `Tu código de ${brandName}`
    case 'forget-password':
      return `Cambia tu contraseña de ${brandName}`
    default:
      return `Tu código de ${brandName}`
  }
}

export function OTPVerificationEmail({
  otp,
  type = 'email-verification',
}: OTPVerificationEmailProps) {
  const brand = getBrandConfig()

  return (
    <EmailLayout preview={getSubjectByType(type, brand.name)}>
      <Text style={baseStyles.paragraph}>Tu código:</Text>

      <Section style={baseStyles.codeContainer}>
        <Text style={baseStyles.code}>{otp}</Text>
      </Section>

      <Text style={baseStyles.paragraph}>Sirve por 15 minutos.</Text>

      {/* Divider */}
      <div style={baseStyles.divider} />

      <Text style={{ ...baseStyles.footerText, textAlign: 'left' }}>
        No le compartas este código a nadie. Si no lo pediste, ignora este correo: sin el
        código no pasa nada.
      </Text>
    </EmailLayout>
  )
}

export default OTPVerificationEmail
