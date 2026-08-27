'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { client, useSession } from '@/lib/auth/auth-client'
import { DESTINO_POR_DEFECTO, esDestinoValido } from '@/lib/auth/redirect'

interface UseVerificationParams {
  isProduction: boolean
  initialEmail?: string | null
}

interface UseVerificationReturn {
  otp: string
  email: string
  isLoading: boolean
  isVerified: boolean
  isInvalidOtp: boolean
  errorMessage: string
  isOtpComplete: boolean
  isProduction: boolean
  isContextReady: boolean
  verifyCode: () => Promise<void>
  resendCode: () => void
  handleOtpChange: (value: string) => void
}

const getOtpType = (fromSignup: boolean) => (fromSignup ? 'email-verification' : 'sign-in')

/**
 * A donde va la persona cuando termina de verificar.
 *
 * Se resuelve LEYENDO, no guardando en estado. Antes esto vivia en un useState
 * que llenaba un efecto, y el efecto que redirige corria en el mismo commit:
 * leia la cadena vacia, navegaba al despachador, y el destino real llegaba un
 * render tarde, cuando la navegacion ya habia empezado. Quien llegaba por un
 * enlace de invitacion lo perdia justo ahi.
 *
 * El parametro le gana a sessionStorage: es lo que trae el enlace que la
 * persona acaba de abrir. Los dos se validan porque los dos los puede escribir
 * alguien mas.
 */
const resolverDestino = (params: URLSearchParams): string => {
  const delEnlace = params.get('redirectAfter')
  if (delEnlace && esDestinoValido(delEnlace)) return delEnlace

  if (typeof window !== 'undefined') {
    const guardado = sessionStorage.getItem('inviteRedirectUrl')
    if (guardado && esDestinoValido(guardado)) return guardado
  }

  return DESTINO_POR_DEFECTO
}

export function useVerification({
  isProduction,
  initialEmail = null,
}: UseVerificationParams): UseVerificationReturn {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, isPending: isSessionPending, refetch: refetchSession } = useSession()
  const [otp, setOtp] = useState('')
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [isSendingInitialOtp, setIsSendingInitialOtp] = useState(false)
  const [isInvalidOtp, setIsInvalidOtp] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [isContextReady, setIsContextReady] = useState(false)

  useEffect(() => {
    if (isSessionPending) {
      return
    }

    if (session?.user.emailVerified) {
      window.location.href = resolverDestino(searchParams)
      return
    }

    const storedEmail = sessionStorage.getItem('verificationEmail')?.trim().toLowerCase() ?? ''
    const sessionEmail = session?.user.email?.trim().toLowerCase() ?? ''
    const serverEmail = initialEmail?.trim().toLowerCase() ?? ''
    const resolvedEmail = storedEmail || sessionEmail || serverEmail

    if (!resolvedEmail) {
      router.replace('/register')
      return
    }

    setEmail(resolvedEmail)

    if (!storedEmail) {
      sessionStorage.setItem('verificationEmail', resolvedEmail)
    }

    setIsContextReady(true)
  }, [initialEmail, isSessionPending, router, searchParams, session])

  useEffect(() => {
    const fromSignup = searchParams.get('fromSignup') === 'true'

    if (!isContextReady || !email || isSendingInitialOtp) {
      return
    }

    setIsSendingInitialOtp(true)
    setIsLoading(true)
    setErrorMessage('')

    const normalizedEmail = email.trim().toLowerCase()
    client.emailOtp
      .sendVerificationOtp({
        email: normalizedEmail,
        type: getOtpType(fromSignup),
      })
      .catch(() => {
        setErrorMessage('No se pudo mandar el código. Revisa el correo y pide otro.')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [email, isContextReady, isSendingInitialOtp, searchParams])

  const isOtpComplete = otp.length === 6

  async function verifyCode() {
    if (!isOtpComplete || !email) return

    setIsLoading(true)
    setIsInvalidOtp(false)
    setErrorMessage('')

    try {
      const normalizedEmail = email.trim().toLowerCase()
      const fromSignup = searchParams.get('fromSignup') === 'true'

      const response = fromSignup
        ? await client.emailOtp.verifyEmail({
            email: normalizedEmail,
            otp,
          })
        : await client.signIn.emailOtp({
            email: normalizedEmail,
            otp,
          })

      if (response && !response.error) {
        setIsVerified(true)

        try {
          await refetchSession()
        } catch (e) {
          console.warn('Failed to refetch session after verification', e)
        }

        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('verificationEmail')
        }

        setTimeout(() => {
          window.location.href = resolverDestino(searchParams)
        }, 1000)
      } else {
        const message = 'Ese código no es. Revísalo e intenta de nuevo.'
        setIsInvalidOtp(true)
        setErrorMessage(message)
        setOtp('')
      }
    } catch (error: unknown) {
      let message = 'No se pudo verificar. Revisa el código e intenta de nuevo.'
      const errorMessageText =
        error instanceof Error ? error.message : typeof error === 'string' ? error : ''

      if (errorMessageText.includes('expired')) {
        message = 'Ese código ya venció. Pide uno nuevo.'
      } else if (errorMessageText.includes('invalid')) {
        message = 'Ese código no es. Revísalo e intenta de nuevo.'
      } else if (errorMessageText.includes('attempts')) {
        message = 'Demasiados intentos. Pide un código nuevo.'
      }

      setIsInvalidOtp(true)
      setErrorMessage(message)
      setOtp('')
    } finally {
      setIsLoading(false)
    }
  }

  function resendCode() {
    if (!email) return

    setIsLoading(true)
    setErrorMessage('')

    const normalizedEmail = email.trim().toLowerCase()
    const fromSignup = searchParams.get('fromSignup') === 'true'

    client.emailOtp
      .sendVerificationOtp({
        email: normalizedEmail,
        type: getOtpType(fromSignup),
      })
      .catch(() => {
        setErrorMessage('No se pudo mandar otro código. Intenta más tarde.')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  function handleOtpChange(value: string) {
    if (value.length === 6) {
      setIsInvalidOtp(false)
      setErrorMessage('')
    }
    setOtp(value)
  }

  useEffect(() => {
    if (otp.length === 6 && email && !isLoading && !isVerified && isContextReady) {
      const timeoutId = setTimeout(() => {
        void verifyCode()
      }, 300)

      return () => clearTimeout(timeoutId)
    }
  }, [otp, email, isLoading, isVerified, isContextReady])

  return {
    otp,
    email,
    isLoading,
    isVerified,
    isInvalidOtp,
    errorMessage,
    isOtpComplete,
    isProduction,
    isContextReady,
    verifyCode,
    resendCode,
    handleOtpChange,
  }
}
