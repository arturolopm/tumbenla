import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { ImageResponse } from 'next/og'

/**
 * La imagen que se ve cuando alguien pega el enlace en WhatsApp.
 *
 * SE DIBUJA, NO SE GUARDA. Antes habia un PNG suelto en `public/`, y era el que
 * traia el boilerplate: "Launch SaaS in days, not months". Nadie lo cambio
 * porque un archivo binario no se lee en una revision, no rompe el build y no
 * sale en ningun typecheck. Se ve una sola vez: cuando alguien comparte el
 * sitio. Dibujarla desde los tokens de la marca la vuelve codigo, que si se
 * revisa y si se puede equivocar de forma visible.
 *
 * Los hex estan escritos a mano a proposito: Satori no entiende `oklch()` ni
 * las variables CSS del stylesheet, asi que no hay forma de leerlas de ahi.
 * Son los mismos de `src/config/branding.ts`, que ya carga con esa
 * sincronizacion manual y explica por que.
 *
 * Se prerenderiza en el build (`force-static` en las rutas que la usan). Eso no
 * es un detalle: si se generara por peticion, cada vez que un rastreador mire
 * el enlace gastaria CU, y el presupuesto de Neon/Vercel esta contado.
 */

const FONDO = '#0d1321'
const NARANJA = '#f56218'
const LIMA = '#b4ff39'
const BLANCO = '#f8f9fa'
const TENUE = '#e2bfb2'

export const TAMANO = { width: 1200, height: 630 }
export const TIPO_DE_CONTENIDO = 'image/png'
export const TEXTO_ALTERNATIVO =
  'Tumbenla — bares y discotecas que ponen una parte de sus ventas en material de construccion'

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
        // El mismo tratamiento del hero: el naranja entra por arriba y se
        // apaga contra el navy. Sin la trama ni el grano, que a 1200x630 y
        // despues de que WhatsApp recomprime la imagen solo ensucian.
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

      {/* Las dos lineas van con `whiteSpace: nowrap` a proposito. Satori no
          avisa cuando un texto se desborda: lo parte en cuantas lineas haga
          falta y empuja el resto del bloque fuera del lienzo, en silencio. Con
          nowrap, un cuerpo demasiado grande se ve como texto cortado —evidente
          en cuanto uno mira el PNG— en vez de como una tarjeta que perdio el
          parrafo y se le encimo el pie. */}
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
        {/* Kerning optico a mano. En una cadena normal, "VOLVÁMOSLA A PARAR"
            se ve con un espacio de mas antes de la A suelta, y parece un error
            de dedo. No lo es, y no es cosa de Satori: la L y las dos A son
            diagonales, y entre "LA" y "A" queda un hueco blanco que mide igual
            que los demas pero se ve el doble. Es justo lo que el kerning de una
            fuente corrige, y Anybody Black no lo trae para este par. Por eso
            las palabras van sueltas: solo asi se puede cerrar ESE hueco sin
            tocar los otros. */}
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
        Bares y discotecas que ponen una parte de sus ventas en material de construcción.
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
