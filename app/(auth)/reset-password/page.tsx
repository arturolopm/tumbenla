'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { client } from '@/lib/auth/auth-client'
import { Field, FieldLabel } from '@/components/ui/field'
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
import { Mail, ArrowLeft } from 'lucide-react'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [email, setEmail] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsPending(true)

    try {
      await client.emailOtp.sendVerificationOtp(
        {
          email,
          type: 'forget-password',
        },
        {
          onRequest: () => {
            setIsPending(true)
          },
          onSuccess: () => {
            showToast({
              type: 'success',
              title: 'Check your email',
              description: 'We sent you a code to reset your password.',
            })
            router.push('/verify-otp')
            router.refresh()
          },
          onError: (ctx: { error: { message: string } }) => {
            showToast({
              type: 'error',
              title: 'Failed to send code',
              description: ctx.error.message || 'Could not send verification code.',
            })
            setIsPending(false)
          },
        }
      )
    } catch {
      showToast({
        type: 'error',
        title: 'Failed to send code',
        description: 'An unexpected error occurred. Please try again.',
      })
      setIsPending(false)
    }
  }

  return (
    <div className='flex min-h-screen items-center justify-center bg-background p-4'>
      <Card className='w-full max-w-md'>
        <CardHeader className='text-center'>
          <CardTitle className='text-2xl font-bold'>Reset password</CardTitle>
          <CardDescription>
            Enter your email and we&apos;ll send you a verification code
          </CardDescription>
        </CardHeader>
        <CardPanel>
          <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
            <Field>
              <FieldLabel htmlFor='email'>Email</FieldLabel>
              <div className='relative'>
                <Input
                  id='email'
                  type='email'
                  placeholder='name@example.com'
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isPending}
                />
                <Mail className='absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
              </div>
            </Field>

            <Button type='submit' disabled={isPending} className='w-full'>
              {isPending ? <Spinner className='h-4 w-4 animate-spin' /> : 'Send verification code'}
            </Button>
          </form>
        </CardPanel>
        <CardContent className='flex justify-center pb-6'>
          <a
            href='/login'
            className='text-sm text-muted-foreground hover:text-foreground flex items-center gap-1'
          >
            <ArrowLeft className='h-4 w-4' />
            Back to sign in
          </a>
        </CardContent>
      </Card>
    </div>
  )
}
