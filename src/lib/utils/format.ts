/**
 * Spanish-Colombia formatting.
 *
 * es-CO uses '.' for thousands and ',' for decimals, the opposite of en-US.
 * Hardcoding toLocaleString() without a locale would render '2,840,000' on a
 * US-configured server and '2.840.000' on a Colombian laptop, so the locale is
 * always explicit.
 */

const LOCALE = 'es-CO'

/**
 * Money, with no cents. Colombian prices are quoted in whole pesos and a
 * trailing ',00' on every figure is just noise.
 */
/**
 * The one currency this product deals in.
 *
 * It exists because `venue.pledge_currency` used to be read as the currency of
 * the per-night estimate, and that column is dead (decision 34). It turned out
 * nothing had ever written it and the one reader already fell back to this
 * literal, so it was a default wearing a column's clothes. A venue-level
 * currency was the wrong shape anyway: the two tables that actually hold money,
 * `venue_contribution` and `venue_product`, each carry their own.
 */
export const MONEDA = 'COP'

export const formatCOP = (amount: number, currency: string = MONEDA) =>
  new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)

/** Bare number, grouped. For counts and quantities. */
export const formatNumber = (value: number, maximumFractionDigits = 0) =>
  new Intl.NumberFormat(LOCALE, { maximumFractionDigits }).format(value)

/** Percentages written the way a person would say them: 10%, not 10,00%. */
export const formatPercent = (value: number) =>
  `${new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 }).format(value)}%`

export const formatDate = (date: Date) =>
  new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)

export const formatShortDate = (date: Date) =>
  new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' }).format(date)
