'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { cn } from '@/lib/utils'
import { useVerification } from './use-verification'

interface VerifyContentProps {
  isProduction: boolean
  initialEmail?: string | null
}

function VerificationForm({
  isProduction,
  initialEmail = null,
}: {
  isProduction: boolean
  initialEmail?: string | null
}) {
  const {
    otp,
    email,
    isLoading,
    isVerified,
    isInvalidOtp,
    errorMessage,
    isOtpComplete,
    isContextReady,
    verifyCode,
    resendCode,
    handleOtpChange,
  } = useVerification({ isProduction, initialEmail })

  const [countdown, setCountdown] = useState(0)
  const [isResendDisabled, setIsResendDisabled] = useState(false)

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
    if (countdown === 0 && isResendDisabled) {
      setIsResendDisabled(false)
    }
  }, [countdown, isResendDisabled])

  const router = useRouter()

  const handleResend = () => {
    resendCode()
    setIsResendDisabled(true)
    setCountdown(30)
  }

  if (!isContextReady) {
    return (
      <div className='text-center'>
        <div className='animate-pulse'>
          <div className='mx-auto mb-4 h-8 w-48 rounded bg-secondary' />
          <div className='mx-auto h-4 w-64 rounded bg-secondary' />
        </div>
      </div>
    )
  }

  return (
    <>
      <div className='space-y-1 text-center'>
        <h1 className='font-display font-black text-4xl uppercase leading-none tracking-tighter'>
          {isVerified ? '¡Listo!' : 'Verifica tu correo'}
        </h1>
        <p className='text-body-md text-muted-foreground'>
          {isVerified
            ? 'Tu correo quedó verificado. Te llevamos a lo tuyo…'
            : `Te mandamos un código a ${email}`}
        </p>
      </div>

      {!isVerified && (
        <div className='mt-8 space-y-8'>
          <div className='space-y-6'>
            <p className='text-center text-muted-foreground text-sm'>
              Escribe los 6 dígitos para confirmar que ese correo es tuyo.
            </p>

            <div className='flex justify-center'>
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={handleOtpChange}
                disabled={isLoading}
                className={cn('gap-2', isInvalidOtp && 'border-destructive')}
              >
                <InputOTPGroup className='gap-2 [&>div]:rounded-[10px]'>
                  <InputOTPSlot
                    index={0}
                    className={cn(
                      'h-12 w-12 rounded-[10px] border bg-card text-center font-medium text-lg shadow-sm transition-all duration-200',
                      'border-border hover:border-primary',
                      'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30',
                      isInvalidOtp &&
                        'border-destructive focus:border-destructive focus:ring-destructive/30'
                    )}
                  />
                  <InputOTPSlot
                    index={1}
                    className={cn(
                      'h-12 w-12 rounded-[10px] border bg-card text-center font-medium text-lg shadow-sm transition-all duration-200',
                      'border-border hover:border-primary',
                      'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30',
                      isInvalidOtp &&
                        'border-destructive focus:border-destructive focus:ring-destructive/30'
                    )}
                  />
                  <InputOTPSlot
                    index={2}
                    className={cn(
                      'h-12 w-12 rounded-[10px] border bg-card text-center font-medium text-lg shadow-sm transition-all duration-200',
                      'border-border hover:border-primary',
                      'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30',
                      isInvalidOtp &&
                        'border-destructive focus:border-destructive focus:ring-destructive/30'
                    )}
                  />
                  <InputOTPSlot
                    index={3}
                    className={cn(
                      'h-12 w-12 rounded-[10px] border bg-card text-center font-medium text-lg shadow-sm transition-all duration-200',
                      'border-border hover:border-primary',
                      'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30',
                      isInvalidOtp &&
                        'border-destructive focus:border-destructive focus:ring-destructive/30'
                    )}
                  />
                  <InputOTPSlot
                    index={4}
                    className={cn(
                      'h-12 w-12 rounded-[10px] border bg-card text-center font-medium text-lg shadow-sm transition-all duration-200',
                      'border-border hover:border-primary',
                      'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30',
                      isInvalidOtp &&
                        'border-destructive focus:border-destructive focus:ring-destructive/30'
                    )}
                  />
                  <InputOTPSlot
                    index={5}
                    className={cn(
                      'h-12 w-12 rounded-[10px] border bg-card text-center font-medium text-lg shadow-sm transition-all duration-200',
                      'border-border hover:border-primary',
                      'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30',
                      isInvalidOtp &&
                        'border-destructive focus:border-destructive focus:ring-destructive/30'
                    )}
                  />
                </InputOTPGroup>
              </InputOTP>
            </div>

            {/* Error message */}
            {errorMessage && (
              <div className='mt-1 space-y-1 text-center text-body-sm text-destructive-foreground'>
                <p>{errorMessage}</p>
              </div>
            )}
          </div>

          <Button
            onClick={verifyCode}
            className='flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-display text-label-lg text-primary-foreground uppercase transition-opacity hover:opacity-90'
            disabled={!isOtpComplete || isLoading}
          >
            {isLoading ? 'Verificando…' : 'Verificar'}
          </Button>

          <div className='text-center'>
            <p className='text-muted-foreground text-sm'>
              ¿No te llegó?{' '}
              {countdown > 0 ? (
                <span>
                  Puedes pedir otro en{' '}
                  <span className='font-medium text-foreground'>{countdown}s</span>
                </span>
              ) : (
                <button
                  className='font-medium text-primary-text underline-offset-4 transition hover:underline'
                  onClick={handleResend}
                  disabled={isLoading || isResendDisabled}
                >
                  Mándalo otra vez
                </button>
              )}
            </p>
          </div>

          <div className='text-center font-light text-[14px]'>
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  sessionStorage.removeItem('verificationEmail')
                  sessionStorage.removeItem('inviteRedirectUrl')
                  sessionStorage.removeItem('isInviteFlow')
                }
                router.push('/register')
              }}
              className='font-medium text-primary-text underline-offset-4 transition hover:underline'
            >
              Volver al registro
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function VerificationFormFallback() {
  return (
    <div className='text-center'>
      <div className='animate-pulse'>
        <div className='mx-auto mb-4 h-8 w-48 rounded bg-secondary' />
        <div className='mx-auto h-4 w-64 rounded bg-secondary' />
      </div>
    </div>
  )
}

export function VerifyContent({ isProduction, initialEmail = null }: VerifyContentProps) {
  return (
    <Suspense fallback={<VerificationFormFallback />}>
      <VerificationForm isProduction={isProduction} initialEmail={initialEmail} />
    </Suspense>
  )
}
