import { Link, Text } from '@react-email/components'

import { baseStyles } from '@/components/emails/_styles'
import { CORREO_CONTACTO } from '@/config/contacto'
import { getBaseUrl } from '@/lib/utils'
import { EmailLayout } from '../components/email-layout'

interface Props {
  venueName: string
  aprobada: boolean
  nota?: string
}

/** Como quedo la solicitud. Cierra el circuito: antes la decision solo se veia
 *  si la persona volvia a entrar a /registrar-sitio por su cuenta. */
export function SolicitudDecisionEmail({ venueName, aprobada, nota }: Props) {
  const baseUrl = getBaseUrl()

  return (
    <EmailLayout
      preview={
        aprobada ? `${venueName} ya es tuyo en Tumbenla` : `Sobre tu solicitud para ${venueName}`
      }
    >
      <Text style={{ ...baseStyles.paragraph, marginTop: 0 }}>Hola,</Text>

      {aprobada ? (
        <>
          <Text style={baseStyles.paragraph}>
            Listo: <strong>{venueName}</strong> ya quedó a tu nombre en Tumbenla. Desde el panel
            puedes subir las fotos de las noches, aprobar las que suba la gente, reportar lo que
            entregas e invitar a tu equipo.
          </Text>

          <Link href={`${baseUrl}/panel`} style={{ textDecoration: 'none' }}>
            <Text style={baseStyles.button}>Entrar al panel</Text>
          </Link>

          {/* Que el sitio exista y que salga en el mapa son dos cosas distintas,
              y decirlo evita la pregunta obvia de por que no aparece. */}
          <Text style={baseStyles.paragraph}>
            Todavía no sale en el mapa: lo publicamos cuando terminemos de confirmar contigo lo que
            vas a poner. Mientras tanto puedes ir dejando el perfil listo.
          </Text>
        </>
      ) : (
        <>
          <Text style={baseStyles.paragraph}>
            Por ahora no pudimos aprobar tu solicitud para <strong>{venueName}</strong>.
          </Text>
          {nota ? <Text style={baseStyles.paragraph}>{nota}</Text> : null}
          <Text style={baseStyles.paragraph}>
            Si crees que hay un error, respóndenos a este correo o escríbenos a{' '}
            <strong>{CORREO_CONTACTO}</strong> y lo miramos.
          </Text>
        </>
      )}
    </EmailLayout>
  )
}

export default SolicitudDecisionEmail
