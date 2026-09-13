/** Exact decimal text as returned by PostgreSQL `numeric` columns. */
export type DecimalString = string & { readonly __decimalString: unique symbol }

/** Minor currency units. COP still uses two stored decimal places for provider reconciliation. */
export type MinorUnits = bigint & { readonly __minorUnits: unique symbol }

const DECIMAL_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/

export const decimalString = (value: string): DecimalString => {
  const normalized = value.trim()
  if (!DECIMAL_PATTERN.test(normalized)) {
    throw new Error(`Invalid decimal string: ${value}`)
  }
  return normalized as DecimalString
}

const powerOfTen = (scale: number): bigint => {
  if (!Number.isInteger(scale) || scale < 0 || scale > 18) {
    throw new Error(`Invalid decimal scale: ${scale}`)
  }
  return BigInt(10) ** BigInt(scale)
}

/** Parse without floating point. Extra non-zero precision is rejected, never silently rounded. */
export const parseMinorUnits = (value: string, scale = 2): MinorUnits => {
  const parsed = decimalString(value)
  const negative = parsed.startsWith('-')
  const unsigned = negative ? parsed.slice(1) : parsed
  const [whole, fraction = ''] = unsigned.split('.')

  if (fraction.length > scale && /[1-9]/.test(fraction.slice(scale))) {
    throw new Error(`Decimal ${value} exceeds scale ${scale}`)
  }

  const paddedFraction = fraction.slice(0, scale).padEnd(scale, '0')
  const magnitude = BigInt(whole) * powerOfTen(scale) + BigInt(paddedFraction || '0')
  return (negative ? -magnitude : magnitude) as MinorUnits
}

export const formatMinorUnits = (amount: bigint, scale = 2): DecimalString => {
  const negative = amount < BigInt(0)
  const magnitude = negative ? -amount : amount
  const divisor = powerOfTen(scale)
  const whole = magnitude / divisor
  const fraction = (magnitude % divisor).toString().padStart(scale, '0')
  return `${negative ? '-' : ''}${whole}.${fraction}` as DecimalString
}

/** Parse a provider decimal at a fixed evidence precision (six places by default). */
export const parseScaledDecimal = (value: string, scale = 6): bigint => {
  const parsed = decimalString(value)
  const negative = parsed.startsWith('-')
  const unsigned = negative ? parsed.slice(1) : parsed
  const [whole, fraction = ''] = unsigned.split('.')
  if (fraction.length > scale && /[1-9]/.test(fraction.slice(scale))) {
    throw new Error(`Decimal ${value} exceeds evidence scale ${scale}`)
  }
  const magnitude =
    BigInt(whole) * powerOfTen(scale) + BigInt(fraction.slice(0, scale).padEnd(scale, '0') || '0')
  return negative ? -magnitude : magnitude
}

/** Integer division rounded half away from zero. */
export const divideHalfUp = (numerator: bigint, denominator: bigint): bigint => {
  if (denominator <= BigInt(0)) throw new Error('Denominator must be positive')
  const negative = numerator < BigInt(0)
  const magnitude = negative ? -numerator : numerator
  const quotient = magnitude / denominator
  const remainder = magnitude % denominator
  const rounded = remainder * BigInt(2) >= denominator ? quotient + BigInt(1) : quotient
  return negative ? -rounded : rounded
}

export const rescaleHalfUp = (amount: bigint, fromScale: number, toScale: number): MinorUnits => {
  if (fromScale === toScale) return amount as MinorUnits
  if (fromScale < toScale) return (amount * powerOfTen(toScale - fromScale)) as MinorUnits
  return divideHalfUp(amount, powerOfTen(fromScale - toScale)) as MinorUnits
}

export const multiplyBasisPoints = (amount: bigint, basisPoints: number): MinorUnits => {
  if (!Number.isInteger(basisPoints) || basisPoints < 0 || basisPoints > 10_000) {
    throw new Error(`Invalid basis points: ${basisPoints}`)
  }
  return divideHalfUp(amount * BigInt(basisPoints), BigInt(10_000)) as MinorUnits
}

export const sumMinorUnits = (amounts: readonly bigint[]): MinorUnits =>
  amounts.reduce((sum, amount) => sum + amount, BigInt(0)) as MinorUnits
