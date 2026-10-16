import { describe, expect, it } from 'vitest'
import { offeredDecisionOptionIds } from '../actionPending.js'

describe('offeredDecisionOptionIds', () => {
  it('offers every reaction the pause carries as a menu', () => {
    expect(
      offeredDecisionOptionIds({
        reactionChoice: { reactions: [{ useOptionId: 'inner' }, { useOptionId: 'outer' }] }
      })
    ).toEqual(['inner', 'outer'])
  })

  it('offers every reaction a cast waits on as a menu', () => {
    expect(
      offeredDecisionOptionIds({
        castReaction: { reactions: [{ useOptionId: 'low' }, { useOptionId: 'high' }] }
      })
    ).toEqual(['low', 'high'])
  })

  it('offers a Legendary Resistance option alone', () => {
    expect(
      offeredDecisionOptionIds({ legendaryResistance: { resistance: { useOptionId: 'resist' } } })
    ).toEqual(['resist'])
  })

  it('offers nothing for a pause that holds no decision', () => {
    expect(offeredDecisionOptionIds({})).toEqual([])
  })
})
