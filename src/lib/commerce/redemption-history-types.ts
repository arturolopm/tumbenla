export type RecentVenueOrder = {
  id: string
  lines: readonly { productName: string; quantity: number }[]
  buyerName: string
  totalUnits: number
  chargeAtBar: number | null
  redeemedAt: string
}
