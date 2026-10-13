import { describe, expect, it } from 'vitest'

import { senseGrantDtoSchema } from '../grants/sense.js'

const senseGrantWithRange = (range: unknown) => ({
  grantKind: 'SENSE_GRANT',
  id: 'sense-grant',
  order: 1,
  selectionKind: 'GRANTED',
  scalingKind: 'NONE',
  authoringModeKind: 'SELECTED',
  senseIds: ['darkvision'],
  range
})

describe('SENSE_GRANT range', () => {
  it.each([
    ['DISTANCE', { id: 'range', rangeKind: 'DISTANCE', amount: 60, unit: 'FEET' }],
    ['UNLIMITED', { id: 'range', rangeKind: 'UNLIMITED' }]
  ])('accepts a %s range', (_kind, range) => {
    expect(senseGrantDtoSchema.safeParse(senseGrantWithRange(range)).success).toBe(true)
  })

  it.each(['SELF', 'TOUCH', 'SIGHT', 'SPECIAL'])(
    'rejects a %s range, which a sense cannot reach by',
    (rangeKind) => {
      expect(
        senseGrantDtoSchema.safeParse(senseGrantWithRange({ id: 'range', rangeKind })).success
      ).toBe(false)
    }
  )
})

describe('SENSE_GRANT DISTANCE range', () => {
  const distance = { id: 'range', rangeKind: 'DISTANCE', amount: 60, unit: 'FEET' }

  it('rejects a long range, which only a ranged attack has', () => {
    expect(
      senseGrantDtoSchema.safeParse(senseGrantWithRange({ ...distance, longAmount: 120 })).success
    ).toBe(false)
  })

  it('rejects range scaling, which no sense resolves', () => {
    const scaling = {
      scalingKind: 'BREAKPOINTS',
      scalingSource: 'CHARACTER_LEVEL',
      breakpoints: [{ id: 'bp', level: 5, order: 1, value: { amount: 120, unit: 'FEET' } }]
    }
    expect(
      senseGrantDtoSchema.safeParse(senseGrantWithRange({ ...distance, scaling })).success
    ).toBe(false)
  })
})
