'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
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
import { type LoginInput, emailOnlySchema, loginSchema } from '@/lib/auth/schemas'
import { cn, getBaseUrl } from '@/lib/utils'
import { SocialLoginButtons } from '../components/social-login-buttons'
import { mensajeDeError } from '../fallo-de-red'

/**
 * Validation lives in `@/lib/auth/schemas` and is applied by react-hook-form
 * through its zod resolver.
 *
 * What used to be here: two hand-written validators, a `PASSWORD_VALIDATIONS`
 * object that disagreed with the register form's object of the same name, and
 * one `useState` per field plus an error array plus a "show error" flag each.
 * That machinery is what let the real bug through — the email was read from the
 * DOM and the password from React state, so browser autofill submitted an empty
 * password while the field showed dots.
 */
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

  // One hook replaces the per-field state, the error arrays and the
  // "show error" flags. `register` binds the input to the form, so what gets
  // validated and what gets submitted are the same value by construction —
  // browser autofill included.
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
  })
  const [_mounted, setMounted] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
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

  // RHF hands over data already parsed by the schema: trimmed, lowercased and
  // guaranteed present. No FormData reading, no manual validation pass.
  const onSubmit = handleSubmit(async ({ email, password }) => {
    setIsLoading(true)

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
              errorMessage.push('Demasiados intentos. Espera un rato o cambia tu contraseña.')
            } else if (ctx.error.code?.includes('account locked')) {
              errorMessage.push('Tu cuenta quedo bloqueada por seguridad. Cambia tu contraseña.')
            } else if (ctx.error.code?.includes('network')) {
              errorMessage.push('Falló la conexion. Revisa tu internet e intenta de nuevo.')
            } else if (ctx.error.message?.includes('rate limit')) {
              errorMessage.push('Demasiadas peticiones. Espera un momento.')
            }

            setError('root', { message: errorMessage.join(' ') })
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

      // NO se traga el error. Aca cae lo que nunca llego al servidor —el fetch
      // rechazado— y antes solo se registraba en la consola: el formulario se
      // desbloqueaba sin decir nada y parecia que el boton no servia.
      console.error('Uncaught login error:', err)
      // A form-level error, not a field one: nothing is wrong with what they
      // typed. `root` is RHF's slot for exactly this.
      setError('root', {
        message: mensajeDeError(err, 'No se pudo entrar. Intenta de nuevo.'),
      })
    } finally {
      setIsLoading(false)
    }
  })

  const handleForgotPassword = async () => {
    if (!forgotPasswordEmail) {
      setResetStatus({
        type: 'error',
        message: 'Escribe tu correo',
      })
      return
    }

    // Same schema the form uses, so "valid email" means one thing in this file
    // and not two.
    const parsed = emailOnlySchema.safeParse({ email: forgotPasswordEmail })
    if (!parsed.success) {
      setResetStatus({
        type: 'error',
        message: parsed.error.issues[0]?.message ?? 'Ese correo no se ve bien.',
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
  const hasSocial = githubAvailable || googleAvailable || facebookAvailable || microsoftAvailable
  const showDivider = hasSocial

  return (
    <>
      <div className='space-y-2 text-center'>
        <h1 className='font-display font-black text-4xl uppercase leading-none tracking-tighter'>
          Entra
        </h1>
        <p className='text-body-md text-muted-foreground'>Para ver tus noches y lo que pusieron.</p>
      </div>

      <form onSubmit={onSubmit} className={`mt-8 space-y-8`}>
        <div className='space-y-6'>
          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <Label htmlFor='email'>Correo</Label>
            </div>
            <Input
              id='email'
              placeholder='tu@correo.com'
              autoCapitalize='none'
              size={'lg'}
              autoComplete='email'
              autoCorrect='off'
              aria-invalid={Boolean(errors.email)}
              {...register('email')}
              className={cn(
                'transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30',
                errors.email &&
                  'border-destructive focus:border-destructive focus:ring-destructive/30 focus-visible:ring-destructive'
              )}
            />
            {errors.email ? (
              <p role='alert' className='mt-1 text-body-sm text-destructive-foreground'>
                {errors.email.message}
              </p>
            ) : null}
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
                type={showPassword ? 'text' : 'password'}
                autoCapitalize='none'
                autoComplete='current-password'
                autoCorrect='off'
                placeholder='Tu contraseña'
                size={'lg'}
                aria-invalid={Boolean(errors.password)}
                {...register('password')}
                className={cn(
                  'pr-10 transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30',
                  errors.password &&
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
            {errors.password ? (
              <p role='alert' className='mt-1 text-body-sm text-destructive-foreground'>
                {errors.password.message}
              </p>
            ) : null}
          </div>

          {/* Whatever is not a field problem: bad credentials, a locked
              account, a request that never left the browser. */}
          {errors.root ? (
            <p role='alert' className='text-body-sm text-destructive-foreground'>
              {errors.root.message}
            </p>
          ) : null}
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
              Escribe tu correo. Si hay una cuenta con ese correo, te llega un enlace para ponerle
              una contraseña nueva.
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
