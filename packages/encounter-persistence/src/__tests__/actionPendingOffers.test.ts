import { describe, expect, it } from 'vitest'
import { castReactionAnswerContinues, offeredDecisionOptionIds } from '../actionPending.js'

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

  it('offers each way of paying for an on-hit rider', () => {
    expect(
      offeredDecisionOptionIds({
        onHitChoice: { options: [{ useOptionId: 'first' }, { useOptionId: 'second' }] }
      })
    ).toEqual(['first', 'second'])
  })

  it('offers nothing for a pause that holds no decision', () => {
    expect(offeredDecisionOptionIds({})).toEqual([])
  })
})

describe('castReactionAnswerContinues', () => {
  const held = { rollerActorId: 'second', castReaction: { declinedReactorActorIds: ['first'] } }
  const decline = { resolution: { kind: 'DECLINE' } }

  it('lets an unrelated pause continue on any answer', () => {
    expect(castReactionAnswerContinues({}, { resolution: { kind: 'OPTION' } }, {})).toBe(true)
  })

  it('lets a held cast continue only on a decline', () => {
    expect(castReactionAnswerContinues(held, decline, {})).toBe(true)
    expect(castReactionAnswerContinues(held, { resolution: { kind: 'OPTION' } }, {})).toBe(false)
    expect(castReactionAnswerContinues(held, null, {})).toBe(false)
  })

  it('offers the next reactor only with every earlier decline and the answerer recorded', () => {
    const next = (declinedReactorActorIds: string[]) => ({
      castReaction: { declinedReactorActorIds }
    })
    expect(castReactionAnswerContinues(held, decline, next(['second', 'first']))).toBe(true)
    expect(castReactionAnswerContinues(held, decline, next(['first']))).toBe(false)
    expect(castReactionAnswerContinues(held, decline, next(['first', 'third']))).toBe(false)
  })
})
