'use client'

import Link from 'next/link'
import { useEffect } from 'react'

import { barCartStore, useBarCartStore } from '@/lib/cart/cart-store'

export function ContinueOrderLink({ venueId, venueSlug }: { venueId: string; venueSlug: string }) {
  const cart = useBarCartStore((store) => store.carts[venueId])
  const hasHydrated = useBarCartStore((store) => store.hasHydrated)

  useEffect(() => {
    if (!barCartStore.persist.hasHydrated()) void barCartStore.persist.rehydrate()
  }, [])

  if (!hasHydrated || !cart || cart.lines.length === 0) return null

  const totalUnits = cart.lines.reduce((total, line) => total + line.quantity, 0)
  return (
    <Link
      href={`/sitios/${encodeURIComponent(venueSlug)}/pedir`}
      className='mt-4 inline-flex min-h-11 items-center rounded-lg border border-primary px-4 font-display text-label-sm text-primary-text uppercase transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
    >
      Continuar pedido · {totalUnits} {totalUnits === 1 ? 'unidad' : 'unidades'}
    </Link>
  )
}
