import { describe, expect, it } from 'vitest'

import { selectHitPointPoolTargets } from '../encounterHitPointPool.js'

const candidates = (...hitPoints: number[]) =>
  hitPoints.map((currentHitPoints, index) => ({ actorId: `actor-${index}`, currentHitPoints }))

describe('a hit-point pool choosing whom an area affects (SPELLS-27.T8)', () => {
  it('takes creatures from the lowest current hit points up while the pool lasts', () => {
    // 25 less 4, 9 and 11 leaves 1: the 14 no longer fits.
    expect(selectHitPointPoolTargets(25, candidates(14, 9, 4, 11))).toEqual([
      'actor-2',
      'actor-1',
      'actor-3'
    ])
  })

  it('affects a creature whose hit points equal what remains', () => {
    expect(selectHitPointPoolTargets(13, candidates(9, 4))).toEqual(['actor-1', 'actor-0'])
  })

  it('affects no creature whose hit points exceed the pool', () => {
    expect(selectHitPointPoolTargets(5, candidates(6, 40))).toEqual([])
  })

  it('takes equal hit points in the order the candidates came', () => {
    expect(selectHitPointPoolTargets(8, candidates(4, 4, 4))).toEqual(['actor-0', 'actor-1'])
  })

  it('affects nothing from an empty area', () => {
    expect(selectHitPointPoolTargets(20, [])).toEqual([])
  })
})
