import { Link, Text } from '@react-email/components'

import { baseStyles } from '@/components/emails/_styles'
import { getBaseUrl } from '@/lib/utils'
import { EmailLayout } from '../components/email-layout'

interface PedidoEmailProps {
  compradorNombre: string
  productoNombre: string
  venueNombre: string
  cantidad: number
  total: number
  material: number
  pagaEnBarra: boolean
  token: string
  codigos: string[]
}

const pesos = (n: number) => `$${n.toLocaleString('es-CO')}`

/**
 * "Tu pedido, con el codigo."
 *
 * ES EL RESPALDO DEL QR, y por eso existe: la pantalla se pierde si la persona
 * cierra la pestaña, se le apaga el telefono o compro desde el de un amigo. El
 * formulario le promete que le llega el codigo al correo, asi que tiene que
 * llegar.
 *
 * Va EL CODIGO EN TEXTO ademas del enlace. Un correo que solo trae un boton
 * no sirve en la barra si la señal no da para abrirlo, y ocho caracteres se
 * dictan en voz alta.
 *
 * Y dice de frente lo de los 45 dias (decision 32). Enterarse despues de que la
 * plata ya se fue en material es exactamente la clase de sorpresa que este
 * producto no se puede permitir.
 */
export function PedidoEmail({
  compradorNombre,
  productoNombre,
  venueNombre,
  cantidad,
  total,
  material,
  pagaEnBarra,
  token,
  codigos,
}: PedidoEmailProps) {
  const enlace = `${getBaseUrl()}/orden/${token}`

  return (
    <EmailLayout preview={`Tu ${productoNombre} en ${venueNombre}`}>
      <Text style={{ ...baseStyles.paragraph, marginTop: 0 }}>Hola {compradorNombre},</Text>

      <Text style={baseStyles.paragraph}>
        Pediste {cantidad > 1 ? `${cantidad} × ` : null}
        <strong>{productoNombre}</strong> en <strong>{venueNombre}</strong>.
      </Text>

      <Text style={baseStyles.paragraph}>
        {pagaEnBarra ? (
          <>
            Pagas {pesos(total)} allá. <strong>Muestra el código antes de pagar</strong>: el mesero
            lo escanea y ahí le sale qué preparar y cuánto cobrarte.
          </>
        ) : (
          <>
            Ya está pagado ({pesos(total)}). Muestra el código en la barra para que te lo entreguen.
          </>
        )}
      </Text>

      <Text style={baseStyles.paragraph}>
        <Link href={enlace} style={baseStyles.link}>
          Abrir mi pedido
        </Link>
      </Text>

      <Text style={baseStyles.paragraph}>
        Tu código del pedido:{' '}
        <strong>{codigos.map((c) => `${c.slice(0, 4)}-${c.slice(4)}`).join(' · ')}</strong>
      </Text>

      <Text style={baseStyles.paragraph}>
        De {pesos(total)}, <strong>{pesos(material)} se van en material</strong>. Cuando lo
        compremos, la factura queda publicada.
      </Text>

      <Text style={{ ...baseStyles.paragraph, fontSize: '14px' }}>
        Si no lo reclamas en 45 días, esa plata se va toda en material. Si prefieres que te la
        devolvamos, escríbenos a este mismo correo y lo hacemos.
      </Text>
    </EmailLayout>
  )
}
