/**
 * Application-generated row IDs.
 *
 * Every id in this schema is `text('id').primaryKey()` with the value supplied
 * by the caller: Better-Auth generates its own for user/session/account, and the
 * payment tables reuse the provider's id. Rows we create ourselves need this.
 *
 * The prefix makes a bare id self-describing in logs and in psql output.
 */
export const createId = (prefix: string) => `${prefix}_${crypto.randomUUID()}`

export const ID_PREFIX = {
  venue: 'ven',
  materialPurchase: 'mpu',
  materialPurchaseItem: 'mpi',
  materialPurchaseMedia: 'mpm',
  partyNight: 'pnt',
  partyPhoto: 'pph',
  photoClaim: 'pcl',
  venueMember: 'vmb',
  venueInvitation: 'vin',
  venueApplication: 'vap',
  photoReport: 'prp',
  venueContribution: 'vco',
  venueContributionMedia: 'vcm',
  venueProduct: 'vpr',
  productOrder: 'ord',
  orderRedemption: 'red',
  ledgerAccount: 'lac',
  ledgerTransaction: 'ltx',
  ledgerEntry: 'led',
  venueSettlement: 'stl',
} as const
