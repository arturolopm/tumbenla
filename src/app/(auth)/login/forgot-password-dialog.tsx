'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

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
import { type EmailOnlyInput, emailOnlySchema, normalizeEmail } from '@/lib/auth/schemas'
import { cn, getBaseUrl } from '@/lib/utils'
import { mensajeDeError } from '../fallo-de-red'

/**
 * "¿Olvidaste la contraseña?"
 *
 * WHY ITS OWN FILE: this lived inside the login form as ~120 lines with its own
 * `email` state, its own status state, and a `window.addEventListener('keydown')`
 * effect whose only job was to make Enter submit — a hand-rolled reimplementation
 * of what a `<form onSubmit>` does for free, complete with a stale-closure
 * dependency list. Pulling it out makes the login form readable and lets the
 * dialog be a real form.
 *
 * WHAT WAS BROKEN: it `fetch`ed `/api/auth/forget-password` with the path
 * hardcoded. Better-Auth 1.4 removed that route — it is `/request-password-reset`
 * now — so the dialog answered every attempt with an error and nobody could
 * recover a password from here. Going through `client.requestPasswordReset`
 * instead means the SDK owns the path and a version bump like that one cannot
 * silently break it again.
 *
 * The response is deliberately the same whether or not the address has an
 * account ("Si hay una cuenta…"), so this never becomes an account-enumeration
 * oracle.
 */
export function ForgotPasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [sent, setSent] = useState(false)
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EmailOnlyInput>({
    resolver: zodResolver(emailOnlySchema),
    mode: 'onBlur',
  })

  const emailField = register('email')

  const onSubmit = handleSubmit(async ({ email }) => {
    setSent(false)

    try {
      const { error } = await client.requestPasswordReset({
        email,
        redirectTo: `${getBaseUrl()}/reset-password`,
      })

      if (error) {
        setError('root', {
          message: mensajeDeError(
            error,
            'No se pudo pedir el cambio de contraseña. Intenta de nuevo.'
          ),
        })
        return
      }

      setSent(true)
    } catch (error) {
      setError('root', {
        message: mensajeDeError(
          error,
          'No se pudo pedir el cambio de contraseña. Intenta de nuevo.'
        ),
      })
    }
  })

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      reset()
      setSent(false)
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPopup>
        <DialogHeader>
          <DialogTitle className='font-display font-bold text-headline-md uppercase'>
            Recuperar la contraseña
          </DialogTitle>
          <DialogDescription className='text-body-md text-muted-foreground'>
            Escribe tu correo. Si hay una cuenta con ese correo, te llega un enlace para ponerle una
            contraseña nueva.
          </DialogDescription>
        </DialogHeader>

        {/* A real form: Enter submits, no keydown listener. */}
        <form onSubmit={onSubmit}>
          <DialogPanel className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='reset-email'>Correo</Label>
              <Input
                id='reset-email'
                type='email'
                placeholder='tu@correo.com'
                size='lg'
                autoComplete='email'
                aria-invalid={Boolean(errors.email)}
                {...emailField}
                onBlur={(event) => {
                  const clean = normalizeEmail(event.target.value)
                  if (clean !== event.target.value) {
                    setValue('email', clean, { shouldValidate: true })
                  }
                  void emailField.onBlur(event)
                }}
                className={cn(
                  'transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30',
                  (errors.email || errors.root) &&
                    'border-destructive focus:border-destructive focus:ring-destructive/30 focus-visible:ring-destructive'
                )}
              />
              {errors.email ? (
                <p role='alert' className='mt-1 text-body-sm text-destructive-foreground'>
                  {errors.email.message}
                </p>
              ) : null}
              {errors.root ? (
                <p role='alert' className='mt-1 text-body-sm text-destructive-foreground'>
                  {errors.root.message}
                </p>
              ) : null}
            </div>
            {sent ? (
              <p className='mt-1 text-xs text-success-foreground'>
                Te mandamos un enlace para cambiarla. Revisa tu correo.
              </p>
            ) : null}
          </DialogPanel>

          <DialogFooter>
            <Button
              type='submit'
              className='group inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-display text-label-lg text-primary-foreground uppercase transition-opacity hover:opacity-90'
              disabled={isSubmitting}
            >
              <span className='flex items-center gap-1'>
                {isSubmitting ? 'Mandando…' : 'Mandar el enlace'}
                <span className='inline-flex transition-transform duration-200 group-hover:translate-x-0.5'>
                  <ChevronRight className='h-4 w-4 group-hover:hidden' aria-hidden='true' />
                  <ArrowRight className='hidden h-4 w-4 group-hover:block' aria-hidden='true' />
                </span>
              </span>
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  )
}
