import {
  type DecimalString,
  type MinorUnits,
  multiplyBasisPoints,
  parseScaledDecimal,
  rescaleHalfUp,
  sumMinorUnits,
} from './money'

export type DeductionInput = {
  amount: DecimalString
  kind: 'gateway_fee' | 'withholding' | 'tax' | 'temporary_hold' | 'correction'
  finality: 'estimated' | 'final' | 'reversed'
}

export type AllocationUnitInput = {
  id: string
  ordinal: number
  grossMinor: MinorUnits
  donationBasisPoints?: number
}

export type UnitAllocation = {
  unitId: string
  ordinal: number
  grossMinor: MinorUnits
  deductionMinor: MinorUnits
  netMinor: MinorUnits
  donationMinor: MinorUnits
  venueMinor: MinorUnits
}

const byOrdinal = <T extends { ordinal: number }>(left: T, right: T) => left.ordinal - right.ordinal

/**
 * Allocate an integer amount by weight. Floors every share and assigns the residual in stable
 * ordinal order, which makes retries and cross-runtime results identical.
 */
export const allocateWeighted = (
  total: MinorUnits,
  units: readonly AllocationUnitInput[]
): MinorUnits[] => {
  if (total < BigInt(0)) throw new Error('Allocation total cannot be negative')
  if (units.length === 0) {
    if (total === BigInt(0)) return []
    throw new Error('Cannot allocate a non-zero amount without units')
  }

  const ordered = [...units].sort(byOrdinal)
  if (new Set(ordered.map((unit) => unit.ordinal)).size !== ordered.length) {
    throw new Error('Unit ordinals must be unique')
  }
  if (ordered.some((unit) => unit.grossMinor < BigInt(0))) {
    throw new Error('Unit weights cannot be negative')
  }

  const weight = sumMinorUnits(ordered.map((unit) => unit.grossMinor))
  if (weight === BigInt(0)) {
    if (total === BigInt(0)) return ordered.map(() => BigInt(0) as MinorUnits)
    throw new Error('Cannot allocate against zero weight')
  }

  const allocated = ordered.map((unit) => ((total * unit.grossMinor) / weight) as MinorUnits)
  let residual = total - sumMinorUnits(allocated)
  let cursor = 0
  while (residual > BigInt(0)) {
    allocated[cursor] = (allocated[cursor] + BigInt(1)) as MinorUnits
    residual -= BigInt(1)
    cursor = (cursor + 1) % allocated.length
  }
  return allocated
}

export const allocateNetProceeds = (input: {
  units: readonly AllocationUnitInput[]
  deductions: readonly DeductionInput[]
  donationBasisPoints?: number
  evidenceScale?: number
}): UnitAllocation[] => {
  const units = [...input.units].sort(byOrdinal)
  if (units.length === 0) throw new Error('At least one unit is required')

  const grossMinor = sumMinorUnits(units.map((unit) => unit.grossMinor))
  const evidenceScale = input.evidenceScale ?? 6
  const deductibleEvidence = input.deductions
    .filter((deduction) => deduction.finality === 'final' && deduction.kind !== 'temporary_hold')
    .reduce(
      (sum, deduction) => sum + parseScaledDecimal(deduction.amount, evidenceScale),
      BigInt(0)
    )
  const deductionMinor = rescaleHalfUp(deductibleEvidence, evidenceScale, 2)

  if (deductionMinor < BigInt(0)) throw new Error('Final deductions cannot be negative')
  if (deductionMinor > grossMinor) throw new Error('Final deductions exceed collected gross')

  const perUnitDeductions = allocateWeighted(deductionMinor, units)
  return units.map((unit, index) => {
    const unitDeduction = perUnitDeductions[index]
    const netMinor = (unit.grossMinor - unitDeduction) as MinorUnits
    const donationBasisPoints = unit.donationBasisPoints ?? input.donationBasisPoints
    if (donationBasisPoints === undefined) {
      throw new Error('Every unit requires a donation percentage')
    }
    const donationMinor = multiplyBasisPoints(netMinor, donationBasisPoints)
    return {
      unitId: unit.id,
      ordinal: unit.ordinal,
      grossMinor: unit.grossMinor,
      deductionMinor: unitDeduction,
      netMinor,
      donationMinor,
      venueMinor: (netMinor - donationMinor) as MinorUnits,
    }
  })
}
