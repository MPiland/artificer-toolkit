import { describe, expect, it } from 'vitest'

import { AUTHORED_LENGTH_AMOUNT_MAX } from '../shared/authoredLimits.js'
import { rangeDtoSchema } from '../shared/range.js'
import { shapeDtoSchema } from '../shared/shape.js'
import { speedDtoSchema } from '../shared/speed.js'

const breakpoints = (amount: number) => ({
  scalingKind: 'BREAKPOINTS' as const,
  scalingSource: 'CHARACTER_LEVEL' as const,
  breakpoints: [{ id: 'b1', level: 5, order: 0, value: { amount, unit: 'FEET' as const } }]
})

const distanceRange = (fields: Record<string, unknown>) => ({
  id: 'range-1',
  rangeKind: 'DISTANCE',
  amount: 10,
  unit: 'MILES',
  ...fields
})

const sphere = (radius: Record<string, unknown>) => ({
  id: 'shape-1',
  shapeKind: 'SPHERE',
  radius: { amount: 10, unit: 'MILES', ...radius }
})

const parsers: Record<string, (amount: number) => boolean> = {
  'range amount': (amount) => rangeDtoSchema.safeParse(distanceRange({ amount })).success,
  'range long amount': (amount) =>
    rangeDtoSchema.safeParse(distanceRange({ amount: 1, longAmount: amount })).success,
  'range scaling amount': (amount) =>
    rangeDtoSchema.safeParse(distanceRange({ scaling: breakpoints(amount) })).success,
  'shape amount': (amount) => shapeDtoSchema.safeParse(sphere({ amount })).success,
  'shape scaling amount': (amount) =>
    shapeDtoSchema.safeParse(sphere({ scaling: breakpoints(amount) })).success,
  'speed amount': (amount) =>
    speedDtoSchema.safeParse({ speedId: 'walk', amount, unit: 'MILES' }).success
}

describe('authored length amount bound', () => {
  it('pins the maximum to the Scene length bound', () => {
    expect(AUTHORED_LENGTH_AMOUNT_MAX).toBe(1_000_000)
  })

  it.each(Object.entries(parsers))('%s accepts the maximum only', (_name, parses) => {
    expect(parses(AUTHORED_LENGTH_AMOUNT_MAX)).toBe(true)
    expect(parses(AUTHORED_LENGTH_AMOUNT_MAX + 1)).toBe(false)
    expect(parses(Number.POSITIVE_INFINITY)).toBe(false)
    expect(parses(Number.MAX_VALUE)).toBe(false)
  })
})
