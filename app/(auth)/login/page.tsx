'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from '@/lib/auth/auth-client'
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
import { Mail, Lock } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsPending(true)

    try {
      await signIn.email(
        {
          email,
          password,
        },
        {
          onRequest: () => {
            setIsPending(true)
          },
          onSuccess: async () => {
            showToast({
              type: 'success',
              title: 'Welcome back!',
              description: 'You have been signed in successfully.',
            })
            router.push('/dashboard')
            router.refresh()
          },
          onError: (ctx) => {
            showToast({
              type: 'error',
              title: 'Sign in failed',
              description: ctx.error.message || 'Invalid email or password.',
            })
            setIsPending(false)
          },
        }
      )
    } catch {
      showToast({
        type: 'error',
        title: 'Sign in failed',
        description: 'An unexpected error occurred. Please try again.',
      })
      setIsPending(false)
    }
  }

  const handleSignInWithGoogle = async () => {
    try {
      await signIn.social({
        provider: 'google',
        callbackURL: '/dashboard',
      })
    } catch {
      showToast({
        type: 'error',
        title: 'Sign in failed',
        description: 'Failed to initiate Google sign in.',
      })
    }
  }

  return (
    <div className='flex min-h-screen items-center justify-center bg-background p-4'>
      <Card className='w-full max-w-md'>
        <CardHeader className='text-center'>
          <CardTitle className='text-2xl font-bold'>Welcome back</CardTitle>
          <CardDescription>Sign in to your account to continue</CardDescription>
        </CardHeader>
        <CardPanel>
          <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
            <Field>
              <FieldLabel htmlFor='email'>Email</FieldLabel>
              <FieldControl>
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
              </FieldControl>
            </Field>

            <Field>
              <div className='flex items-center justify-between'>
                <FieldLabel htmlFor='password'>Password</FieldLabel>
                <a href='/forgot-password' className='text-sm text-primary hover:underline'>
                  Forgot password?
                </a>
              </div>
              <FieldControl>
                <div className='relative'>
                  <Input
                    id='password'
                    type='password'
                    placeholder='Enter your password'
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isPending}
                  />
                  <Lock className='absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                </div>
              </FieldControl>
            </Field>

            <Button type='submit' disabled={isPending} className='w-full'>
              {isPending ? <Spinner className='h-4 w-4 animate-spin' /> : 'Sign in'}
            </Button>

            <div className='relative my-2'>
              <div className='absolute inset-0 flex items-center'>
                <span className='w-full border-t' />
              </div>
              <div className='relative flex justify-center text-xs uppercase'>
                <span className='bg-card px-2 text-muted-foreground'>Or continue with</span>
              </div>
            </div>

            <Button
              type='button'
              variant='outline'
              onClick={handleSignInWithGoogle}
              disabled={isPending}
              className='w-full'
            >
              <svg className='mr-2 h-4 w-4' viewBox='0 0 24 24'>
                <path
                  fill='currentColor'
                  d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z'
                />
                <path
                  fill='currentColor'
                  d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'
                />
                <path
                  fill='currentColor'
                  d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z'
                />
                <path
                  fill='currentColor'
                  d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z'
                />
              </svg>
              Continue with Google
            </Button>
          </form>
        </CardPanel>
        <CardContent className='flex justify-center pb-6'>
          <p className='text-sm text-muted-foreground'>
            Don&apos;t have an account?{' '}
            <a href='/register' className='text-primary hover:underline font-medium'>
              Sign up
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
