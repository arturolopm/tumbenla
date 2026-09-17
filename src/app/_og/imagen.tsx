import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { ImageResponse } from 'next/og'

/**
 * Social image rendered as code so the public brand message is reviewable and build-time static.
 * Satori cannot read CSS variables or oklch colors, so the hand-written hex values mirror the
 * branding config. Rendering during the build avoids compute on every crawler request.
 */

const FONDO = '#0d1321'
const NARANJA = '#f56218'
const LIMA = '#b4ff39'
const BLANCO = '#f8f9fa'
const TENUE = '#e2bfb2'

export const TAMANO = { width: 1200, height: 630 }
export const TIPO_DE_CONTENIDO = 'image/png'
export const TEXTO_ALTERNATIVO =
  'Tumbenla — sitios con un producto de la carta y compras de material con factura'

const fuente = (archivo: string) => readFile(join(process.cwd(), 'src/app/_og', archivo))

export async function dibujarImagenSocial() {
  const [anybody, montserrat] = await Promise.all([
    fuente('anybody-black.ttf'),
    fuente('montserrat-semibold.ttf'),
  ])

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        backgroundColor: FONDO,
        // Match the hero gradient. Halftone and grain are omitted because WhatsApp recompression
        // makes them noisy at this size.
        backgroundImage: `radial-gradient(1000px 620px at 78% -12%, ${NARANJA}59 0%, ${FONDO}00 62%)`,
        padding: '76px 84px',
      }}
    >
      <div style={{ display: 'flex' }}>
        <div
          style={{
            display: 'flex',
            backgroundColor: LIMA,
            color: FONDO,
            fontFamily: 'Anybody',
            fontSize: 26,
            letterSpacing: 1,
            padding: '12px 26px',
            borderRadius: 999,
          }}
        >
          EL RITMO NOS LEVANTA
        </div>
      </div>

      {/* Keep the two display lines nowrap: Satori silently wraps overflow and can push the footer
          off-canvas. A clipped line is visible and fixable, unlike a missing paragraph. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          marginTop: 34,
          fontFamily: 'Anybody',
          color: BLANCO,
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 104,
            lineHeight: 0.94,
            letterSpacing: -3,
            whiteSpace: 'nowrap',
          }}
        >
          TUMBENLA
        </div>
        {/* Manual optical kerning: Anybody Black leaves a visibly wide gap between "LA" and the
            following "A", so the words are separate flex items to close only that gap. */}
        <div
          style={{
            display: 'flex',
            gap: 18,
            fontSize: 58,
            lineHeight: 1.08,
            letterSpacing: -1,
            color: LIMA,
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{ display: 'flex' }}>Y</div>
          <div style={{ display: 'flex' }}>VOLVÁMOSLA</div>
          <div style={{ display: 'flex', marginLeft: -16 }}>A</div>
          <div style={{ display: 'flex' }}>PARAR</div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          marginTop: 28,
          maxWidth: 840,
          fontFamily: 'Montserrat',
          fontSize: 27,
          lineHeight: 1.42,
          color: TENUE,
        }}
      >
        Salir sigue siendo salir. Una parte del trago se vuelve material para volver a levantar, con
        la factura a la vista.
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginTop: 'auto',
          fontFamily: 'Anybody',
          fontSize: 30,
          color: BLANCO,
        }}
      >
        <div style={{ display: 'flex', width: 56, height: 8, backgroundColor: NARANJA }} />
        <div style={{ display: 'flex', marginLeft: 20 }}>tumbenla.com</div>
      </div>
    </div>,
    {
      ...TAMANO,
      fonts: [
        { name: 'Anybody', data: anybody, style: 'normal', weight: 900 },
        { name: 'Montserrat', data: montserrat, style: 'normal', weight: 600 },
      ],
    }
  )
}
