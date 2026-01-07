import { isProd } from '@/lib/constants'
import { VerifyContent } from '@/app/(auth)/verify/verify-content'

export const dynamic = 'force-dynamic'

export default function VerifyPage() {
  return <VerifyContent isProduction={isProd} />
}
