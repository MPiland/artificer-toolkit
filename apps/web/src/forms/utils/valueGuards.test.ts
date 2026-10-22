import { describe, expect, it } from 'vitest'
import { filterOptions, findOption, isRecord } from './valueGuards'

describe('findOption', () => {
  const options = ['NORMAL', 'ADVANTAGE'] as const

  it('returns the option equal to an untrusted value', () => {
    expect(findOption(options, 'ADVANTAGE')).toBe('ADVANTAGE')
  })

  it('returns undefined for a value that is not an option', () => {
    expect(findOption(options, 'DISADVANTAGE')).toBeUndefined()
    expect(findOption(options, null)).toBeUndefined()
    expect(findOption(options, undefined)).toBeUndefined()
    expect(findOption(options, 1)).toBeUndefined()
  })

  it('matches numeric options by identity, not by coercion', () => {
    expect(findOption([1, 2], 2)).toBe(2)
    expect(findOption([1, 2], '2')).toBeUndefined()
  })
})

describe('filterOptions', () => {
  it('keeps only the options present in the untrusted values, in option order', () => {
    expect(filterOptions(['A', 'B', 'C'], ['C', 'x', 'A', 3])).toEqual(['A', 'C'])
  })

  it('returns nothing when no value is an option', () => {
    expect(filterOptions(['A'], ['x'])).toEqual([])
  })
})

describe('isRecord', () => {
  it('accepts plain objects only', () => {
    expect(isRecord({ a: 1 })).toBe(true)
    expect(isRecord([])).toBe(false)
    expect(isRecord(null)).toBe(false)
    expect(isRecord('x')).toBe(false)
  })
})
