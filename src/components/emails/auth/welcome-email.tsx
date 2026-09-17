import { Link, Text } from '@react-email/components'

import { baseStyles } from '@/components/emails/_styles'
import { getBrandConfig } from '@/config/branding'
import { getBaseUrl } from '@/lib/utils'
import { EmailLayout } from '../components/email-layout'

interface WelcomeEmailProps {
  userName?: string
}

export function WelcomeEmail({ userName }: WelcomeEmailProps) {
  const brand = getBrandConfig()
  const baseUrl = getBaseUrl()

  return (
    <EmailLayout preview={`Bienvenido a ${brand.name}`}>
      <Text style={{ ...baseStyles.paragraph, marginTop: 0 }}>
        {userName ? `Hola ${userName},` : 'Hola,'}
      </Text>
      <Text style={baseStyles.paragraph}>
        Tu cuenta de {brand.name} ya está lista. Acá lo que sigue: sales como sales siempre, y
        cuando el sitio suba las fotos de esa noche, entras, buscas las tuyas y las guardas. Cada
        noche que guardes suma a tu historia.
      </Text>

      {/* /sitios y no /w: la ruta del boilerplate no existe en este proyecto. */}
      <Link href={`${baseUrl}/sitios`} style={{ textDecoration: 'none' }}>
        <Text style={baseStyles.button}>Ver el mapa del parche</Text>
      </Link>

      <Text style={baseStyles.paragraph}>
        Si tienes un bar o una discoteca, registra tu sitio: puedes aparecer en la red, vender un
        producto propio y dejar prueba pública de cada entrega. Estamos construyendo herramientas
        para volver a hablarle a quienes ya te visitaron, siempre con su autorización.
      </Text>

      <Link href={`${baseUrl}/registrar-sitio`} style={{ textDecoration: 'none' }}>
        <Text style={baseStyles.button}>Ver cómo entrar como sitio</Text>
      </Link>
    </EmailLayout>
  )
}

export default WelcomeEmail
