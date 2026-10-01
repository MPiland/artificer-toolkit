import { describe, expect, it } from 'vitest'
import { recoverableResources } from './campaignClockRecovery'

const resource = (
  id: string,
  remaining: number,
  max: number,
  ...triggers: string[]
): { id: string; max: number; remaining: number; recoveries: { trigger: string }[] } => ({
  id,
  max,
  remaining,
  recoveries: triggers.map((trigger) => ({ trigger }))
})

describe('recoverableResources', () => {
  const resources = [
    resource('spent-dawn', 0, 3, 'DAWN'),
    resource('full-dawn', 3, 3, 'DAWN'),
    resource('spent-dusk', 1, 2, 'DUSK', 'LONG_REST'),
    resource('spent-rest-only', 0, 1, 'LONG_REST'),
    resource('spent-both', 1, 4, 'DAWN', 'DUSK')
  ]

  it('keeps spent charges whose recoveries include the passed boundary', () => {
    expect(recoverableResources(resources, 'DAWN').map(({ id }) => id)).toEqual([
      'spent-dawn',
      'spent-both'
    ])
    expect(recoverableResources(resources, 'DUSK').map(({ id }) => id)).toEqual([
      'spent-dusk',
      'spent-both'
    ])
  })

  it('returns nothing when no spent charge recovers on the boundary', () => {
    expect(recoverableResources(resources, 'DAILY')).toEqual([])
  })
})
