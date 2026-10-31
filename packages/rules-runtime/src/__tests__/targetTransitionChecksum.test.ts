import { describe, expect, it } from 'vitest'

import { targetTransitionChecksum, type TargetState } from '../encounterCharacterMechanicsBatch.js'

const before: TargetState = {
  deathSaves: null,
  currentHitPoints: 7,
  temporaryHitPoints: 0,
  maximumHitPoints: 11,
  conditionIds: [
    '00000000-0000-0000-0002-000600000000',
    '00000000-0000-0000-0002-000d00000000',
    '00000000-0000-0000-0002-000100000000'
  ],
  scalarValues: {}
}

describe('targetTransitionChecksum', () => {
  it('binds the same conditions to the same checksum in any stored order', () => {
    const reordered = { ...before, conditionIds: [...before.conditionIds].reverse() }
    expect(targetTransitionChecksum('actor', reordered)).toBe(
      targetTransitionChecksum('actor', before)
    )
  })

  it('binds a different set of conditions to a different checksum', () => {
    expect(
      targetTransitionChecksum('actor', { ...before, conditionIds: before.conditionIds.slice(1) })
    ).not.toBe(targetTransitionChecksum('actor', before))
  })
})
