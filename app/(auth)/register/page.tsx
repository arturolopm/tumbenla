'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signUp } from '@/lib/auth/auth-client'
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
import { Mail, User, Lock } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      showToast({
        type: 'error',
        title: 'Passwords do not match',
        description: 'Please make sure both passwords are the same.',
      })
      return
    }

    if (password.length < 8) {
      showToast({
        type: 'error',
        title: 'Password too short',
        description: 'Password must be at least 8 characters long.',
      })
      return
    }

    setIsPending(true)

    try {
      await signUp.email(
        {
          email,
          password,
          name,
        },
        {
          onRequest: () => {
            setIsPending(true)
          },
          onSuccess: async () => {
            showToast({
              type: 'success',
              title: 'Account created!',
              description: 'Please check your email to verify your account.',
            })
            router.push('/login')
            router.refresh()
          },
          onError: (ctx) => {
            showToast({
              type: 'error',
              title: 'Sign up failed',
              description: ctx.error.message || 'Failed to create account.',
            })
            setIsPending(false)
          },
        }
      )
    } catch {
      showToast({
        type: 'error',
        title: 'Sign up failed',
        description: 'An unexpected error occurred. Please try again.',
      })
      setIsPending(false)
    }
  }

  return (
    <div className='flex min-h-screen items-center justify-center bg-background p-4'>
      <Card className='w-full max-w-md'>
        <CardHeader className='text-center'>
          <CardTitle className='text-2xl font-bold'>Create an account</CardTitle>
          <CardDescription>Enter your details to get started</CardDescription>
        </CardHeader>
        <CardPanel>
          <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
            <Field>
              <FieldLabel htmlFor='name'>Name</FieldLabel>
              <div className='relative'>
                <Input
                  id='name'
                  type='text'
                  placeholder='John Doe'
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={isPending}
                />
                <User className='absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
              </div>
            </Field>

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

            <Field>
              <FieldLabel htmlFor='password'>Password</FieldLabel>
              <div className='relative'>
                <Input
                  id='password'
                  type='password'
                  placeholder='Create a password'
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isPending}
                />
                <Lock className='absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
              </div>
              <p className='text-xs text-muted-foreground mt-1'>Must be at least 8 characters</p>
            </Field>

            <Field>
              <FieldLabel htmlFor='confirmPassword'>Confirm Password</FieldLabel>
              <div className='relative'>
                <Input
                  id='confirmPassword'
                  type='password'
                  placeholder='Confirm your password'
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isPending}
                />
                <Lock className='absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
              </div>
            </Field>

            <Button type='submit' disabled={isPending} className='w-full'>
              {isPending ? <Spinner className='h-4 w-4 animate-spin' /> : 'Create account'}
            </Button>
          </form>
        </CardPanel>
        <CardContent className='flex justify-center pb-6'>
          <p className='text-sm text-muted-foreground'>
            Already have an account?{' '}
            <a href='/login' className='text-primary hover:underline font-medium'>
              Sign in
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
