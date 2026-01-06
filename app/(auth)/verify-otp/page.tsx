'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { client } from '@/lib/auth/auth-client'
import { Field, FieldControl, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardPanel,
} from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { showToast } from '@/lib/utils/toast'
import { ArrowLeft, Lock } from 'lucide-react'

export default function VerifyOtpPage() {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword.length < 8) {
      showToast({
        type: 'error',
        title: 'Password too short',
        description: 'Password must be at least 8 characters.',
      })
      return
    }

    if (newPassword !== confirmPassword) {
      showToast({
        type: 'error',
        title: 'Passwords do not match',
        description: 'Please make sure both passwords are the same.',
      })
      return
    }

    setIsPending(true)

    try {
      await client.resetPassword(
        {
          token: otp,
          newPassword,
        },
        {
          onRequest: () => {
            setIsPending(true)
          },
          onSuccess: () => {
            showToast({
              type: 'success',
              title: 'Password reset!',
              description: 'Your password has been changed successfully.',
            })
            router.push('/login')
            router.refresh()
          },
          onError: (ctx: { error: { message: string } }) => {
            showToast({
              type: 'error',
              title: 'Failed to reset password',
              description: ctx.error.message || 'The code may be invalid or expired.',
            })
            setIsPending(false)
          },
        }
      )
    } catch {
      showToast({
        type: 'error',
        title: 'Failed to reset password',
        description: 'An unexpected error occurred. Please try again.',
      })
      setIsPending(false)
    }
  }

  return (
    <div className='flex min-h-screen items-center justify-center bg-background p-4'>
      <Card className='w-full max-w-md'>
        <CardHeader className='text-center'>
          <CardTitle className='text-2xl font-bold'>Enter verification code</CardTitle>
          <CardDescription>
            We sent a code to your email. Enter it below to reset your password.
          </CardDescription>
        </CardHeader>
        <CardPanel>
          <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
            <Field>
              <FieldLabel htmlFor='otp'>Verification code</FieldLabel>
              <FieldControl>
                <Input
                  id='otp'
                  type='text'
                  placeholder='Enter 6-digit code'
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={6}
                  required
                  disabled={isPending}
                  className='text-center text-lg tracking-widest'
                />
              </FieldControl>
            </Field>

            <Field>
              <FieldLabel htmlFor='newPassword'>New password</FieldLabel>
              <FieldControl>
                <div className='relative'>
                  <Input
                    id='newPassword'
                    type='password'
                    placeholder='Create new password'
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    disabled={isPending}
                  />
                  <Lock className='absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                </div>
              </FieldControl>
              <p className='text-xs text-muted-foreground mt-1'>Must be at least 8 characters</p>
            </Field>

            <Field>
              <FieldLabel htmlFor='confirmPassword'>Confirm new password</FieldLabel>
              <FieldControl>
                <div className='relative'>
                  <Input
                    id='confirmPassword'
                    type='password'
                    placeholder='Confirm new password'
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={isPending}
                  />
                  <Lock className='absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                </div>
              </FieldControl>
            </Field>

            <Button type='submit' disabled={isPending} className='w-full'>
              {isPending ? <Spinner className='h-4 w-4 animate-spin' /> : 'Reset password'}
            </Button>
          </form>
        </CardPanel>
        <CardContent className='flex justify-center pb-6'>
          <a
            href='/forgot-password'
            className='text-sm text-muted-foreground hover:text-foreground flex items-center gap-1'
          >
            <ArrowLeft className='h-4 w-4' />
            Didn't receive the code?
          </a>
        </CardContent>
      </Card>
    </div>
  )
}
