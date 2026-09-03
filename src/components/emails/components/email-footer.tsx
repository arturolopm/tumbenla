import { Container, Section } from '@react-email/components'

import { baseStyles, colors, spacing, typography } from '@/components/emails/_styles'
import { getBrandConfig } from '@/config/branding'
import { getBaseUrl } from '@/lib/utils'

interface UnsubscribeOptions {
  unsubscribeToken?: string
  email?: string
}

interface EmailFooterProps {
  baseUrl?: string
  unsubscribe?: UnsubscribeOptions
  messageId?: string
}

/**
 * Pie de los correos.
 *
 * ESTABA EN INGLES Y CON ENLACES DE OTRO PRODUCTO. Traia "Questions?",
 * "Privacy Policy", "Terms of Service", "Unsubscribe", y una fila de iconos
 * sociales que apuntaban a `x.com/elon_musk`, un `discord.gg` al azar y
 * `github.com/revokslab` —restos del boilerplate—. En un producto que es solo
 * en español (decision 7) eso le llega tal cual a la persona.
 *
 * Los enlaces de politicas ademas iban a `/privacy` y `/terms`, que no existen:
 * las rutas son `/privacidad` y `/terminos`.
 *
 * Las redes se quitan hasta que haya una cuenta oficial que poner en
 * `config/branding.ts`; una fila de iconos que llevan a ninguna parte es peor
 * que no tenerla.
 */
export function EmailFooter({ baseUrl = getBaseUrl(), unsubscribe, messageId }: EmailFooterProps) {
  const brand = getBrandConfig()

  const footerLinkStyle = {
    color: colors.textMuted,
    textDecoration: 'underline',
    fontWeight: 'normal' as const,
    fontFamily: typography.fontFamily,
  }

  const unsubscribeHref =
    unsubscribe?.unsubscribeToken && unsubscribe?.email
      ? `${baseUrl}/unsubscribe?token=${unsubscribe.unsubscribeToken}&email=${encodeURIComponent(unsubscribe.email)}`
      : `mailto:${brand.supportEmail}?subject=${encodeURIComponent('Quiero salir de la lista')}`

  return (
    <Section
      style={{
        backgroundColor: colors.footerBg,
        width: '100%',
      }}
    >
      <Container style={{ maxWidth: `${spacing.containerWidth}px`, margin: '0 auto' }}>
        <table
          cellPadding={0}
          cellSpacing={0}
          border={0}
          width='100%'
          style={{ minWidth: `${spacing.containerWidth}px` }}
        >
          <tbody>
            <tr>
              <td style={baseStyles.spacer} height={32}>
                &nbsp;
              </td>
            </tr>

            {/* Address row */}
            <tr>
              <td style={baseStyles.gutter} width={spacing.gutter}>
                &nbsp;
              </td>
              <td style={baseStyles.footerText}>{brand.name}</td>
              <td style={baseStyles.gutter} width={spacing.gutter}>
                &nbsp;
              </td>
            </tr>

            <tr>
              <td style={baseStyles.spacer} height={8}>
                &nbsp;
              </td>
            </tr>

            {/* Contact row */}
            <tr>
              <td style={baseStyles.gutter} width={spacing.gutter}>
                &nbsp;
              </td>
              <td style={baseStyles.footerText}>
                ¿Dudas? Respóndenos a este correo o escribe a{' '}
                <a href={`mailto:${brand.supportEmail}`} style={footerLinkStyle}>
                  {brand.supportEmail}
                </a>
              </td>
              <td style={baseStyles.gutter} width={spacing.gutter}>
                &nbsp;
              </td>
            </tr>

            <tr>
              <td style={baseStyles.spacer} height={8}>
                &nbsp;
              </td>
            </tr>

            {/* Message ID row (optional) */}
            {messageId && (
              <>
                <tr>
                  <td style={baseStyles.gutter} width={spacing.gutter}>
                    &nbsp;
                  </td>
                  <td style={baseStyles.footerText}>
                    Para referirte a este mensaje, usa este ID: {messageId}
                  </td>
                  <td style={baseStyles.gutter} width={spacing.gutter}>
                    &nbsp;
                  </td>
                </tr>
                <tr>
                  <td style={baseStyles.spacer} height={8}>
                    &nbsp;
                  </td>
                </tr>
              </>
            )}

            {/* Links row */}
            <tr>
              <td style={baseStyles.gutter} width={spacing.gutter}>
                &nbsp;
              </td>
              <td style={baseStyles.footerText}>
                <a
                  href={`${baseUrl}/privacidad`}
                  style={footerLinkStyle}
                  rel='noopener noreferrer'
                >
                  Privacidad
                </a>{' '}
                •{' '}
                <a href={`${baseUrl}/terminos`} style={footerLinkStyle} rel='noopener noreferrer'>
                  Términos
                </a>{' '}
                •{' '}
                <a href={unsubscribeHref} style={footerLinkStyle} rel='noopener noreferrer'>
                  Salir de la lista
                </a>
              </td>
              <td style={baseStyles.gutter} width={spacing.gutter}>
                &nbsp;
              </td>
            </tr>

            {/* Copyright row */}
            <tr>
              <td style={baseStyles.spacer} height={16}>
                &nbsp;
              </td>
            </tr>
            <tr>
              <td style={baseStyles.gutter} width={spacing.gutter}>
                &nbsp;
              </td>
              <td style={baseStyles.footerText}>
                © {new Date().getFullYear()} {brand.name}
              </td>
              <td style={baseStyles.gutter} width={spacing.gutter}>
                &nbsp;
              </td>
            </tr>

            <tr>
              <td style={baseStyles.spacer} height={32}>
                &nbsp;
              </td>
            </tr>
          </tbody>
        </table>
      </Container>
    </Section>
  )
}

export default EmailFooter
