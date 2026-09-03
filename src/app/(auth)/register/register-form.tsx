'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { ArrowRight, ChevronRight, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { client } from '@/lib/auth/auth-client'
import { DESTINO_POR_DEFECTO, leerDestino } from '@/lib/auth/redirect'
import { type RegisterInput, normalizeEmail, registerSchema } from '@/lib/auth/schemas'
import { cn } from '@/lib/utils'
import { SocialLoginButtons } from '../components/social-login-buttons'
import { mensajeDeError } from '../fallo-de-red'

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

/**
 * Validation lives in `@/lib/auth/schemas`, applied by react-hook-form's zod
 * resolver. See the note in the login form: the two files used to define
 * conflicting `PASSWORD_VALIDATIONS` objects, and reading the password from
 * React state instead of the form was a real bug under browser autofill.
 */
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

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    mode: 'onBlur',
  })

  // Registered once so the blur wrapper can still call RHF's own handler.
  const emailField = register('email')
  const [, setMounted] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isButtonHovered, setIsButtonHovered] = useState(false)

  const [submitError, setSubmitError] = useState('')

  const [callbackUrl, setCallbackUrl] = useState(DESTINO_POR_DEFECTO)

  useEffect(() => {
    setMounted(true)
    setCallbackUrl(leerDestino(searchParams))

    // Quien llega desde un pedido ya escribio su correo una vez, de pie y en un
    // bar. Volver a pedirselo es la friccion que hace que no termine la cuenta,
    // y ademas es lo que AMARRA el pedido que acaba de hacer: si escribe otro
    // correo, su historia nace incompleta y no hay como repararla despues.
    const prefilledEmail = searchParams?.get('correo')
    if (prefilledEmail) setValue('email', prefilledEmail)
  }, [searchParams, setValue])

  // RHF delivers data already parsed by the schema: name trimmed, email
  // lowercased, password length checked. No FormData reading and no manual
  // validation pass, so the value validated is the value submitted.
  const onSubmit = handleSubmit(
    async ({ name: nameValue, email: emailValue, password: passwordValue }) => {
      setIsLoading(true)
      setSubmitError('')

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

        router.push(`/verify?fromSignup=true&redirectAfter=${encodeURIComponent(callbackUrl)}`)
      } catch (error) {
        console.error('Signup error:', error)
        // Estaba en ingles en una app que es toda en espanol, y decia lo mismo
        // tanto si el servidor rechazo el registro como si la peticion nunca
        // salio del navegador. Son dos problemas distintos y solo uno se
        // arregla reintentando.
        setSubmitError(mensajeDeError(error, 'No se pudo crear tu cuenta. Intenta de nuevo.'))
      } finally {
        setIsLoading(false)
      }
    }
  )

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

      <form onSubmit={onSubmit} className='mt-8 space-y-8'>
        <div className='space-y-6'>
          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <Label htmlFor='name'>Nombre</Label>
            </div>
            <Input
              id='name'
              placeholder='Como te dicen'
              autoCapitalize='words'
              autoComplete='name'
              size='lg'
              aria-invalid={Boolean(errors.name)}
              {...register('name')}
              className={cn(
                'transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30',
                errors.name &&
                  'border-destructive focus:border-destructive focus:ring-destructive/30 focus-visible:ring-destructive'
              )}
            />
            {errors.name ? (
              <p role='alert' className='mt-1 text-body-sm text-destructive-foreground'>
                {errors.name.message}
              </p>
            ) : null}
          </div>

          <div className='space-y-2'>
            <div className='flex items-center justify-between'>
              <Label htmlFor='email'>Correo</Label>
            </div>
            <Input
              id='email'
              placeholder='tu@correo.com'
              autoCapitalize='none'
              autoComplete='email'
              autoCorrect='off'
              size='lg'
              aria-invalid={Boolean(errors.email)}
              {...emailField}
              onBlur={(event) => {
                // Rewrites the box, not just the submitted value: seeing the
                // spaces disappear is how you know the field took it.
                const clean = normalizeEmail(event.target.value)
                if (clean !== event.target.value) {
                  setValue('email', clean, { shouldValidate: true })
                }
                void emailField.onBlur(event)
              }}
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
            </div>
            <div className='relative'>
              <Input
                id='password'
                type={showPassword ? 'text' : 'password'}
                autoCapitalize='none'
                autoComplete='new-password'
                autoCorrect='off'
                placeholder='Al menos 8 caracteres'
                size='lg'
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
