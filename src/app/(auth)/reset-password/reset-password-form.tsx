'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { type NewPasswordInput, newPasswordSchema } from '@/lib/auth/schemas'
import { ArrowRight, ChevronRight, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface SetNewPasswordFormProps {
  token: string | null
  onSubmit: (password: string) => Promise<void>
  isSubmitting: boolean
  statusType: 'success' | 'error' | null
  statusMessage: string
  className?: string
}

export function SetNewPasswordForm({
  token,
  onSubmit,
  isSubmitting,
  statusType,
  statusMessage,
  className,
}: SetNewPasswordFormProps) {
  // The "same rule as register" note below is now enforced by sharing the very
  // schema, instead of by two copies of the rule agreeing today and drifting
  // tomorrow.
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NewPasswordInput>({
    resolver: zodResolver(newPasswordSchema),
    mode: 'onBlur',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isButtonHovered, setIsButtonHovered] = useState(false)

  const submit = handleSubmit(async ({ password }) => {
    await onSubmit(password)
  })

  return (
    <form onSubmit={submit} className={cn(`space-y-8`, className)}>
      <div className='space-y-6'>
        <div className='space-y-2'>
          <div className='flex items-center justify-between'>
            <Label htmlFor='password'>Contraseña nueva</Label>
          </div>
          <div className='relative'>
            <Input
              id='password'
              type={showPassword ? 'text' : 'password'}
              autoCapitalize='none'
              autoComplete='new-password'
              autoCorrect='off'
              disabled={isSubmitting || !token}
              aria-invalid={Boolean(errors.password)}
              {...register('password')}
              size='lg'
              placeholder='Al menos 8 caracteres'
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
        </div>
        <div className='space-y-2'>
          <div className='flex items-center justify-between'>
            <Label htmlFor='confirmPassword'>Confírmala</Label>
          </div>
          <div className='relative'>
            <Input
              id='confirmPassword'
              type={showConfirmPassword ? 'text' : 'password'}
              autoCapitalize='none'
              autoComplete='new-password'
              autoCorrect='off'
              disabled={isSubmitting || !token}
              aria-invalid={Boolean(errors.confirmPassword)}
              {...register('confirmPassword')}
              size='lg'
              placeholder='Escríbela otra vez'
              className={cn(
                'pr-10 transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30',
                errors.confirmPassword &&
                  'border-destructive focus:border-destructive focus:ring-destructive/30 focus-visible:ring-destructive'
              )}
            />
            <button
              type='button'
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className='-translate-y-1/2 absolute top-1/2 right-3 text-muted-foreground transition-colors hover:text-primary-text'
              aria-label={showConfirmPassword ? 'Ocultar la contraseña' : 'Ver la contraseña'}
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {errors.password || errors.confirmPassword ? (
          <div role='alert' className='mt-1 space-y-1 text-body-sm text-destructive-foreground'>
            {errors.password ? <p>{errors.password.message}</p> : null}
            {errors.confirmPassword ? <p>{errors.confirmPassword.message}</p> : null}
          </div>
        ) : null}

        {statusType && statusMessage && (
          <div
            className={cn(
              'mt-1 space-y-1 text-xs',
              statusType === 'success' ? 'text-success-foreground' : 'text-red-400'
            )}
          >
            <p>{statusMessage}</p>
          </div>
        )}
      </div>

      <Button
        disabled={isSubmitting || !token}
        type='submit'
        size='lg'
        onMouseEnter={() => setIsButtonHovered(true)}
        onMouseLeave={() => setIsButtonHovered(false)}
        className='group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-display text-label-lg text-primary-foreground uppercase transition-opacity hover:opacity-90'
      >
        <span className='flex items-center gap-1'>
          {isSubmitting ? 'Guardando…' : 'Guardar la contraseña'}
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
  )
}
