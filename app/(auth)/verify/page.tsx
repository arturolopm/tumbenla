import { isProd } from '@/lib/constants'
import { VerifyContent } from '@/app/(auth)/verify/verify-content'
import { generateMetadata } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export const metadata = generateMetadata({
  title: 'Verification | ShipFree',
})

export default function VerifyPage() {
  return <VerifyContent isProduction={isProd} />
}
