import { describe, expect, it } from 'vitest'
import {
  castCounteredCarriesFailedCounters,
  castPendingContinues,
  offeredDecisionOptionIds
} from '../actionPending.js'

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

  it('offers no option while a cast waits on the roll of the check its counter owes', () => {
    expect(
      offeredDecisionOptionIds({ castReaction: { reactions: [{ useOptionId: 'low' }], check: {} } })
    ).toEqual([])
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

describe('castPendingContinues', () => {
  const held = { rollerActorId: 'second', castReaction: { declinedReactorActorIds: ['first'] } }
  const decline = { resolution: { kind: 'DECLINE' } }
  const option = { resolution: { kind: 'OPTION' } }
  const dice = { resolution: { kind: 'ENTER_DICE' } }
  const failedBy = (reactorActorId: string) => ({ reaction: { reactorActorId } })
  const checking = {
    rollerActorId: 'second',
    castReaction: { declinedReactorActorIds: ['first'], check: {} },
    failedCounters: [failedBy('first')]
  }

  it('lets an unrelated pause continue on any answer', () => {
    expect(castPendingContinues({}, option, {})).toBe(true)
  })

  it('lets a held cast leave its pause only by a decline or by a counter that owes a check', () => {
    expect(castPendingContinues(held, decline, {})).toBe(true)
    expect(castPendingContinues(held, option, {})).toBe(false)
    expect(castPendingContinues(held, null, {})).toBe(false)
    expect(castPendingContinues(held, dice, {})).toBe(false)
  })

  it('offers the next reactor only with every earlier decline and the answerer recorded', () => {
    const next = (declinedReactorActorIds: string[]) => ({
      castReaction: { declinedReactorActorIds }
    })
    expect(castPendingContinues(held, decline, next(['second', 'first']))).toBe(true)
    expect(castPendingContinues(held, decline, next(['first']))).toBe(false)
    expect(castPendingContinues(held, decline, next(['first', 'third']))).toBe(false)
  })

  it('holds the cast for the same reactor on its check when the counter owes one', () => {
    const toCheck = (overrides: Partial<typeof checking>) => ({ ...checking, ...overrides })
    expect(castPendingContinues(held, option, toCheck({ failedCounters: [] }))).toBe(true)
    expect(
      castPendingContinues(held, option, toCheck({ failedCounters: [], rollerActorId: 'third' }))
    ).toBe(false)
    expect(castPendingContinues(held, option, { rollerActorId: 'second' })).toBe(false)
    expect(
      castPendingContinues(held, option, {
        ...toCheck({ failedCounters: [] }),
        castReaction: { declinedReactorActorIds: [], check: {} }
      })
    ).toBe(false)
  })

  it('lets a choice whose check the app rolled leave the cast as a failed roll does', () => {
    const settled = (overrides: object) => ({
      castReaction: { declinedReactorActorIds: ['first', 'second'] },
      failedCounters: [failedBy('second')],
      ...overrides
    })
    expect(castPendingContinues(held, option, settled({}))).toBe(true)
    expect(castPendingContinues(held, option, settled({ failedCounters: [] }))).toBe(false)
    expect(
      castPendingContinues(
        held,
        option,
        settled({ castReaction: { declinedReactorActorIds: ['first'] } })
      )
    ).toBe(false)
    expect(castPendingContinues(checking, option, settled({}))).toBe(false)
  })

  it('records a failed check as a failed counter and a decline of the reactor', () => {
    const failedBoth = [failedBy('first'), failedBy('second')]
    expect(castPendingContinues(checking, dice, { failedCounters: failedBoth })).toBe(true)
    expect(
      castPendingContinues(checking, dice, {
        castReaction: { declinedReactorActorIds: ['first', 'second'] },
        failedCounters: failedBoth
      })
    ).toBe(true)
    expect(castPendingContinues(checking, dice, { failedCounters: [failedBy('first')] })).toBe(
      false
    )
    expect(castPendingContinues(checking, decline, { failedCounters: failedBoth })).toBe(false)
    expect(castPendingContinues(checking, option, { failedCounters: failedBoth })).toBe(false)
  })

  it('carries earlier failed counters through every later pause of the cast', () => {
    const carrying = { failedCounters: [failedBy('first')] }
    expect(castPendingContinues(carrying, dice, { failedCounters: [failedBy('first')] })).toBe(true)
    expect(castPendingContinues(carrying, dice, {})).toBe(false)
  })
})

describe('castCounteredCarriesFailedCounters', () => {
  const failedBy = (reactorActorId: string) => ({ reaction: { reactorActorId } })

  it('holds a countered cast to exactly the failed counters its pause carried', () => {
    const paused = { failedCounters: [failedBy('first')] }
    expect(
      castCounteredCarriesFailedCounters(paused, { failedCounters: [failedBy('first')] })
    ).toBe(true)
    expect(castCounteredCarriesFailedCounters({}, {})).toBe(true)
    expect(castCounteredCarriesFailedCounters(paused, {})).toBe(false)
    expect(
      castCounteredCarriesFailedCounters(paused, {
        failedCounters: [failedBy('first'), failedBy('second')]
      })
    ).toBe(false)
  })
})
