import { describe, expect, it } from 'vitest'

import { shadow } from '../source-data/srd/creatures/shadow.js'

describe('Shadow Strength Drain source', () => {
  it('uses one melee attack with ordered damage and UUID-backed scalar outcomes', () => {
    const feature = (shadow.features ?? []).find(
      (candidate) => candidate.label === 'Strength Drain'
    )
    if (!feature) throw new Error('Expected the Shadow Strength Drain feature.')
    const effects = feature.effects ?? []
    expect(effects).toHaveLength(1)
    const effect = effects[0]
    if (!effect || !('paths' in effect))
      throw new Error('Expected an authored Strength Drain effect.')
    const path = effect.paths[0]
    if (!path || !('resultBlock' in path))
      throw new Error('Expected a fixed Strength Drain result.')
    expect(path.resultBlock.outcomes).toMatchObject([
      { effectKind: 'DAMAGE', diceConfig: '2d6+2' },
      {
        effectKind: 'SCALAR_REDUCTION',
        amount: { kind: 'DICE', diceConfig: '1d4' },
        stacking: 'ADDITIVE',
        floor: 0,
        recoveryTriggers: ['SHORT_REST', 'LONG_REST'],
        terminalConsequence: 'TARGET_DIED'
      }
    ])
  })
})
