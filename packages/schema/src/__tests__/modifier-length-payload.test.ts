import { describe, expect, it } from 'vitest'

import { modifierGrantDtoSchema } from '../grants/modifier.js'
import { AUTHORED_LENGTH_AMOUNT_MAX } from '../shared/authoredLimits.js'

const SENSE_DEFINITION_ID = '00000000-0000-0000-000a-000100000000'

const base = {
  grantKind: 'MODIFIER_GRANT',
  id: 'length-modifier',
  order: 1,
  selectionKind: 'GRANTED',
  scope: 'GLOBAL'
}

const speedModifier = (modifierKind: 'BONUS' | 'PENALTY' | 'SET_VALUE', payload: unknown) => ({
  ...base,
  valueDomainCode: 'SPEED',
  modifierKind,
  domain: { speedId: 'walk' },
  payload
})

const senseBonus = (payload: unknown) => ({
  ...base,
  valueDomainCode: 'SENSE_RANGE',
  modifierKind: 'BONUS',
  domain: { senseDefinitionId: SENSE_DEFINITION_ID },
  payload
})

const accepts = (grant: unknown) => modifierGrantDtoSchema.safeParse(grant).success

describe('SPEED and SENSE_RANGE modifier values are lengths (RELIABILITY-5.1)', () => {
  it.each(['BONUS', 'PENALTY', 'SET_VALUE'] as const)(
    'parses a %s speed modifier carrying an amount and a unit',
    (modifierKind) => {
      expect(
        modifierGrantDtoSchema.parse(speedModifier(modifierKind, { amount: 30, unit: 'FEET' }))
          .payload
      ).toEqual({ amount: 30, unit: 'FEET' })
    }
  )

  it('parses a sense range bonus carrying an amount and a unit', () => {
    expect(modifierGrantDtoSchema.parse(senseBonus({ amount: 12, unit: 'YARDS' })).payload).toEqual(
      { amount: 12, unit: 'YARDS' }
    )
  })

  it.each([
    ['speed bonus', (payload: unknown) => speedModifier('BONUS', payload)],
    ['speed penalty', (payload: unknown) => speedModifier('PENALTY', payload)],
    ['speed set value', (payload: unknown) => speedModifier('SET_VALUE', payload)],
    ['sense range bonus', senseBonus]
  ])('refuses a %s length with no unit, an unknown unit or an out-of-bounds amount', (_, build) => {
    expect(accepts(build({ amount: 30 }))).toBe(false)
    expect(accepts(build({ amount: 30, unit: 'FURLONGS' }))).toBe(false)
    expect(accepts(build({ amount: 30, unit: 'feet' }))).toBe(false)
    expect(accepts(build({ amount: -1, unit: 'FEET' }))).toBe(false)
    expect(accepts(build({ amount: AUTHORED_LENGTH_AMOUNT_MAX + 1, unit: 'FEET' }))).toBe(false)
    expect(accepts(build({ amount: Number.NaN, unit: 'FEET' }))).toBe(false)
    expect(accepts(build({ amount: AUTHORED_LENGTH_AMOUNT_MAX, unit: 'FEET' }))).toBe(true)
    expect(accepts(build({ amount: 0, unit: 'FEET' }))).toBe(true)
  })

  it('refuses the bare-number and valueKind payloads the length contract replaces', () => {
    expect(accepts(speedModifier('BONUS', { valueKind: 'FIXED', amount: 10 }))).toBe(false)
    expect(accepts(speedModifier('PENALTY', { valueKind: 'FIXED', amount: 10 }))).toBe(false)
    expect(accepts(speedModifier('SET_VALUE', { amount: 60 }))).toBe(false)
    expect(accepts(senseBonus({ valueKind: 'FIXED', amount: 30 }))).toBe(false)
  })

  it('refuses a payload that names more than the amount and unit', () => {
    expect(accepts(speedModifier('BONUS', { amount: 10, unit: 'FEET', valueKind: 'FIXED' }))).toBe(
      false
    )
  })
})
