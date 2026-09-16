export type CartQuoteLine = {
  venueId: string
  productId: string
  quantity: number
  unitGrossMinor: number
  donationBasisPoints: number
  currency: 'COP'
}

export const canonicalCartQuote = (lines: readonly CartQuoteLine[]): string =>
  JSON.stringify(
    [...lines]
      .sort((left, right) =>
        left.productId < right.productId ? -1 : left.productId > right.productId ? 1 : 0
      )
      .map((line) => ({
        venueId: line.venueId,
        productId: line.productId,
        quantity: line.quantity,
        unitGrossMinor: line.unitGrossMinor,
        donationBasisPoints: line.donationBasisPoints,
        currency: line.currency,
      }))
  )

export const cartQuoteHash = async (lines: readonly CartQuoteLine[]): Promise<string> => {
  const bytes = new TextEncoder().encode(canonicalCartQuote(lines))
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
