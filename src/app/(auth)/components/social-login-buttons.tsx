'use client'

import { type ReactNode, useEffect, useState } from 'react'
import { GitHubIcon, GoogleIcon, MicrosoftIcon, FacebookIcon } from './icons'
import { Button } from '@/components/ui/button'
import { client } from '@/lib/auth/auth-client'
import { DESTINO_POR_DEFECTO } from '@/lib/auth/redirect'
import { mensajeDeError } from '../fallo-de-red'

interface SocialLoginButtonsProps {
  githubAvailable: boolean
  googleAvailable: boolean
  microsoftAvailable: boolean
  facebookAvailable: boolean
  callbackURL?: string
  isProduction: boolean
  children?: ReactNode
}

type Proveedor = 'github' | 'google' | 'microsoft' | 'facebook'

const NOMBRE: Record<Proveedor, string> = {
  github: 'GitHub',
  google: 'Google',
  microsoft: 'Microsoft',
  facebook: 'Facebook',
}

/**
 * Traduce el fallo a algo accionable. Devuelve un mensaje SIEMPRE: el caso que
 * no se reconoce tambien tiene que verse, porque un boton que se apaga sin
 * decir nada es indistinguible de uno roto.
 */
const mensajeDelProveedor = (error: unknown, proveedor: Proveedor): string => {
  const texto = error instanceof Error ? error.message : ''

  if (texto.includes('account exists')) {
    return 'Ya hay una cuenta con ese correo. Entra con tu contraseña.'
  }
  if (texto.includes('cancelled')) {
    return `Cancelaste la entrada con ${NOMBRE[proveedor]}.`
  }
  if (texto.includes('rate limit')) {
    return 'Demasiados intentos. Espera un momento.'
  }

  return mensajeDeError(error, `No se pudo entrar con ${NOMBRE[proveedor]}. Intenta de nuevo.`)
}

export function SocialLoginButtons({
  githubAvailable,
  googleAvailable,
  microsoftAvailable,
  facebookAvailable,
  callbackURL = DESTINO_POR_DEFECTO,
  children,
}: SocialLoginButtonsProps) {
  const [mounted, setMounted] = useState(false)
  const [cargando, setCargando] = useState<Proveedor | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Set mounted state to true on client-side
  useEffect(() => {
    setMounted(true)
  }, [])

  // Only render on the client side to avoid hydration errors
  if (!mounted) return null

  /**
   * UN SOLO MANEJADOR PARA LOS CUATRO.
   *
   * Antes habia cuatro copias de este bloque, y en las cuatro el `catch`
   * armaba un `errorMessage` con todos sus casos... y no lo usaba para nada:
   * la variable moria ahi. Como ademas el `finally` apagaba el spinner, entrar
   * con Google fallando se veia exactamente igual que no haber hecho clic.
   */
  const entrarCon = async (proveedor: Proveedor) => {
    setCargando(proveedor)
    setError(null)
    try {
      await client.signIn.social({ provider: proveedor, callbackURL })
    } catch (err) {
      console.error(`Social login error (${proveedor}):`, err)
      setError(mensajeDelProveedor(err, proveedor))
    } finally {
      setCargando(null)
    }
  }

  const boton = (proveedor: Proveedor, disponible: boolean, Icono: typeof GitHubIcon) => (
    <Button
      variant='outline'
      size='lg'
      className='w-full hover:bg-gray-50'
      disabled={!disponible || cargando !== null}
      onClick={() => entrarCon(proveedor)}
    >
      <Icono className='h-[18px]! w-[18px]! mr-1' />
      {cargando === proveedor ? 'Conectando…' : NOMBRE[proveedor]}
    </Button>
  )

  // Incluye los cuatro. Antes miraba solo GitHub y Google, asi que un proyecto
  // configurado unicamente con Microsoft o Facebook no pintaba ningun boton.
  const hayProveedor = githubAvailable || googleAvailable || microsoftAvailable || facebookAvailable

  if (!hayProveedor && !children) {
    return null
  }

  return (
    <div className='grid gap-3 font-light'>
      {googleAvailable && boton('google', googleAvailable, GoogleIcon)}
      {githubAvailable && boton('github', githubAvailable, GitHubIcon)}
      {microsoftAvailable && boton('microsoft', microsoftAvailable, MicrosoftIcon)}
      {facebookAvailable && boton('facebook', facebookAvailable, FacebookIcon)}
      {children}
      {error ? (
        <p role='alert' className='text-body-sm text-destructive-foreground'>
          {error}
        </p>
      ) : null}
    </div>
  )
}
