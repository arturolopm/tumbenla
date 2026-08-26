'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, ChevronRight, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { client } from '@/lib/auth/auth-client'
import { DESTINO_POR_DEFECTO, leerDestino } from '@/lib/auth/redirect'
import { cn } from '@/lib/utils'
import { quickValidateEmail } from '@/lib/messaging/email/validation'
import { SocialLoginButtons } from '../components/social-login-buttons'

const getSignUpErrorMessage = (error: { message?: string; code?: string } | null | undefined) => {
  if (!error) {
    return 'No se pudo crear tu cuenta. Intenta de nuevo.'
  }

  if (isDuplicateEmailError(error)) {
    return 'Ya hay una cuenta con ese correo. Entra con ella, o usa otro correo.'
  }

  return error.message || 'No se pudo crear tu cuenta. Intenta de nuevo.'
}

function isDuplicateEmailError(error: { message?: string; code?: string } | null | undefined) {
  if (!error) {
    return false
  }

  const code = error.code?.toUpperCase() ?? ''
  const message = error.message?.toLowerCase() ?? ''

  return (
    code.includes('USER_ALREADY_EXISTS') ||
    code.includes('EMAIL_ALREADY_EXISTS') ||
    message.includes('already exists') ||
    message.includes('use another email')
  )
}

type PrepareSignupEmailResult = 'ready' | 'verified_exists' | 'failed'

/** Clears an abandoned unverified signup so register can proceed without a failed retry. */
async function prepareSignupEmail(email: string): Promise<PrepareSignupEmailResult> {
  const response = await fetch('/api/auth/clear-unverified-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })

  if (!response.ok) {
    return 'failed'
  }

  const data = (await response.json()) as { result?: string; canResume?: boolean }

  if (data.result === 'verified_exists') {
    return 'verified_exists'
  }

  if (data.canResume) {
    return 'ready'
  }

  return 'failed'
}

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
  minLength: {
    test: (value: string) => value.length >= 8,
    message: 'La contraseña necesita al menos 8 caracteres.',
  },
}

const validatePassword = (passwordValue: string): string[] => {
  const errors: string[] = []

  if (!PASSWORD_VALIDATIONS.minLength.test(passwordValue)) {
    errors.push(PASSWORD_VALIDATIONS.minLength.message)
  }

  return errors
}

export default function RegisterForm({
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
  const [, setMounted] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordErrors, setPasswordErrors] = useState<string[]>([])
  const [showValidationError, setShowValidationError] = useState(false)
  const [isButtonHovered, setIsButtonHovered] = useState(false)

  const [name, setName] = useState('')
  const [nameErrors, setNameErrors] = useState<string[]>([])
  const [showNameValidationError, setShowNameValidationError] = useState(false)

  const [email, setEmail] = useState('')
  const [emailErrors, setEmailErrors] = useState<string[]>([])
  const [showEmailValidationError, setShowEmailValidationError] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const [callbackUrl, setCallbackUrl] = useState(DESTINO_POR_DEFECTO)

  useEffect(() => {
    setMounted(true)
    setCallbackUrl(leerDestino(searchParams))
  }, [searchParams])

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setName(value)

    const trimmed = value.trim()
    const errors: string[] = []

    if (!trimmed) {
      errors.push('Escribe tu nombre.')
    }

    setNameErrors(errors)
    setShowNameValidationError(false)
  }

  const handleEmailChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = event.target.value
    setEmail(newEmail)

    const errors = validateEmailField(newEmail)
    setEmailErrors(errors)
    setShowEmailValidationError(false)
  }

  const handlePasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newPassword = event.target.value
    setPassword(newPassword)

    const errors = validatePassword(newPassword)
    setPasswordErrors(errors)
    setShowValidationError(false)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setSubmitError('')

    const formData = new FormData(event.currentTarget)
    const emailRaw = formData.get('email') as string
    const emailValue = emailRaw.trim().toLowerCase()
    const passwordValue = password
    const nameValue = (formData.get('name') as string).trim()

    const nameValidationErrors: string[] = []
    if (!nameValue) {
      nameValidationErrors.push('Escribe tu nombre.')
    }
    setNameErrors(nameValidationErrors)
    setShowNameValidationError(nameValidationErrors.length > 0)

    const emailValidationErrors = validateEmailField(emailValue)
    setEmailErrors(emailValidationErrors)
    setShowEmailValidationError(emailValidationErrors.length > 0)

    const passwordValidationErrors = validatePassword(passwordValue)
    setPasswordErrors(passwordValidationErrors)
    setShowValidationError(passwordValidationErrors.length > 0)

    if (
      nameValidationErrors.length > 0 ||
      emailValidationErrors.length > 0 ||
      passwordValidationErrors.length > 0
    ) {
      setIsLoading(false)
      return
    }

    try {
      const prep = await prepareSignupEmail(emailValue)

      if (prep === 'verified_exists') {
        setSubmitError(getSignUpErrorMessage({ code: 'USER_ALREADY_EXISTS' }))
        setIsLoading(false)
        return
      }

      if (prep === 'failed') {
        setSubmitError('No se pudo empezar el registro. Intenta de nuevo.')
        setIsLoading(false)
        return
      }

      const response = await client.signUp.email(
        {
          email: emailValue,
          password: passwordValue,
          name: nameValue,
        },
        {}
      )

      if (!response || response.error) {
        setSubmitError(getSignUpErrorMessage(response?.error))
        setIsLoading(false)
        return
      }

      if (typeof window !== 'undefined') {
        sessionStorage.setItem('verificationEmail', emailValue)
      }

      router.push(
        `/verify?fromSignup=true&redirectAfter=${encodeURIComponent(callbackUrl)}`
      )
    } catch (error) {
      console.error('Signup error:', error)
      setSubmitError('Could not create your account. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const hasSocial = githubAvailable || googleAvailable || facebookAvailable || microsoftAvailable
  const showDivider = hasSocial

  return (
    <>
      <div className='space-y-2 text-center'>
        <h1 className='font-display font-black text-4xl uppercase leading-none tracking-tighter'>
          Crea tu cuenta
        </h1>
        <p className='text-body-md text-muted-foreground'>
          Para guardar tus noches y ver lo que pusieron.
        </p>
      </div>

      <form onSubmit={handleSubmit} className='mt-8 space-y-8'>
        <div className='space-y-6'>
          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <Label htmlFor='name'>Nombre</Label>
            </div>
            <Input
              id='name'
              name='name'
              placeholder='Como te dicen'
              autoCapitalize='words'
              autoComplete='name'
              value={name}
              onChange={handleNameChange}
              size='lg'
              className={cn(
                'transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30',
                showNameValidationError &&
                  nameErrors.length > 0 &&
                  'border-destructive focus:border-destructive focus:ring-destructive/30 focus-visible:ring-destructive'
              )}
            />
            {showNameValidationError && nameErrors.length > 0 && (
              <div className='mt-1 space-y-1 text-body-sm text-destructive-foreground'>
                {nameErrors.map((error, index) => (
                  <p key={index}>{error}</p>
                ))}
              </div>
            )}
          </div>

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
              autoComplete='email'
              autoCorrect='off'
              value={email}
              onChange={handleEmailChange}
              size='lg'
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
            </div>
            <div className='relative'>
              <Input
                id='password'
                name='password'
                required
                type={showPassword ? 'text' : 'password'}
                autoCapitalize='none'
                autoComplete='new-password'
                autoCorrect='off'
                placeholder='Al menos 8 caracteres'
                value={password}
                size='lg'
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

        {submitError ? (
          <p className='text-center text-body-sm text-destructive-foreground' role='alert'>
            {submitError}{' '}
            {submitError.includes('Ya hay una cuenta') ? (
              <Link href='/login' className='underline underline-offset-2'>
                Entrar
              </Link>
            ) : null}
          </p>
        ) : null}

        <Button
          type='submit'
          size='lg'
          onMouseEnter={() => setIsButtonHovered(true)}
          onMouseLeave={() => setIsButtonHovered(false)}
          className='group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-display text-label-lg text-primary-foreground uppercase transition-opacity hover:opacity-90'
          disabled={isLoading}
        >
          <span className='flex items-center gap-1'>
            {isLoading ? 'Creando…' : 'Crear cuenta'}
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
        <span>¿Ya tienes cuenta? </span>
        <Link
          href={`/login?redirectAfter=${encodeURIComponent(callbackUrl)}`}
          className='font-display text-primary-text uppercase underline-offset-4 hover:underline'
        >
          Entra
        </Link>
      </div>

      <div className='absolute inset-x-0 bottom-0 px-8 pb-8 text-center text-[13px] font-[340] leading-relaxed text-muted-foreground sm:px-8 md:px-[44px]'>
        Al crear la cuenta aceptas los{' '}
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
    </>
  )
}
