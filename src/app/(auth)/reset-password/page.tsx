'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

import { SetNewPasswordForm } from '../reset-password/reset-password-form'

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | null
    text: string
  }>({
    type: null,
    text: '',
  })

  useEffect(() => {
    if (!token) {
      setStatusMessage({
        type: 'error',
        text: 'Ese enlace no sirve o ya venció. Pide uno nuevo desde la pantalla de entrar.',
      })
    }
  }, [token])

  const handleResetPassword = async (password: string) => {
    try {
      setIsSubmitting(true)
      setStatusMessage({ type: null, text: '' })

      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          newPassword: password,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'No se pudo cambiar la contraseña')
      }

      setStatusMessage({
        type: 'success',
        text: '¡Listo! Te llevamos a entrar con la nueva…',
      })

      setTimeout(() => {
        router.push('/login?resetSuccess=true')
      }, 1500)
    } catch (error) {
      console.error('Error resetting password:', error)
      setStatusMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo cambiar la contraseña',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <div className='space-y-1 text-center'>
        <h1 className='font-display font-black text-4xl uppercase leading-none tracking-tighter'>
          Contraseña nueva
        </h1>
        <p className={`font-[380] text-[16px] text-muted-foreground`}>
          Enter a new password for your account
        </p>
      </div>

      <div className={`mt-8`}>
        <SetNewPasswordForm
          token={token}
          onSubmit={handleResetPassword}
          isSubmitting={isSubmitting}
          statusType={statusMessage.type}
          statusMessage={statusMessage.text}
        />
      </div>

      <div className={`pt-6 text-center font-light text-[14px]`}>
        <Link href='/login' className='auth-link underline-offset-4 transition hover:underline'>
          Back to login
        </Link>
      </div>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={<div className='flex h-screen items-center justify-center'>Cargando…</div>}
    >
      <ResetPasswordContent />
    </Suspense>
  )
}
