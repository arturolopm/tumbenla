'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

import { client } from '@/lib/auth/auth-client'
import { mensajeDeError } from '../fallo-de-red'
import { SetNewPasswordForm } from './reset-password-form'

const ENLACE_ROTO = 'Ese enlace no sirve o ya venció. Pide uno nuevo desde la pantalla de entrar.'

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Better-Auth's GET callback redirects here with `?token=` when the link is
  // good and `?error=INVALID_TOKEN` when it is not. Both are read during render
  // — no effect mirroring the URL into state.
  const token = searchParams.get('token')
  const linkError = !token || Boolean(searchParams.get('error'))

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | null
    text: string
  }>(linkError ? { type: 'error', text: ENLACE_ROTO } : { type: null, text: '' })

  const handleResetPassword = async (password: string) => {
    if (!token) {
      setStatusMessage({ type: 'error', text: ENLACE_ROTO })
      return
    }

    setIsSubmitting(true)
    setStatusMessage({ type: null, text: '' })

    // Through the SDK, not a hardcoded `fetch('/api/auth/reset-password')`: the
    // sibling forgot-password call was pinned to a path Better-Auth 1.4 removed
    // and silently 404'd for weeks. Letting the client own the path is the fix.
    try {
      const { error } = await client.resetPassword({ newPassword: password, token })

      if (error) {
        const invalid =
          error.code?.includes('INVALID_TOKEN') || error.message?.toLowerCase().includes('token')
        setStatusMessage({
          type: 'error',
          text: invalid
            ? ENLACE_ROTO
            : mensajeDeError(error, 'No se pudo cambiar la contraseña. Intenta de nuevo.'),
        })
        setIsSubmitting(false)
        return
      }

      setStatusMessage({ type: 'success', text: '¡Listo! Te llevamos a entrar con la nueva…' })
      setTimeout(() => {
        router.push('/login?resetSuccess=true')
      }, 1500)
    } catch (error) {
      setStatusMessage({
        type: 'error',
        text: mensajeDeError(error, 'No se pudo cambiar la contraseña. Intenta de nuevo.'),
      })
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <div className='space-y-1 text-center'>
        <h1 className='font-display font-black text-4xl uppercase leading-none tracking-tighter'>
          Contraseña nueva
        </h1>
        <p className='font-[380] text-[16px] text-muted-foreground'>
          Ponle una contraseña nueva a tu cuenta.
        </p>
      </div>

      <div className='mt-8'>
        <SetNewPasswordForm
          token={token}
          onSubmit={handleResetPassword}
          isSubmitting={isSubmitting}
          statusType={statusMessage.type}
          statusMessage={statusMessage.text}
        />
      </div>

      <div className='pt-6 text-center font-light text-[14px]'>
        <Link href='/login' className='auth-link underline-offset-4 transition hover:underline'>
          Volver a entrar
        </Link>
      </div>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className='flex h-screen items-center justify-center'>Cargando…</div>}>
      <ResetPasswordContent />
    </Suspense>
  )
}
