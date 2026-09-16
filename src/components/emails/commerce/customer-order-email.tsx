import { Link, Text } from '@react-email/components'

import { baseStyles } from '@/components/emails/_styles'
import { getBaseUrl } from '@/lib/utils'
import { EmailLayout } from '../components/email-layout'

export type CustomerOrderEmailProps = Readonly<{
  buyerName: string
  venueName: string
  lines: readonly Readonly<{ productName: string; quantity: number }>[]
  total: number
  donationAmount: number
  payAtBar: boolean
  token: string
  code: string
}>

const pesos = (value: number) => `$${value.toLocaleString('es-CO')}`

export function CustomerOrderEmail({
  buyerName,
  venueName,
  lines,
  total,
  donationAmount,
  payAtBar,
  token,
  code,
}: CustomerOrderEmailProps) {
  const orderUrl = `${getBaseUrl()}/orden/${token}`

  return (
    <EmailLayout preview={`Tu pedido en ${venueName}`}>
      <Text style={{ ...baseStyles.paragraph, marginTop: 0 }}>Hola {buyerName},</Text>

      <Text style={baseStyles.paragraph}>
        Pediste en <strong>{venueName}</strong>:
      </Text>
      {lines.map((line) => (
        <Text key={line.productName} style={{ ...baseStyles.paragraph, margin: '4px 0' }}>
          {line.quantity > 1 ? `${line.quantity} × ` : null}
          <strong>{line.productName}</strong>
        </Text>
      ))}

      <Text style={baseStyles.paragraph}>
        {payAtBar ? (
          <>
            Pagas {pesos(total)} allá. <strong>Muestra el código antes de pagar</strong>: un escaneo
            muestra todo lo que deben preparar y cuánto cobrarte.
          </>
        ) : (
          <>
            Ya está pagado ({pesos(total)}). Muestra el código en la barra: un escaneo entrega todo
            el pedido.
          </>
        )}
      </Text>

      <Text style={baseStyles.paragraph}>
        <Link href={orderUrl} style={baseStyles.link}>
          Abrir mi pedido
        </Link>
      </Text>

      <Text style={baseStyles.paragraph}>
        Tu código único del pedido: <strong>{`${code.slice(0, 4)}-${code.slice(4)}`}</strong>
      </Text>

      <Text style={baseStyles.paragraph}>
        De {pesos(total)}, <strong>{pesos(donationAmount)} se van en material</strong>. Cuando lo
        compremos, la factura queda publicada.
      </Text>

      <Text style={{ ...baseStyles.paragraph, fontSize: '14px' }}>
        Si no reclamas un pedido pagado aquí en 45 días, el código vence y conservamos el valor
        disponible para devolvértelo completo. Escríbenos a este mismo correo para solicitarlo.
      </Text>
    </EmailLayout>
  )
}
