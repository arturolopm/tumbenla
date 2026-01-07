import { getOAuthProviderStatus } from '@/app/(auth)/components/oauth-provider-checker'
import RegisterForm from '@/app/(auth)/register/register-form'

export const dynamic = 'force-dynamic'

export default async function RegisterPage() {
  const {
    githubAvailable,
    googleAvailable,
    facebookAvailable,
    microsoftAvailable,
    isProduction,
  } = await getOAuthProviderStatus()

  return (
    <RegisterForm
      githubAvailable={githubAvailable}
      googleAvailable={googleAvailable}
      facebookAvailable={facebookAvailable}
      microsoftAvailable={microsoftAvailable}
      isProduction={isProduction}
    />
  )
}

