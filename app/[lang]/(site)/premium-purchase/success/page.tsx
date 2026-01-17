'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { setPurchasedPremium } from '@/lib/premium-purchase'
import { useVerifyPremiumPurchase } from '@/lib/premium-purchase/hooks'
import { CheckCircle2, Sparkles, Github, Twitter } from 'lucide-react'

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

  useEffect(() => {
    if (isVerified && verificationData) {
      setPurchasedPremium()
    }
  }, [isVerified, verificationData])

  const handleTwitterHandleChange = (value: string) => {
    const cleaned = value.replace(/^@+/, '')
    setTwitterHandle(cleaned)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!githubEmail || !twitterHandle) {
      setFormError('Please fill in all fields')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(githubEmail)) {
      setFormError('Please enter a valid email address')
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
          <div className='bg-background/80 backdrop-blur-xl border border-border/50 rounded-2xl p-10 text-center shadow-2xl shadow-black/5 dark:shadow-black/20 opacity-0 animate-[fadeIn_0.7s_ease-out_0.1s_forwards,slideUp_0.7s_ease-out_0.1s_forwards]'>
            <div className='relative mb-8'>
              <div className='absolute inset-0 flex items-center justify-center'>
                <div className='w-32 h-32 bg-linear-to-br from-primary/20 via-primary/10 to-transparent rounded-full blur-2xl animate-pulse' />
              </div>
              <div className='relative w-24 h-24 bg-linear-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-green-500/30 opacity-0 scale-95 animate-[zoomIn_0.5s_ease-out_0.3s_forwards]'>
                <CheckCircle2 className='w-12 h-12 text-white' strokeWidth={2.5} />
              </div>
              <div className='absolute -top-2 -right-2'>
                <Sparkles className='w-6 h-6 text-primary animate-pulse' />
              </div>
            </div>
            <h1 className='text-4xl font-bold mb-4 bg-linear-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent'>
              Welcome to ShipFree Premium!
            </h1>
            <p className='text-muted-foreground mb-10 text-lg leading-relaxed'>
              Thank you for your purchase. Join our private Discord community to get started with
              exclusive resources and support.
            </p>
            <div className='space-y-4'>
              <Button
                className='w-full h-12 text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300'
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
        <div className='bg-background/80 backdrop-blur-xl border border-border/50 rounded-2xl p-10 shadow-2xl shadow-black/5 dark:shadow-black/20 opacity-0 animate-[fadeIn_0.7s_ease-out_0.1s_forwards,slideUp_0.7s_ease-out_0.1s_forwards]'>
          <div className='mb-8 text-center'>
            <div className='relative inline-block mb-6'>
              <div className='absolute inset-0 flex items-center justify-center'>
                <div className='w-32 h-32 bg-linear-to-br from-primary/20 via-primary/10 to-transparent rounded-full blur-2xl animate-pulse' />
              </div>
              <div className='relative w-20 h-20 bg-linear-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-green-500/30 opacity-0 scale-95 animate-[zoomIn_0.5s_ease-out_0.3s_forwards]'>
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

          <form onSubmit={handleSubmit} className='space-y-6'>
            <div className='space-y-2'>
              <label
                htmlFor='github-email'
                className='text-sm font-semibold mb-3 flex items-center gap-2 text-linear-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent'
              >
                <Github className='w-4 h-4' />
                GitHub Email
              </label>
              <Input
                id='github-email'
                type='email'
                placeholder='your.email@example.com'
                value={githubEmail}
                onChange={(e) => setGithubEmail(e.target.value)}
                required
                disabled={isSubmitting}
                className='h-12 text-base'
              />
            </div>

            <div className='space-y-2'>
              <label
                htmlFor='twitter-handle'
                className='text-sm font-semibold mb-3 flex items-center gap-2'
              >
                <Twitter className='w-4 h-4' />
                Twitter Handle
              </label>
              <div className='relative'>
                <span className='absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-lg font-medium'>
                  @
                </span>
                <Input
                  id='twitter-handle'
                  type='text'
                  placeholder='yourhandle'
                  value={twitterHandle}
                  onChange={(e) => handleTwitterHandleChange(e.target.value)}
                  className='pl-10 h-12 text-base'
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {(error || formError) && (
              <div className='text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-4 opacity-0 animate-[fadeIn_0.3s_ease-out_forwards,slideDown_0.3s_ease-out_forwards]'>
                {formError || error}
              </div>
            )}

            <Button
              type='submit'
              className='w-full h-12 text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 mt-2'
              size='lg'
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className='flex items-center gap-2'>
                  <div className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin' />
                  Processing...
                </span>
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
