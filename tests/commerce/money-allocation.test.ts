import { describe, expect, test } from 'bun:test'
import { allocateNetProceeds, allocateWeighted } from '../../src/lib/commerce/allocation'
import {
  decimalString,
  formatMinorUnits,
  multiplyBasisPoints,
  parseMinorUnits,
  rescaleHalfUp,
} from '../../src/lib/commerce/money'

describe('exact commerce money arithmetic', () => {
  test('parses and formats decimal strings without floating point', () => {
    expect(String(parseMinorUnits('30000.00'))).toBe('3000000')
    expect(String(parseMinorUnits('-1.25'))).toBe('-125')
    expect(String(formatMinorUnits(BigInt(3_000_001)))).toBe('30000.01')
    expect(() => parseMinorUnits('1.001')).toThrow('exceeds scale')
    expect(() => parseMinorUnits('01.00')).toThrow('Invalid decimal string')
  })

  test('uses half-up rounding for signs, scales, and basis points', () => {
    expect(String(rescaleHalfUp(BigInt(15), 3, 2))).toBe('2')
    expect(String(rescaleHalfUp(BigInt(-15), 3, 2))).toBe('-2')
    expect(String(multiplyBasisPoints(BigInt(101), 5_000))).toBe('51')
    expect(String(multiplyBasisPoints(BigInt(101), 4_000))).toBe('40')
    expect(String(multiplyBasisPoints(BigInt(101), 10_000))).toBe('101')
  })
})

describe('deterministic net allocation', () => {
  const units = [
    { id: 'unit-2', ordinal: 2, grossMinor: parseMinorUnits('1.00') },
    { id: 'unit-1', ordinal: 1, grossMinor: parseMinorUnits('1.00') },
  ] as const

  test('assigns residual minor units by stable ordinal', () => {
    expect(allocateWeighted(parseMinorUnits('0.01'), units).map(String)).toEqual(['1', '0'])

    const result = allocateNetProceeds({
      units,
      deductions: [
        {
          amount: decimalString('0.010000'),
          kind: 'gateway_fee',
          finality: 'final',
        },
      ],
      donationBasisPoints: 5_000,
    })

    expect(
      result.map((unit) => ({
        ...unit,
        grossMinor: String(unit.grossMinor),
        deductionMinor: String(unit.deductionMinor),
        netMinor: String(unit.netMinor),
        donationMinor: String(unit.donationMinor),
        venueMinor: String(unit.venueMinor),
      }))
    ).toEqual([
      {
        unitId: 'unit-1',
        ordinal: 1,
        grossMinor: '100',
        deductionMinor: '1',
        netMinor: '99',
        donationMinor: '50',
        venueMinor: '49',
      },
      {
        unitId: 'unit-2',
        ordinal: 2,
        grossMinor: '100',
        deductionMinor: '0',
        netMinor: '100',
        donationMinor: '50',
        venueMinor: '50',
      },
    ])
  })

  test('ignores estimates, reversals, and temporary holds in the final split', () => {
    const result = allocateNetProceeds({
      units: [{ id: 'unit-1', ordinal: 1, grossMinor: parseMinorUnits('100000.00') }],
      deductions: [
        { amount: decimalString('6000.000000'), kind: 'gateway_fee', finality: 'final' },
        { amount: decimalString('500.000000'), kind: 'tax', finality: 'estimated' },
        { amount: decimalString('700.000000'), kind: 'withholding', finality: 'reversed' },
        { amount: decimalString('800.000000'), kind: 'temporary_hold', finality: 'final' },
      ],
      donationBasisPoints: 5_000,
    })

    expect({
      ...result[0],
      grossMinor: String(result[0]?.grossMinor),
      deductionMinor: String(result[0]?.deductionMinor),
      netMinor: String(result[0]?.netMinor),
      donationMinor: String(result[0]?.donationMinor),
      venueMinor: String(result[0]?.venueMinor),
    }).toEqual({
      unitId: 'unit-1',
      ordinal: 1,
      grossMinor: '10000000',
      deductionMinor: '600000',
      netMinor: '9400000',
      donationMinor: '4700000',
      venueMinor: '4700000',
    })
  })

  test('rejects invalid or impossible allocations', () => {
    expect(() => allocateWeighted(parseMinorUnits('0.01'), [])).toThrow('without units')
    expect(() =>
      allocateWeighted(parseMinorUnits('0.01'), [
        { id: 'one', ordinal: 1, grossMinor: parseMinorUnits('0.01') },
        { id: 'two', ordinal: 1, grossMinor: parseMinorUnits('0.01') },
      ])
    ).toThrow('ordinals must be unique')
    expect(() =>
      allocateNetProceeds({
        units: [{ id: 'one', ordinal: 1, grossMinor: parseMinorUnits('1.00') }],
        deductions: [{ amount: decimalString('1.010000'), kind: 'gateway_fee', finality: 'final' }],
        donationBasisPoints: 4_000,
      })
    ).toThrow('exceed collected gross')
  })
})
