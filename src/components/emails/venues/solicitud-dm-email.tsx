import { Text } from '@react-email/components'

import { baseStyles } from '@/components/emails/_styles'
import { INSTAGRAM_VERIFICACION } from '@/config/contacto'
import { EmailLayout } from '../components/email-layout'

interface Props {
  venueName: string
  /** El Instagram que declaro en la solicitud. */
  instagram: string
  /** El correo con el que aplico. El DM tiene que citarlo. */
  contactEmail: string
}

/**
 * "Falta un paso: escribenos por Instagram."
 *
 * LAS DOS COSAS QUE PIDE ESTE CORREO NO SON LA MISMA. Que el DM salga de la
 * cuenta del bar prueba que quien escribe controla esa cuenta. Que el DM cite
 * el correo de la solicitud prueba que es la misma persona que la mando. Sin lo
 * segundo, quien maneja las redes del bar podria quedarse con el sitio de otro.
 * Por eso el correo repite el dato en vez de solo decir "escribenos".
 */
export function SolicitudDmEmail({ venueName, instagram, contactEmail }: Props) {
  return (
    <EmailLayout preview={`Falta un paso para registrar ${venueName}`}>
      <Text style={{ ...baseStyles.paragraph, marginTop: 0 }}>Hola,</Text>

      <Text style={baseStyles.paragraph}>
        Recibimos tu solicitud para registrar <strong>{venueName}</strong> en Tumbenla. Falta un
        paso y es rápido.
      </Text>

      <Text style={baseStyles.paragraph}>
        Escríbenos un mensaje directo a <strong>@{INSTAGRAM_VERIFICACION}</strong>{' '}
        <strong>desde la cuenta @{instagram}</strong>, la del sitio. Así confirmamos que la cuenta
        es de ustedes.
      </Text>

      <Text style={baseStyles.paragraph}>
        En ese mensaje incluye este correo: <strong>{contactEmail}</strong>. Es lo que nos deja
        saber que quien escribe por Instagram es quien llenó el formulario, y sin eso no podemos
        aprobarlo.
      </Text>

      <Text style={baseStyles.paragraph}>
        Cuando llegue, te escribimos para acordar cuánto vas a poner y publicamos el sitio.
      </Text>
    </EmailLayout>
  )
}

export default SolicitudDmEmail
