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

  describe('with a counter standing against the cast (a Counterspell cast is itself counterable)', () => {
    const standing = (...reactorActorIds: string[]) => ({
      counters: reactorActorIds.map(failedBy),
      castDeclinedReactorActorIds: ['early']
    })
    /** `second` is offered the chance to counter `first`'s counter; `early` declined the cast itself. */
    const nested = {
      rollerActorId: 'second',
      castReaction: { declinedReactorActorIds: ['other'], chain: standing('first') }
    }
    const nestedChecking = {
      ...nested,
      castReaction: { ...nested.castReaction, check: {} }
    }

    it('stands the answerer as the first counter, opening a fresh level that keeps the cast’s declines', () => {
      const pushed = (overrides: object = {}) => ({
        rollerActorId: 'third',
        castReaction: {
          declinedReactorActorIds: [],
          chain: { counters: [failedBy('second')], castDeclinedReactorActorIds: ['first'] }
        },
        ...overrides
      })
      expect(castPendingContinues(held, option, pushed())).toBe(true)
      expect(
        castPendingContinues(
          held,
          option,
          pushed({
            castReaction: {
              declinedReactorActorIds: [],
              chain: { counters: [failedBy('second')], castDeclinedReactorActorIds: [] }
            }
          })
        )
      ).toBe(false)
      expect(
        castPendingContinues(
          held,
          option,
          pushed({
            castReaction: {
              declinedReactorActorIds: ['first'],
              chain: { counters: [failedBy('second')], castDeclinedReactorActorIds: ['first'] }
            }
          })
        )
      ).toBe(false)
      expect(
        castPendingContinues(held, option, pushed({ failedCounters: [failedBy('second')] }))
      ).toBe(false)
      expect(castPendingContinues(held, decline, pushed())).toBe(false)
    })

    it('declines the answerer at the counter’s level only, keeping the counters standing', () => {
      const declinedAt = (declinedReactorActorIds: string[], chain = standing('first')) => ({
        castReaction: { declinedReactorActorIds, chain }
      })
      expect(castPendingContinues(nested, decline, declinedAt(['other', 'second']))).toBe(true)
      expect(castPendingContinues(nested, decline, declinedAt(['other']))).toBe(false)
      expect(
        castPendingContinues(nested, decline, declinedAt(['other', 'second'], standing('second')))
      ).toBe(false)
      // A decline leaves one counter standing, which counters the cast, so the cast cannot go on.
      expect(castPendingContinues(nested, decline, {})).toBe(false)
    })

    it('stands a second counter on a counter that was itself countered, then offers the cast again', () => {
      const resolved = (overrides: object = {}) => ({
        rollerActorId: 'third',
        castReaction: { declinedReactorActorIds: ['early'] },
        failedCounters: [failedBy('first'), failedBy('second')],
        ...overrides
      })
      expect(castPendingContinues(nested, option, resolved())).toBe(true)
      expect(
        castPendingContinues(nested, option, { failedCounters: resolved().failedCounters })
      ).toBe(true)
      expect(
        castPendingContinues(
          nested,
          option,
          resolved({ castReaction: { declinedReactorActorIds: ['other'] } })
        )
      ).toBe(false)
      expect(
        castPendingContinues(nested, option, resolved({ failedCounters: [failedBy('first')] }))
      ).toBe(false)
    })

    it('fails the answerer on a failed roll without ending the counters standing', () => {
      const failedAt = (overrides: object = {}) => ({
        castReaction: { declinedReactorActorIds: ['other', 'second'], chain: standing('first') },
        failedCounters: [failedBy('second')],
        ...overrides
      })
      expect(castPendingContinues(nestedChecking, dice, failedAt())).toBe(true)
      expect(castPendingContinues(nestedChecking, dice, failedAt({ failedCounters: [] }))).toBe(
        false
      )
      // A failed roll leaves one counter standing, which counters the cast.
      expect(
        castPendingContinues(nestedChecking, dice, { failedCounters: [failedBy('second')] })
      ).toBe(false)
    })

    it('holds the cast for the same reactor on a check owed against the counter', () => {
      const toCheck = (overrides: object = {}) => ({
        rollerActorId: 'second',
        castReaction: { ...nested.castReaction, check: {} },
        ...overrides
      })
      expect(castPendingContinues(nested, option, toCheck())).toBe(true)
      expect(
        castPendingContinues(
          nested,
          option,
          toCheck({
            castReaction: {
              declinedReactorActorIds: ['other'],
              chain: standing('second'),
              check: {}
            }
          })
        )
      ).toBe(false)
    })
  })
})

describe('castCounteredCarriesFailedCounters', () => {
  const failedBy = (reactorActorId: string) => ({ reaction: { reactorActorId } })
  const decline = { resolution: { kind: 'DECLINE' } }
  const option = { resolution: { kind: 'OPTION' } }
  const dice = { resolution: { kind: 'ENTER_DICE' } }
  const offer = (rollerActorId: string, overrides: object = {}) => ({
    rollerActorId,
    castReaction: { declinedReactorActorIds: [] },
    ...overrides
  })

  it('counters at the answerer’s own choice, holding the cast to the failed counters its pause carried', () => {
    const paused = offer('first', { failedCounters: [failedBy('earlier')] })
    expect(
      castCounteredCarriesFailedCounters(paused, option, 'first', {
        failedCounters: [failedBy('earlier')]
      })
    ).toBe(true)
    expect(castCounteredCarriesFailedCounters(paused, option, 'first', {})).toBe(false)
    expect(
      castCounteredCarriesFailedCounters(paused, option, 'first', {
        failedCounters: [failedBy('earlier'), failedBy('first')]
      })
    ).toBe(false)
    expect(
      castCounteredCarriesFailedCounters(paused, option, 'other', {
        failedCounters: [failedBy('earlier')]
      })
    ).toBe(false)
    // A decline never counters; nor does a failed roll when no counter stands.
    expect(
      castCounteredCarriesFailedCounters(paused, decline, 'first', {
        failedCounters: [failedBy('earlier')]
      })
    ).toBe(false)
    expect(castCounteredCarriesFailedCounters({}, option, 'first', {})).toBe(false)
  })

  describe('with counters standing', () => {
    const standing = (...reactorActorIds: string[]) => ({
      counters: reactorActorIds.map(failedBy),
      castDeclinedReactorActorIds: []
    })
    const nested = (chain: ReturnType<typeof standing>, overrides: object = {}) =>
      offer('last', { castReaction: { declinedReactorActorIds: [], chain }, ...overrides })

    it('lets the first counter stand when nobody counters it, spending the later ones with the cast', () => {
      const lone = nested(standing('first'))
      expect(castCounteredCarriesFailedCounters(lone, decline, 'first', {})).toBe(true)
      expect(
        castCounteredCarriesFailedCounters(lone, decline, 'first', {
          failedCounters: [failedBy('first')]
        })
      ).toBe(false)
      expect(castCounteredCarriesFailedCounters(lone, decline, 'other', {})).toBe(false)
    })

    it('spends a failed roll at the counter’s level with the cast that is still countered', () => {
      const lone = nested(standing('first'), {
        castReaction: { declinedReactorActorIds: [], chain: standing('first'), check: {} }
      })
      expect(
        castCounteredCarriesFailedCounters(lone, dice, 'first', {
          failedCounters: [failedBy('last')]
        })
      ).toBe(true)
      expect(castCounteredCarriesFailedCounters(lone, dice, 'first', {})).toBe(false)
    })

    it('counters when the answerer stands a third counter, and spends the second', () => {
      const pair = nested(standing('first', 'second'))
      expect(
        castCounteredCarriesFailedCounters(pair, option, 'first', {
          failedCounters: [failedBy('second'), failedBy('last')]
        })
      ).toBe(true)
      // Only the first counter stands against the cast; a later one never counters it.
      expect(
        castCounteredCarriesFailedCounters(pair, option, 'second', {
          failedCounters: [failedBy('first'), failedBy('last')]
        })
      ).toBe(false)
    })
  })
})
