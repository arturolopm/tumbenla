'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, ChevronRight, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { client } from '@/lib/auth/auth-client'
import { DESTINO_POR_DEFECTO, esDestinoValido, leerDestino } from '@/lib/auth/redirect'
import { cn, getBaseUrl } from '@/lib/utils'
import { quickValidateEmail } from '@/lib/messaging/email/validation'
import { SocialLoginButtons } from '../components/social-login-buttons'

const validateEmailField = (emailValue: string): string[] => {
  const errors: string[] = []

  if (!emailValue || !emailValue.trim()) {
    errors.push('Escribe tu correo.')
    return errors
  }

  const validation = quickValidateEmail(emailValue.trim().toLowerCase())
  if (!validation.isValid) {
    errors.push(validation.reason || 'Ese correo no parece valido.')
  }

  return errors
}

const PASSWORD_VALIDATIONS = {
  required: {
    test: (value: string) => Boolean(value && typeof value === 'string'),
    message: 'Escribe tu contraseña.',
  },
  notEmpty: {
    test: (value: string) => value.trim().length > 0,
    message: 'La contraseña no puede ir vacia.',
  },
}

const validatePassword = (passwordValue: string): string[] => {
  const errors: string[] = []

  if (!PASSWORD_VALIDATIONS.required.test(passwordValue)) {
    errors.push(PASSWORD_VALIDATIONS.required.message)
    return errors
  }

  if (!PASSWORD_VALIDATIONS.notEmpty.test(passwordValue)) {
    errors.push(PASSWORD_VALIDATIONS.notEmpty.message)
    return errors
  }

  return errors
}

export default function LoginPage({
  githubAvailable,
  googleAvailable,
  facebookAvailable,
  microsoftAvailable,
  isProduction,
}: {
  githubAvailable: boolean
  googleAvailable: boolean
  facebookAvailable: boolean
  microsoftAvailable: boolean
  isProduction: boolean
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [_mounted, setMounted] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordErrors, setPasswordErrors] = useState<string[]>([])
  const [showValidationError, setShowValidationError] = useState(false)
  const [isButtonHovered, setIsButtonHovered] = useState(false)

  const [callbackUrl, setCallbackUrl] = useState(DESTINO_POR_DEFECTO)

  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false)
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('')
  const [isSubmittingReset, setIsSubmittingReset] = useState(false)
  const [isResetButtonHovered, setIsResetButtonHovered] = useState(false)
  const [resetStatus, setResetStatus] = useState<{
    type: 'success' | 'error' | null
    message: string
  }>({ type: null, message: '' })

  const [email, setEmail] = useState('')
  const [emailErrors, setEmailErrors] = useState<string[]>([])
  const [showEmailValidationError, setShowEmailValidationError] = useState(false)

  useEffect(() => {
    setMounted(true)

    if (!searchParams) {
      return
    }

    setCallbackUrl(leerDestino(searchParams))
  }, [searchParams])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && forgotPasswordOpen) {
        handleForgotPassword()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [forgotPasswordEmail, forgotPasswordOpen])

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value
    setEmail(newEmail)

    const errors = validateEmailField(newEmail)
    setEmailErrors(errors)
    setShowEmailValidationError(false)
  }

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPassword = e.target.value
    setPassword(newPassword)

    const errors = validatePassword(newPassword)
    setPasswordErrors(errors)
    setShowValidationError(false)
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const emailRaw = formData.get('email') as string
    const email = emailRaw.trim().toLowerCase()

    const emailValidationErrors = validateEmailField(email)
    setEmailErrors(emailValidationErrors)
    setShowEmailValidationError(emailValidationErrors.length > 0)

    const passwordValidationErrors = validatePassword(password)
    setPasswordErrors(passwordValidationErrors)
    setShowValidationError(passwordValidationErrors.length > 0)

    if (emailValidationErrors.length > 0 || passwordValidationErrors.length > 0) {
      setIsLoading(false)
      return
    }

    try {
      const safeCallbackUrl = esDestinoValido(callbackUrl) ? callbackUrl : DESTINO_POR_DEFECTO

      const result = await client.signIn.email(
        {
          email,
          password,
          callbackURL: safeCallbackUrl,
        },
        {
          onError: (ctx) => {
            console.error('Login error:', ctx.error)

            if (
              ctx.error.code?.includes('EMAIL_NOT_VERIFIED') ||
              ctx.error.message?.includes('Email not verified') ||
              ctx.error.message?.includes('not verified')
            ) {
              if (typeof window !== 'undefined') {
                sessionStorage.setItem('verificationEmail', email)
              }
              // El destino viaja hasta la verificacion. Sin esto, quien llega
              // por un enlace de invitacion y todavia no ha verificado el
              // correo termina en el despachador y pierde la invitacion.
              router.push(
                `/verify?fromSignup=false&redirectAfter=${encodeURIComponent(safeCallbackUrl)}`
              )
              setIsLoading(false)
              return
            }

            const errorMessage: string[] = ['Correo o contraseña incorrectos']
            if (
              ctx.error.code?.includes('BAD_REQUEST') ||
              ctx.error.message?.includes('Email and password sign in is not enabled')
            ) {
              errorMessage.push('Entrar con correo esta desactivado ahora mismo.')
            } else if (
              ctx.error.code?.includes('INVALID_CREDENTIALS') ||
              ctx.error.message?.includes('invalid password')
            ) {
              errorMessage.push('Correo o contraseña incorrectos. Intenta de nuevo.')
            } else if (
              ctx.error.code?.includes('USER_NOT_FOUND') ||
              ctx.error.message?.includes('not found')
            ) {
              errorMessage.push('No hay ninguna cuenta con ese correo. Crea una primero.')
            } else if (ctx.error.code?.includes('MISSING_CREDENTIALS')) {
              errorMessage.push('Faltan el correo o la contraseña.')
            } else if (ctx.error.code?.includes('EMAIL_PASSWORD_DISABLED')) {
              errorMessage.push('Entrar con correo y contraseña esta desactivado.')
            } else if (ctx.error.code?.includes('FAILED_TO_CREATE_SESSION')) {
              errorMessage.push('No se pudo abrir la sesion. Intenta mas tarde.')
            } else if (ctx.error.code?.includes('too many attempts')) {
              errorMessage.push(
                'Demasiados intentos. Espera un rato o cambia tu contraseña.'
              )
            } else if (ctx.error.code?.includes('account locked')) {
              errorMessage.push(
                'Tu cuenta quedo bloqueada por seguridad. Cambia tu contraseña.'
              )
            } else if (ctx.error.code?.includes('network')) {
              errorMessage.push('Falló la conexion. Revisa tu internet e intenta de nuevo.')
            } else if (ctx.error.message?.includes('rate limit')) {
              errorMessage.push('Demasiadas peticiones. Espera un momento.')
            }

            setPasswordErrors(errorMessage)
            setShowValidationError(true)
          },
        }
      )

      if (!result || result.error) {
        setIsLoading(false)
        return
      }
    } catch (err: any) {
      if (err.message?.includes('not verified') || err.code?.includes('EMAIL_NOT_VERIFIED')) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('verificationEmail', email)
        }
        router.push(`/verify?redirectAfter=${encodeURIComponent(callbackUrl)}`)
        return
      }

      console.error('Uncaught login error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!forgotPasswordEmail) {
      setResetStatus({
        type: 'error',
        message: 'Escribe tu correo',
      })
      return
    }

    const emailValidation = quickValidateEmail(forgotPasswordEmail.trim().toLowerCase())
    if (!emailValidation.isValid) {
      setResetStatus({
        type: 'error',
        message: 'Ese correo no parece valido',
      })
      return
    }

    try {
      setIsSubmittingReset(true)
      setResetStatus({ type: null, message: '' })

      const response = await fetch('/api/auth/forget-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: forgotPasswordEmail,
          redirectTo: `${getBaseUrl()}/reset-password`,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        let errorMessage = errorData.message || 'No se pudo pedir el cambio de contraseña'

        if (
          errorMessage.includes('Invalid body parameters') ||
          errorMessage.includes('invalid email')
        ) {
          errorMessage = 'Ese correo no parece valido'
        } else if (errorMessage.includes('Email is required')) {
          errorMessage = 'Escribe tu correo'
        } else if (
          errorMessage.includes('user not found') ||
          errorMessage.includes('User not found')
        ) {
          errorMessage = 'No hay ninguna cuenta con ese correo'
        }

        throw new Error(errorMessage)
      }

      setResetStatus({
        type: 'success',
        message: 'Te mandamos un enlace para cambiarla.',
      })

      setTimeout(() => {
        setForgotPasswordOpen(false)
        setResetStatus({ type: null, message: '' })
      }, 2000)
    } catch (error) {
      console.error('Error requesting password reset:', { error })
      setResetStatus({
        type: 'error',
        message:
          error instanceof Error ? error.message : 'No se pudo pedir el cambio de contraseña.',
      })
    } finally {
      setIsSubmittingReset(false)
    }
  }

  // Los cuatro, no solo dos: con solo Microsoft configurado el divisor
  // desaparecia y los botones sociales igual se pintaban debajo.
  const hasSocial =
    githubAvailable || googleAvailable || facebookAvailable || microsoftAvailable
  const showDivider = hasSocial

  return (
    <>
      <div className='space-y-2 text-center'>
        <h1 className='font-display font-black text-4xl uppercase leading-none tracking-tighter'>
          Entra
        </h1>
        <p className='text-body-md text-muted-foreground'>
          Para ver tus noches y lo que pusieron.
        </p>
      </div>

      <form onSubmit={onSubmit} className={`mt-8 space-y-8`}>
        <div className='space-y-6'>
          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <Label htmlFor='email'>Correo</Label>
            </div>
            <Input
              id='email'
              name='email'
              placeholder='tu@correo.com'
              required
              autoCapitalize='none'
              size={'lg'}
              autoComplete='email'
              autoCorrect='off'
              value={email}
              onChange={handleEmailChange}
              className={cn(
                'transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30',
                showEmailValidationError &&
                  emailErrors.length > 0 &&
                  'border-destructive focus:border-destructive focus:ring-destructive/30 focus-visible:ring-destructive'
              )}
            />
            {showEmailValidationError && emailErrors.length > 0 && (
              <div className='mt-1 space-y-1 text-body-sm text-destructive-foreground'>
                {emailErrors.map((error, index) => (
                  <p key={index}>{error}</p>
                ))}
              </div>
            )}
          </div>
          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <Label htmlFor='password'>Contraseña</Label>
              <button
                type='button'
                onClick={() => setForgotPasswordOpen(true)}
                className='font-medium text-muted-foreground text-xs transition hover:text-foreground'
              >
                ¿Olvidaste la contraseña?
              </button>
            </div>
            <div className='relative'>
              <Input
                id='password'
                name='password'
                required
                type={showPassword ? 'text' : 'password'}
                autoCapitalize='none'
                autoComplete='current-password'
                autoCorrect='off'
                placeholder='Tu contraseña'
                value={password}
                size={'lg'}
                onChange={handlePasswordChange}
                className={cn(
                  'pr-10 transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30',
                  showValidationError &&
                    passwordErrors.length > 0 &&
                    'border-destructive focus:border-destructive focus:ring-destructive/30 focus-visible:ring-destructive'
                )}
              />
              <button
                type='button'
                onClick={() => setShowPassword(!showPassword)}
                className='-translate-y-1/2 absolute top-1/2 right-3 text-muted-foreground transition-colors hover:text-primary-text'
                aria-label={showPassword ? 'Ocultar la contraseña' : 'Ver la contraseña'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {showValidationError && passwordErrors.length > 0 && (
              <div className='mt-1 space-y-1 text-body-sm text-destructive-foreground'>
                {passwordErrors.map((error, index) => (
                  <p key={index}>{error}</p>
                ))}
              </div>
            )}
          </div>
        </div>

        <Button
          type='submit'
          size='lg'
          onMouseEnter={() => setIsButtonHovered(true)}
          onMouseLeave={() => setIsButtonHovered(false)}
          className='group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-display text-label-lg text-primary-foreground uppercase transition-opacity hover:opacity-90'
          disabled={isLoading}
        >
          <span className='flex items-center gap-1'>
            {isLoading ? 'Entrando…' : 'Entrar'}
            <span className='inline-flex transition-transform duration-200 group-hover:translate-x-0.5'>
              {isButtonHovered ? (
                <ArrowRight className='h-4 w-4' aria-hidden='true' />
              ) : (
                <ChevronRight className='h-4 w-4' aria-hidden='true' />
              )}
            </span>
          </span>
        </Button>
      </form>

      {/* Divider - show when we have multiple auth methods */}
      {showDivider && (
        <div className='relative my-6 font-light'>
          <div className='absolute inset-0 flex items-center'>
            <div className='w-full border-border border-t' />
          </div>
          <div className='relative flex justify-center text-sm'>
            <span className='bg-background px-4 text-muted-foreground'>o entra con</span>
          </div>
        </div>
      )}

      {hasSocial && (
        <div>
          <SocialLoginButtons
            googleAvailable={googleAvailable}
            githubAvailable={githubAvailable}
            facebookAvailable={facebookAvailable}
            microsoftAvailable={microsoftAvailable}
            isProduction={isProduction}
            callbackURL={callbackUrl}
          />
        </div>
      )}

      <div className='pt-6 text-center text-[14px] font-light'>
        <span>¿Todavia no tienes cuenta? </span>
        <Link
          href={`/register?redirectAfter=${encodeURIComponent(callbackUrl)}`}
          className='font-display text-primary-text uppercase underline-offset-4 hover:underline'
        >
          Crea una
        </Link>
      </div>

      <div className='absolute inset-x-0 bottom-0 px-8 pb-8 text-center text-[13px] font-[340] leading-relaxed text-muted-foreground sm:px-8 md:px-[44px]'>
        Al entrar aceptas los{' '}
        <Link
          href='/terminos'
          target='_blank'
          rel='noopener noreferrer'
          className='text-primary-text underline-offset-4 transition hover:underline'
        >
          términos
        </Link>{' '}
        y la{' '}
        <Link
          href='/privacidad'
          target='_blank'
          rel='noopener noreferrer'
          className='text-primary-text underline-offset-4 transition hover:underline'
        >
          política de privacidad
        </Link>
      </div>

      <Dialog open={forgotPasswordOpen} onOpenChange={setForgotPasswordOpen}>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle className='font-display font-bold text-headline-md uppercase'>
              Recuperar la contraseña
            </DialogTitle>
            <DialogDescription className='text-body-md text-muted-foreground'>
              Escribe tu correo. Si hay una cuenta con ese correo, te llega un enlace para
              ponerle una contraseña nueva.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className='space-y-4'>
            <div className='space-y-2'>
              <div className='flex items-center justify-between'>
                <Label htmlFor='reset-email'>Correo</Label>
              </div>
              <Input
                id='reset-email'
                value={forgotPasswordEmail}
                onChange={(event) => setForgotPasswordEmail(event.target.value)}
                placeholder='tu@correo.com'
                size={'lg'}
                type='email'
                className={cn(
                  'transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30',
                  resetStatus.type === 'error' &&
                    'border-destructive focus:border-destructive focus:ring-destructive/30 focus-visible:ring-destructive'
                )}
              />
              {resetStatus.type === 'error' && (
                <div className='mt-1 space-y-1 text-body-sm text-destructive-foreground'>
                  <p>{resetStatus.message}</p>
                </div>
              )}
            </div>
            {resetStatus.type === 'success' && (
              <div className='mt-1 space-y-1 text-xs text-success-foreground'>
                <p>{resetStatus.message}</p>
              </div>
            )}
          </DialogPanel>
          <DialogFooter>
            <Button
              type='button'
              onClick={handleForgotPassword}
              onMouseEnter={() => setIsResetButtonHovered(true)}
              onMouseLeave={() => setIsResetButtonHovered(false)}
              className='group inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-display text-label-lg text-primary-foreground uppercase transition-opacity hover:opacity-90'
              disabled={isSubmittingReset}
            >
              <span className='flex items-center gap-1'>
                {isSubmittingReset ? 'Mandando…' : 'Mandar el enlace'}
                <span className='inline-flex transition-transform duration-200 group-hover:translate-x-0.5'>
                  {isResetButtonHovered ? (
                    <ArrowRight className='h-4 w-4' aria-hidden='true' />
                  ) : (
                    <ChevronRight className='h-4 w-4' aria-hidden='true' />
                  )}
                </span>
              </span>
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </>
  )
}
