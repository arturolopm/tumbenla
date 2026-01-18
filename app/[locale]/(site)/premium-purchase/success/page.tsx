'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { setPurchasedPremium } from '@/lib/premium-purchase'
import { useVerifyPremiumPurchase } from '@/lib/premium-purchase/hooks'
import { CheckCircle2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { quickValidateEmail } from '@/lib/messaging/email/validation'
import { Spinner } from '@/components/ui/spinner'

export default function PremiumPurchaseSuccess() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionId = searchParams.get('session_id')

  const {
    data: verificationData,
    isLoading: isVerifying,
    error: verificationError,
  } = useVerifyPremiumPurchase(sessionId)

  const isVerified = !!verificationData
  const error = verificationError ? (verificationError as Error).message : null

  const [githubEmail, setGithubEmail] = useState('')
  const [twitterHandle, setTwitterHandle] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showDiscordLink, setShowDiscordLink] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Validation states
  const [githubEmailErrors, setGithubEmailErrors] = useState<string[]>([])
  const [twitterHandleErrors, setTwitterHandleErrors] = useState<string[]>([])
  const [showGithubEmailValidationError, setShowGithubEmailValidationError] = useState(false)
  const [showTwitterHandleValidationError, setShowTwitterHandleValidationError] = useState(false)

  useEffect(() => {
    if (isVerified && verificationData) {
      setPurchasedPremium()
    }
  }, [isVerified, verificationData])

  const validateEmailField = (emailValue: string): string[] => {
    const errors: string[] = []

    if (!emailValue || !emailValue.trim()) {
      errors.push('Email is required.')
      return errors
    }

    const validation = quickValidateEmail(emailValue.trim().toLowerCase())
    if (!validation.isValid) {
      errors.push(validation.reason || 'Please enter a valid email address.')
    }

    return errors
  }

  const validateTwitterHandle = (handle: string): string[] => {
    const errors: string[] = []

    if (!handle || !handle.trim()) {
      errors.push('Twitter handle is required.')
      return errors
    }

    const cleaned = handle.replace(/^@+/, '').trim()
    if (cleaned.length === 0) {
      errors.push('Twitter handle cannot be empty.')
    } else if (cleaned.length < 1) {
      errors.push('Twitter handle must be at least 1 character.')
    } else if (cleaned.length > 15) {
      errors.push('Twitter handle cannot exceed 15 characters.')
    } else if (!/^[a-zA-Z0-9_]+$/.test(cleaned)) {
      errors.push('Twitter handle can only contain letters, numbers, and underscores.')
    }

    return errors
  }

  const handleGithubEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value
    setGithubEmail(newEmail)

    const errors = validateEmailField(newEmail)
    setGithubEmailErrors(errors)
    setShowGithubEmailValidationError(false)
  }

  const handleTwitterHandleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const cleaned = value.replace(/^@+/, '')
    setTwitterHandle(cleaned)

    const errors = validateTwitterHandle(cleaned)
    setTwitterHandleErrors(errors)
    setShowTwitterHandleValidationError(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const emailValidationErrors = validateEmailField(githubEmail)
    setGithubEmailErrors(emailValidationErrors)
    setShowGithubEmailValidationError(emailValidationErrors.length > 0)

    const twitterValidationErrors = validateTwitterHandle(twitterHandle)
    setTwitterHandleErrors(twitterValidationErrors)
    setShowTwitterHandleValidationError(twitterValidationErrors.length > 0)

    if (emailValidationErrors.length > 0 || twitterValidationErrors.length > 0) {
      setFormError(null)
      return
    }

    setIsSubmitting(true)
    setFormError(null)

    setTimeout(() => {
      setShowDiscordLink(true)
      setIsSubmitting(false)
    }, 500)
  }

  if (isVerifying) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-linear-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950'>
        <div className='text-center space-y-4'>
          <div className='relative'>
            <div className='w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto' />
            <div className='absolute inset-0 flex items-center justify-center'>
              <Sparkles className='w-6 h-6 text-primary animate-pulse' />
            </div>
          </div>
          <p className='text-muted-foreground font-medium'>Verifying your payment...</p>
        </div>
      </div>
    )
  }

  if (error && !isVerified) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-linear-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4'>
        <div className='max-w-md w-full'>
          <div className='bg-background/80 backdrop-blur-xl border border-border/50 rounded-2xl p-8 text-center shadow-2xl shadow-black/5 dark:shadow-black/20'>
            <div className='w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6'>
              <div className='w-12 h-12 bg-destructive/20 rounded-full flex items-center justify-center'>
                <svg
                  className='w-6 h-6 text-destructive'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M6 18L18 6M6 6l12 12'
                  />
                </svg>
              </div>
            </div>
            <h1 className='text-3xl font-bold mb-3 bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent'>
              Verification Failed
            </h1>
            <p className='text-muted-foreground mb-8 leading-relaxed'>{error}</p>
            <Button onClick={() => router.push('/#pricing')} size='lg' className='w-full'>
              Return to Pricing
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (showDiscordLink) {
    const discordLink = process.env.NEXT_PUBLIC_PREMIUM_PURCHASE_DISCORD_INVITE_LINK || '#'

    return (
      <div className='min-h-screen flex items-center justify-center bg-linear-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4'>
        <div className='max-w-lg w-full'>
          <div className='bg-background/80 backdrop-blur-xl rounded-xl p-10 text-center opacity-0 animate-[fadeIn_0.7s_ease-out_0.1s_forwards,slideUp_0.7s_ease-out_0.1s_forwards]'>
            <h1 className='text-4xl font-bold mb-4 bg-linear-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent'>
              Welcome to ShipFree Premium!
            </h1>
            <p className='text-muted-foreground mb-10 text-lg leading-relaxed'>
              Thank you for your purchase. Join our private Discord community to get started with
              exclusive resources and support.
            </p>
            <div className='space-y-4'>
              <Button
                className='w-full h-12 text-base font-semibold transition-all duration-300'
                size='lg'
                onClick={() => {
                  if (discordLink !== '#') {
                    window.open(discordLink, '_blank')
                  }
                }}
              >
                <svg
                  className='w-5 h-5 mr-2'
                  fill='currentColor'
                  viewBox='0 0 24 24'
                  aria-hidden='true'
                >
                  <path d='M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z' />
                </svg>
                Join Discord Community
              </Button>
              <Button
                variant='outline'
                className='w-full h-12 text-base'
                onClick={() => router.push('/')}
              >
                Go to Homepage
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='min-h-screen flex items-center justify-center bg-linear-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4 py-12'>
      <div className='max-w-lg w-full'>
        <div className='bg-background/80 backdrop-blur-xl border border-border/50 rounded-xl p-10 shadow-2xl shadow-black/5 dark:shadow-black/20 opacity-0 animate-[fadeIn_0.7s_ease-out_0.1s_forwards,slideUp_0.7s_ease-out_0.1s_forwards]'>
          <div className='mb-8 text-center'>
            <div className='relative inline-block mb-6'>
              <div className='absolute inset-0 flex items-center justify-center'>
                <div className='w-32 h-32 bg-linear-to-br from-primary/20 via-primary/10 to-transparent rounded-full blur-2xl animate-pulse' />
              </div>
              <div className='relative w-20 h-20 bg-linear-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto opacity-0 scale-95 animate-[zoomIn_0.5s_ease-out_0.3s_forwards]'>
                <CheckCircle2 className='w-10 h-10 text-white' strokeWidth={2.5} />
              </div>
            </div>
            <h1 className='text-4xl font-bold mb-3 bg-linear-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent'>
              Payment Successful!
            </h1>
            <p className='text-muted-foreground text-lg leading-relaxed'>
              Please provide your GitHub email and Twitter handle to receive access to the private
              repository and Discord community.
            </p>
          </div>

          <form onSubmit={handleSubmit} className='space-y-8'>
            <div className='space-y-6'>
              <div className='space-y-2'>
                <div className='flex items-center justify-between'>
                  <Label htmlFor='github-email'>GitHub Email</Label>
                </div>
                <Input
                  id='github-email'
                  name='github-email'
                  type='email'
                  placeholder='your.email@example.com'
                  value={githubEmail}
                  onChange={handleGithubEmailChange}
                  required
                  autoCapitalize='none'
                  autoComplete='email'
                  autoCorrect='off'
                  disabled={isSubmitting}
                  size='lg'
                  className={cn(
                    'transition-colors focus:border-gray-400 focus:ring-2 focus:ring-gray-100',
                    showGithubEmailValidationError &&
                      githubEmailErrors.length > 0 &&
                      'border-red-500 focus:border-red-500 focus:ring-red-100 focus-visible:ring-red-500'
                  )}
                />
                {showGithubEmailValidationError && githubEmailErrors.length > 0 && (
                  <div className='mt-1 space-y-1 text-red-400 text-xs'>
                    {githubEmailErrors.map((error, index) => (
                      <p key={index}>{error}</p>
                    ))}
                  </div>
                )}
              </div>

              <div className='space-y-2'>
                <div className='flex items-center justify-between'>
                  <Label htmlFor='twitter-handle'>Twitter Handle</Label>
                </div>
                <div className='relative'>
                  <Input
                    id='twitter-handle'
                    name='twitter-handle'
                    type='text'
                    placeholder='yourhandle'
                    value={twitterHandle}
                    onChange={handleTwitterHandleChange}
                    required
                    autoCapitalize='none'
                    autoCorrect='off'
                    disabled={isSubmitting}
                    size='lg'
                    className={cn(
                      'transition-colors focus:border-gray-400 focus:ring-2 focus:ring-gray-100',
                      showTwitterHandleValidationError &&
                        twitterHandleErrors.length > 0 &&
                        'border-red-500 focus:border-red-500 focus:ring-red-100 focus-visible:ring-red-500'
                    )}
                  />
                </div>
                {showTwitterHandleValidationError && twitterHandleErrors.length > 0 && (
                  <div className='mt-1 space-y-1 text-red-400 text-xs'>
                    {twitterHandleErrors.map((error, index) => (
                      <p key={index}>{error}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {formError && (
              <div className='text-sm text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4'>
                {formError}
              </div>
            )}

            <Button type='submit' size='lg' className='w-full' disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Spinner className='h-5 w-5 mr-2' />
                  <span className='transition-opacity duration-200'>Processing...</span>
                </>
              ) : (
                'Continue'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
