import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth'
import { isEmailVerificationEnabled } from '@/config/feature-flags'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    redirect('/login')
  }

  if (isEmailVerificationEnabled && !session.user.emailVerified) {
    redirect('/verify?redirectAfter=/dashboard')
  }

  return <>{children}</>
}
