import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

/**
 * Compatibility redirect for product links saved before the cart checkout.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function LegacyProductOrderPage({
  params,
}: {
  params: Promise<{ slug: string; producto: string }>
}) {
  const { slug, producto: productoSlug } = await params
  redirect(`/sitios/${encodeURIComponent(slug)}/pedir?producto=${encodeURIComponent(productoSlug)}`)
}
