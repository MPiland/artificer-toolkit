import { describe, expect, it } from 'vitest'

import { encounterActionChoiceDtoSchema } from '../api/encounterActionChoices.js'

const feet = (amount: number) => ({ amount, unit: 'FEET' as const })
const choice = {
  id: 'action-1',
  label: 'Longbow',
  grip: null,
  wieldConflict: null,
  warnings: [],
  target: { kind: 'ACTOR' as const, requiresOtherCreature: false },
  attackSlot: null
}

describe('encounter action choice range', () => {
  it('parses a choice without a range', () => {
    expect(encounterActionChoiceDtoSchema.parse(choice).range).toBeUndefined()
  })

  it.each([
    { kind: 'SELF' },
    { kind: 'WITHIN', distance: feet(5) },
    { kind: 'RANGED', normal: feet(150), long: feet(600) },
    { kind: 'UNLIMITED' }
  ] as const)('parses the $kind range', (range) => {
    expect(encounterActionChoiceDtoSchema.parse({ ...choice, range }).range).toEqual(range)
  })

  it.each([
    { kind: 'SELF', distance: feet(5) },
    { kind: 'UNLIMITED', extra: true },
    { kind: 'WITHIN', distance: feet(5), long: feet(10) },
    { kind: 'RANGED', normal: feet(150), long: feet(600), extra: true }
  ])('rejects extra keys on the $kind range', (range) => {
    expect(encounterActionChoiceDtoSchema.safeParse({ ...choice, range }).success).toBe(false)
  })

  it('requires both lengths of a RANGED range and the distance of a WITHIN range', () => {
    for (const range of [
      { kind: 'RANGED', normal: feet(150) },
      { kind: 'RANGED', long: feet(600) },
      { kind: 'WITHIN' },
      { kind: 'NEAR' }
    ])
      expect(encounterActionChoiceDtoSchema.safeParse({ ...choice, range }).success).toBe(false)
  })
})
