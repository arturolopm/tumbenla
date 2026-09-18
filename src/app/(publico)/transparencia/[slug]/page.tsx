import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import {
  getPurchaseBySlug,
  listPublishedPurchaseSlugs,
} from '@/lib/transparency/queries'
import { formatCOP, formatDate, formatNumber } from '@/lib/utils/format'
import { generateMetadata as buildMetadata } from '@/lib/seo'

export const revalidate = 300

/** See the note in sitios/[slug]/page.tsx: no loading.tsx in this tree either. */

export async function generateStaticParams() {
  const slugs = await listPublishedPurchaseSlugs()
  return slugs.map(({ slug }) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const purchase = await getPurchaseBySlug(slug)

  if (!purchase) notFound()

  return buildMetadata({
    title: purchase.title,
    description:
      purchase.summary ??
      `Compra de material por ${formatCOP(purchase.totalAmount, purchase.currency)}.`,
    canonical: `/transparencia/${purchase.slug}`,
  })
}

export default async function PurchasePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const purchase = await getPurchaseBySlug(slug)

  if (!purchase) notFound()

  const receipts = purchase.media.filter((item) => item.kind !== 'photo')
  const photos = purchase.media.filter((item) => item.kind === 'photo')

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <Link
        href="/transparencia"
        className="font-display text-label-lg text-muted-foreground uppercase tracking-widest transition-colors hover:text-lime"
      >
        ← Volver a las compras
      </Link>

      <header className="mt-6 flex flex-col gap-3">
        <h1 className="text-balance font-display font-black text-4xl uppercase leading-none tracking-tighter sm:text-6xl">
          {purchase.title}
        </h1>
        {purchase.summary ? (
          <p className="text-pretty text-body-lg text-muted-foreground">{purchase.summary}</p>
        ) : null}
        <p className="font-display font-black text-5xl text-primary-text tabular-nums">
          {formatCOP(purchase.totalAmount, purchase.currency)}
        </p>
        <p className="text-muted-foreground text-sm">
          {formatDate(purchase.purchasedAt)}
          {' · '}
          {purchase.municipality}
          {purchase.beneficiaryLabel ? ` · ${purchase.beneficiaryLabel}` : ''}
        </p>
      </header>

      {purchase.story ? (
        <p className="mt-8 max-w-prose text-pretty text-body-md leading-relaxed">{purchase.story}</p>
      ) : null}

      {purchase.items.length > 0 ? (
        <section className="mt-10">
          <h2 className="font-display font-extrabold text-headline-md uppercase">Qué se compró</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {purchase.items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 rounded-lg border border-border bg-card px-4 py-3"
              >
                <div className="flex flex-col">
                  <span className="font-medium">{item.name}</span>
                  <span className="text-muted-foreground text-sm">
                    {formatNumber(item.quantity, 2)} {item.unit}
                    {item.unitCost
                      ? ` a ${formatCOP(item.unitCost, purchase.currency)} cada uno`
                      : ''}
                  </span>
                </div>
                {item.subtotal ? (
                  <span className="font-mono tabular-nums">
                    {formatCOP(item.subtotal, purchase.currency)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {receipts.length > 0 ? (
        <section className="mt-10">
          <h2 className="font-display font-extrabold text-headline-md uppercase">Los recibos</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {receipts.map((item) => (
              <figure key={item.id} className="overflow-hidden rounded-xl border-2 border-secondary">
                {/* Plain <img> a proposito: la URL de una evidencia puede venir pegada
                    y no solo de R2; next/image reventaria con otro host. */}
                <img src={item.url} alt={item.caption ?? 'Recibo'} className="w-full" />
                {item.caption ? (
                  <figcaption className="border-secondary border-t px-3 py-2 text-body-md text-muted-foreground">
                    {item.caption}
                  </figcaption>
                ) : null}
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      {photos.length > 0 ? (
        <section className="mt-10">
          <h2 className="font-display font-extrabold text-headline-md uppercase">Fotos</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {photos.map((item) => (
              <figure key={item.id} className="overflow-hidden rounded-xl border-2 border-secondary">
                {/* Plain <img>: R2 host is not
                    configured in next.config yet. */}
                <img src={item.url} alt={item.caption ?? ''} className="w-full" />
                {item.caption ? (
                  <figcaption className="border-secondary border-t px-3 py-2 text-body-md text-muted-foreground">
                    {item.caption}
                  </figcaption>
                ) : null}
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      {purchase.supplierName || purchase.receiptNumber ? (
        <p className="mt-10 text-muted-foreground text-sm">
          {purchase.supplierName ? `Comprado en ${purchase.supplierName}.` : ''}
          {purchase.receiptNumber ? ` Factura ${purchase.receiptNumber}.` : ''}
        </p>
      ) : null}
    </article>
  )
}
