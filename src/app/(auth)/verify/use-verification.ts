'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { client, useSession } from '@/lib/auth/auth-client'
import { DESTINO_POR_DEFECTO, esDestinoValido } from '@/lib/auth/redirect'

interface UseVerificationParams {
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
  isContextReady: boolean
  verifyCode: () => Promise<void>
  resendCode: () => Promise<boolean>
  handleOtpChange: (value: string) => void
}

const getOtpType = (fromSignup: boolean) => (fromSignup ? 'email-verification' : 'sign-in')

/**
 * The URL parameter wins over sessionStorage: it belongs to the link that was
 * actually opened. Both are validated because both are browser-controlled.
 */
const resolveDestination = (params: URLSearchParams): string => {
  const fromLink = params.get('redirectAfter')
  if (fromLink && esDestinoValido(fromLink)) return fromLink

  if (typeof window !== 'undefined') {
    const stored = sessionStorage.getItem('inviteRedirectUrl')
    if (stored && esDestinoValido(stored)) return stored
  }

  return DESTINO_POR_DEFECTO
}

const messageForOtpError = (error: unknown, fallback: string) => {
  const text =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : typeof error === 'object' && error
          ? `${'message' in error && typeof error.message === 'string' ? error.message : ''} ${
              'code' in error && typeof error.code === 'string' ? error.code : ''
            }`
          : ''

  const normalized = text.toLowerCase()
  if (normalized.includes('expired')) return 'Ese código ya venció. Pide uno nuevo.'
  if (normalized.includes('attempt')) return 'Demasiados intentos. Pide un código nuevo.'
  if (normalized.includes('invalid')) return 'Ese código no es. Revísalo e intenta de nuevo.'

  return fallback
}

/**
 * Keeps only the state that is displayed or genuinely asynchronous. Context
 * readiness derives from the session and resolved email; it is not a second
 * state machine. Typing the sixth digit starts verification directly, so the
 * old timer effect cannot race a manual click or an OTP correction.
 */
export function useVerification({
  initialEmail = null,
}: UseVerificationParams): UseVerificationReturn {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, isPending: isSessionPending, refetch: refetchSession } = useSession()
  const [otp, setOtp] = useState('')
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [isInvalidOtp, setIsInvalidOtp] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const initialOtpEmail = useRef<string | null>(null)
  const verificationInFlight = useRef(false)
  const fromSignup = searchParams.get('fromSignup') === 'true'
  const isContextReady = !isSessionPending && Boolean(email)

  useEffect(() => {
    if (isSessionPending) return

    if (session?.user.emailVerified) {
      window.location.assign(resolveDestination(searchParams))
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

    setEmail((current) => (current === resolvedEmail ? current : resolvedEmail))
    if (!storedEmail) sessionStorage.setItem('verificationEmail', resolvedEmail)
  }, [
    initialEmail,
    isSessionPending,
    router,
    searchParams,
    session?.user.email,
    session?.user.emailVerified,
  ])

  const sendOtp = useCallback(
    async (failureMessage: string) => {
      if (!email) return false

      setIsLoading(true)
      setErrorMessage('')

      try {
        const response = await client.emailOtp.sendVerificationOtp({
          email,
          type: getOtpType(fromSignup),
        })

        if (!response || response.error) {
          setErrorMessage(messageForOtpError(response?.error, failureMessage))
          return false
        }

        return true
      } catch (error) {
        setErrorMessage(messageForOtpError(error, failureMessage))
        return false
      } finally {
        setIsLoading(false)
      }
    },
    [email, fromSignup]
  )

  useEffect(() => {
    if (!email || initialOtpEmail.current === email) return

    initialOtpEmail.current = email
    void sendOtp('No se pudo mandar el código. Revisa el correo y pide otro.')
  }, [email, sendOtp])

  const verifyCode = useCallback(
    async (submittedOtp = otp) => {
      if (submittedOtp.length !== 6 || !email || verificationInFlight.current) return

      verificationInFlight.current = true
      setIsLoading(true)
      setIsInvalidOtp(false)
      setErrorMessage('')

      try {
        const response = fromSignup
          ? await client.emailOtp.verifyEmail({ email, otp: submittedOtp })
          : await client.signIn.emailOtp({ email, otp: submittedOtp })

        if (response && !response.error) {
          setIsVerified(true)

          try {
            await refetchSession()
          } catch (error) {
            console.warn('Failed to refetch session after verification', error)
          }

          sessionStorage.removeItem('verificationEmail')
          window.setTimeout(() => {
            window.location.assign(resolveDestination(searchParams))
          }, 1000)
          return
        }

        setIsInvalidOtp(true)
        setErrorMessage(
          messageForOtpError(response?.error, 'Ese código no es. Revísalo e intenta de nuevo.')
        )
        setOtp('')
      } catch (error) {
        setIsInvalidOtp(true)
        setErrorMessage(
          messageForOtpError(error, 'No se pudo verificar. Revisa el código e intenta de nuevo.')
        )
        setOtp('')
      } finally {
        verificationInFlight.current = false
        setIsLoading(false)
      }
    },
    [email, fromSignup, otp, refetchSession, searchParams]
  )

  const resendCode = useCallback(
    () => sendOtp('No se pudo mandar otro código. Intenta más tarde.'),
    [sendOtp]
  )

  const handleOtpChange = useCallback(
    (value: string) => {
      const nextOtp = value.replace(/\D/g, '').slice(0, 6)
      setOtp(nextOtp)

      if (nextOtp.length !== 6) return

      setIsInvalidOtp(false)
      setErrorMessage('')
      void verifyCode(nextOtp)
    },
    [verifyCode]
  )

  return {
    otp,
    email,
    isLoading,
    isVerified,
    isInvalidOtp,
    errorMessage,
    isOtpComplete: otp.length === 6,
    isContextReady,
    verifyCode,
    resendCode,
    handleOtpChange,
  }
}
