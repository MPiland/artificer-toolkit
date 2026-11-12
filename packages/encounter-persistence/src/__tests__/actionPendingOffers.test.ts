import { describe, expect, it } from 'vitest'
import {
  castCounteredCarriesUsedReactions,
  castPendingContinues,
  offeredDecisionOptionIds,
  passedGateAfter
} from '../actionPending.js'

/** A gate a ward raised, as a pending context names it. */
const ward = (effectId: string) => ({ origin: { kind: 'WARD', effectId } })

describe('offeredDecisionOptionIds', () => {
  it('offers every reaction the pause carries as a menu', () => {
    expect(
      offeredDecisionOptionIds({
        pause: {
          kind: 'REACTION' as const,
          payload: { reactions: [{ useOptionId: 'inner' }, { useOptionId: 'outer' }] }
        }
      })
    ).toEqual(['inner', 'outer'])
  })

  it('offers every reaction a cast waits on as a menu', () => {
    expect(
      offeredDecisionOptionIds({
        pause: {
          kind: 'CAST_REACTION' as const,
          payload: { reactions: [{ useOptionId: 'low' }, { useOptionId: 'high' }] }
        }
      })
    ).toEqual(['low', 'high'])
  })

  it('offers no option while a cast waits on the roll of the check its counter owes', () => {
    expect(
      offeredDecisionOptionIds({
        pause: {
          kind: 'CAST_REACTION' as const,
          payload: { reactions: [{ useOptionId: 'low' }], check: {} }
        }
      })
    ).toEqual([])
  })

  it('offers a Legendary Resistance option alone', () => {
    expect(
      offeredDecisionOptionIds({
        pause: {
          kind: 'LEGENDARY_RESISTANCE' as const,
          payload: { resistance: { useOptionId: 'resist' } }
        }
      })
    ).toEqual(['resist'])
  })

  it('offers each way of paying for an on-hit rider', () => {
    expect(
      offeredDecisionOptionIds({
        pause: {
          kind: 'ON_HIT' as const,
          payload: { options: [{ useOptionId: 'first' }, { useOptionId: 'second' }] }
        }
      })
    ).toEqual(['first', 'second'])
  })

  it('offers each creature a lost action can be turned on', () => {
    expect(
      offeredDecisionOptionIds({
        pause: {
          kind: 'ATTACK_RETARGET' as const,
          payload: { options: [{ useOptionId: 'one' }, { useOptionId: 'two' }] }
        }
      })
    ).toEqual(['one', 'two'])
  })

  it('offers nothing for a pause that holds no decision', () => {
    expect(offeredDecisionOptionIds({})).toEqual([])
  })
})

describe('castPendingContinues', () => {
  const held = {
    rollerActorId: 'second',
    pause: { kind: 'CAST_REACTION' as const, payload: { declinedReactorActorIds: ['first'] } }
  }
  const decline = { resolution: { kind: 'DECLINE' } }
  const option = { resolution: { kind: 'OPTION' } }
  const dice = { resolution: { kind: 'ENTER_DICE' } }
  const failedBy = (reactorActorId: string) => ({ reaction: { reactorActorId } })
  const checking = {
    rollerActorId: 'second',
    pause: {
      kind: 'CAST_REACTION' as const,
      payload: { declinedReactorActorIds: ['first'], check: {} }
    },
    usedReactions: [failedBy('first')]
  }

  it('lets an unrelated pause continue on any answer', () => {
    expect(castPendingContinues({}, option, {})).toBe(true)
  })

  describe('a failed ward save offering a new target', () => {
    const gateHeld = {
      rollerActorId: 'attacker',
      pause: { kind: 'INCOMING_GATE' as const, payload: ward('ward') }
    }
    const offered = {
      rollerActorId: 'attacker',
      pause: { kind: 'ATTACK_RETARGET' as const, payload: { gate: ward('ward') } }
    }

    it('follows the roll that failed that ward, and no other ward', () => {
      expect(castPendingContinues(gateHeld, dice, offered)).toBe(true)
      expect(
        castPendingContinues(gateHeld, dice, {
          ...offered,
          pause: { kind: 'ATTACK_RETARGET' as const, payload: { gate: ward('other') } }
        })
      ).toBe(false)
      expect(castPendingContinues({ rollerActorId: 'attacker' }, dice, offered)).toBe(false)
    })

    it('carries no passed ward and no counters', () => {
      expect(
        castPendingContinues(gateHeld, dice, { ...offered, passedIncomingGate: ward('ward') })
      ).toBe(false)
      expect(
        castPendingContinues(gateHeld, dice, { ...offered, usedReactions: [failedBy('first')] })
      ).toBe(false)
    })

    it('is left only by choosing a creature, who begins afresh', () => {
      expect(castPendingContinues(offered, option, {})).toBe(true)
      expect(castPendingContinues(offered, decline, {})).toBe(false)
      expect(castPendingContinues(offered, dice, {})).toBe(false)
      expect(castPendingContinues(offered, null, {})).toBe(false)
      expect(
        castPendingContinues(offered, option, {
          pause: { kind: 'INCOMING_GATE' as const, payload: ward('second-ward') },
          passedIncomingGate: ward('ward')
        })
      ).toBe(false)
      expect(castPendingContinues(offered, option, { usedReactions: [failedBy('first')] })).toBe(
        false
      )
    })

    it('may offer again from the chosen creature’s own ward, and only after a choice', () => {
      const again = {
        ...offered,
        pause: { kind: 'ATTACK_RETARGET' as const, payload: { gate: ward('second-ward') } }
      }
      expect(castPendingContinues(offered, option, again)).toBe(true)
      expect(castPendingContinues(offered, decline, again)).toBe(false)
    })
  })

  describe('a gate the action’s source passed', () => {
    const trigger = { origin: { kind: 'TRIGGER', triggerLevel: 4 } }
    const gateHeld = {
      rollerActorId: 'source',
      pause: { kind: 'INCOMING_GATE' as const, payload: trigger }
    }

    it('is passed by the roll its pause waited on, and stays passed in every later pause', () => {
      expect(castPendingContinues(gateHeld, dice, { passedIncomingGate: trigger })).toBe(true)
      expect(
        castPendingContinues({ passedIncomingGate: trigger }, dice, { passedIncomingGate: trigger })
      ).toBe(true)
      expect(castPendingContinues(gateHeld, dice, {})).toBe(false)
      expect(castPendingContinues({ passedIncomingGate: trigger }, dice, {})).toBe(false)
    })

    it('is the gate that was asked: a ward and a trigger’s check never stand for each other', () => {
      expect(castPendingContinues(gateHeld, dice, { passedIncomingGate: ward('ward') })).toBe(false)
      expect(
        castPendingContinues(
          { rollerActorId: 'source', pause: { kind: 'INCOMING_GATE', payload: ward('ward') } },
          dice,
          { passedIncomingGate: trigger }
        )
      ).toBe(false)
      const otherLevel = { origin: { kind: 'TRIGGER', triggerLevel: 5 } }
      expect(castPendingContinues(gateHeld, dice, { passedIncomingGate: otherLevel })).toBe(false)
    })

    it('is carried by the action that passed it, so a commit straight after its roll continues', () => {
      expect(passedGateAfter(gateHeld)).toEqual(trigger)
      expect(
        castPendingContinues(gateHeld, dice, { passedIncomingGate: passedGateAfter(gateHeld) })
      ).toBe(true)
      expect(passedGateAfter({ passedIncomingGate: ward('ward') })).toEqual(ward('ward'))
      expect(passedGateAfter({})).toBeUndefined()
    })

    it('is never asked again by a later pause of the same action', () => {
      expect(castPendingContinues({ passedIncomingGate: trigger }, dice, gateHeld)).toBe(false)
    })
  })

  it('lets a held cast leave its pause only by a decline or by a counter that owes a check', () => {
    expect(castPendingContinues(held, decline, {})).toBe(true)
    expect(castPendingContinues(held, option, {})).toBe(false)
    expect(castPendingContinues(held, null, {})).toBe(false)
    expect(castPendingContinues(held, dice, {})).toBe(false)
  })

  it('offers the next reactor only with every earlier decline and the answerer recorded', () => {
    const next = (declinedReactorActorIds: string[]) => ({
      pause: { kind: 'CAST_REACTION' as const, payload: { declinedReactorActorIds } }
    })
    expect(castPendingContinues(held, decline, next(['second', 'first']))).toBe(true)
    expect(castPendingContinues(held, decline, next(['first']))).toBe(false)
    expect(castPendingContinues(held, decline, next(['first', 'third']))).toBe(false)
  })

  describe('a chosen reaction that runs as its own action (D219)', () => {
    const child = { commandId: 'child' }
    const raised = { ...held, reactionChildren: [child] }
    const resumed = { reactionChildren: [{ ...child, rollMode: 'DISADVANTAGE' }] }

    it('keeps the same offer held for the same reactor, recording the child unresolved', () => {
      expect(castPendingContinues(held, option, raised)).toBe(true)
      expect(castPendingContinues(held, decline, raised)).toBe(false)
      expect(castPendingContinues(held, null, raised)).toBe(false)
      expect(castPendingContinues(held, option, { ...raised, rollerActorId: 'third' })).toBe(false)
      expect(castPendingContinues(held, option, { ...held, ...resumed })).toBe(false)
      expect(
        castPendingContinues(held, option, { ...raised, usedReactions: [failedBy('second')] })
      ).toBe(false)
      expect(
        castPendingContinues(held, option, {
          ...raised,
          pause: {
            kind: 'CAST_REACTION' as const,
            payload: { declinedReactorActorIds: ['first', 'second'] }
          }
        })
      ).toBe(false)
    })

    it('moves on only by the room’s resume, as the reactor’s decline would, spending nothing', () => {
      expect(castPendingContinues(raised, null, resumed)).toBe(true)
      expect(
        castPendingContinues(raised, null, {
          ...resumed,
          pause: {
            kind: 'CAST_REACTION' as const,
            payload: { declinedReactorActorIds: ['first', 'second'] }
          }
        })
      ).toBe(true)
      expect(castPendingContinues(raised, decline, resumed)).toBe(false)
      expect(castPendingContinues(raised, option, resumed)).toBe(false)
      expect(castPendingContinues(raised, dice, resumed)).toBe(false)
      expect(
        castPendingContinues(raised, null, { ...resumed, usedReactions: [failedBy('second')] })
      ).toBe(false)
    })
  })

  it('holds the cast for the same reactor on its check when the counter owes one', () => {
    const toCheck = (overrides: Partial<typeof checking>) => ({ ...checking, ...overrides })
    expect(castPendingContinues(held, option, toCheck({ usedReactions: [] }))).toBe(true)
    expect(
      castPendingContinues(held, option, toCheck({ usedReactions: [], rollerActorId: 'third' }))
    ).toBe(false)
    expect(castPendingContinues(held, option, { rollerActorId: 'second' })).toBe(false)
    expect(
      castPendingContinues(held, option, {
        ...toCheck({ usedReactions: [] }),
        pause: {
          kind: 'CAST_REACTION' as const,
          payload: { declinedReactorActorIds: [], check: {} }
        }
      })
    ).toBe(false)
  })

  it('lets a choice whose check the app rolled leave the cast as a failed roll does', () => {
    const settled = (overrides: object) => ({
      pause: {
        kind: 'CAST_REACTION' as const,
        payload: { declinedReactorActorIds: ['first', 'second'] }
      },
      usedReactions: [failedBy('second')],
      ...overrides
    })
    expect(castPendingContinues(held, option, settled({}))).toBe(true)
    expect(castPendingContinues(held, option, settled({ usedReactions: [] }))).toBe(false)
    expect(
      castPendingContinues(
        held,
        option,
        settled({
          pause: { kind: 'CAST_REACTION' as const, payload: { declinedReactorActorIds: ['first'] } }
        })
      )
    ).toBe(false)
    expect(castPendingContinues(checking, option, settled({}))).toBe(false)
  })

  it('records a failed check as a failed counter and a decline of the reactor', () => {
    const failedBoth = [failedBy('first'), failedBy('second')]
    expect(castPendingContinues(checking, dice, { usedReactions: failedBoth })).toBe(true)
    expect(
      castPendingContinues(checking, dice, {
        pause: {
          kind: 'CAST_REACTION' as const,
          payload: { declinedReactorActorIds: ['first', 'second'] }
        },
        usedReactions: failedBoth
      })
    ).toBe(true)
    expect(castPendingContinues(checking, dice, { usedReactions: [failedBy('first')] })).toBe(false)
    expect(castPendingContinues(checking, decline, { usedReactions: failedBoth })).toBe(false)
    expect(castPendingContinues(checking, option, { usedReactions: failedBoth })).toBe(false)
  })

  it('carries earlier failed counters through every later pause of the cast', () => {
    const carrying = { usedReactions: [failedBy('first')] }
    expect(castPendingContinues(carrying, dice, { usedReactions: [failedBy('first')] })).toBe(true)
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
      pause: {
        kind: 'CAST_REACTION' as const,
        payload: { declinedReactorActorIds: ['other'], chain: standing('first') }
      }
    }
    const nestedChecking = {
      ...nested,
      pause: { kind: 'CAST_REACTION' as const, payload: { ...nested.pause.payload, check: {} } }
    }

    it('stands the answerer as the first counter, opening a fresh level that keeps the cast’s declines', () => {
      const pushed = (overrides: object = {}) => ({
        rollerActorId: 'third',
        pause: {
          kind: 'CAST_REACTION' as const,
          payload: {
            declinedReactorActorIds: [],
            chain: { counters: [failedBy('second')], castDeclinedReactorActorIds: ['first'] }
          }
        },
        ...overrides
      })
      expect(castPendingContinues(held, option, pushed())).toBe(true)
      expect(
        castPendingContinues(
          held,
          option,
          pushed({
            pause: {
              kind: 'CAST_REACTION' as const,
              payload: {
                declinedReactorActorIds: [],
                chain: { counters: [failedBy('second')], castDeclinedReactorActorIds: [] }
              }
            }
          })
        )
      ).toBe(false)
      expect(
        castPendingContinues(
          held,
          option,
          pushed({
            pause: {
              kind: 'CAST_REACTION' as const,
              payload: {
                declinedReactorActorIds: ['first'],
                chain: { counters: [failedBy('second')], castDeclinedReactorActorIds: ['first'] }
              }
            }
          })
        )
      ).toBe(false)
      expect(
        castPendingContinues(held, option, pushed({ usedReactions: [failedBy('second')] }))
      ).toBe(false)
      expect(castPendingContinues(held, decline, pushed())).toBe(false)
    })

    it('declines the answerer at the counter’s level only, keeping the counters standing', () => {
      const declinedAt = (declinedReactorActorIds: string[], chain = standing('first')) => ({
        pause: { kind: 'CAST_REACTION' as const, payload: { declinedReactorActorIds, chain } }
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
        pause: { kind: 'CAST_REACTION' as const, payload: { declinedReactorActorIds: ['early'] } },
        usedReactions: [failedBy('first'), failedBy('second')],
        ...overrides
      })
      expect(castPendingContinues(nested, option, resolved())).toBe(true)
      expect(
        castPendingContinues(nested, option, { usedReactions: resolved().usedReactions })
      ).toBe(true)
      expect(
        castPendingContinues(
          nested,
          option,
          resolved({
            pause: {
              kind: 'CAST_REACTION' as const,
              payload: { declinedReactorActorIds: ['other'] }
            }
          })
        )
      ).toBe(false)
      expect(
        castPendingContinues(nested, option, resolved({ usedReactions: [failedBy('first')] }))
      ).toBe(false)
    })

    it('fails the answerer on a failed roll without ending the counters standing', () => {
      const failedAt = (overrides: object = {}) => ({
        pause: {
          kind: 'CAST_REACTION' as const,
          payload: { declinedReactorActorIds: ['other', 'second'], chain: standing('first') }
        },
        usedReactions: [failedBy('second')],
        ...overrides
      })
      expect(castPendingContinues(nestedChecking, dice, failedAt())).toBe(true)
      expect(castPendingContinues(nestedChecking, dice, failedAt({ usedReactions: [] }))).toBe(
        false
      )
      // A failed roll leaves one counter standing, which counters the cast.
      expect(
        castPendingContinues(nestedChecking, dice, { usedReactions: [failedBy('second')] })
      ).toBe(false)
    })

    it('holds the cast for the same reactor on a check owed against the counter', () => {
      const toCheck = (overrides: object = {}) => ({
        rollerActorId: 'second',
        pause: { kind: 'CAST_REACTION' as const, payload: { ...nested.pause.payload, check: {} } },
        ...overrides
      })
      expect(castPendingContinues(nested, option, toCheck())).toBe(true)
      expect(
        castPendingContinues(
          nested,
          option,
          toCheck({
            pause: {
              kind: 'CAST_REACTION' as const,
              payload: {
                declinedReactorActorIds: ['other'],
                chain: standing('second'),
                check: {}
              }
            }
          })
        )
      ).toBe(false)
    })
  })
})

describe('castCounteredCarriesUsedReactions', () => {
  const failedBy = (reactorActorId: string) => ({ reaction: { reactorActorId } })
  const decline = { resolution: { kind: 'DECLINE' } }
  const option = { resolution: { kind: 'OPTION' } }
  const dice = { resolution: { kind: 'ENTER_DICE' } }
  const offer = (rollerActorId: string, overrides: object = {}) => ({
    rollerActorId,
    pause: { kind: 'CAST_REACTION' as const, payload: { declinedReactorActorIds: [] } },
    ...overrides
  })

  it('counters at the answerer’s own choice, holding the cast to the failed counters its pause carried', () => {
    const paused = offer('first', { usedReactions: [failedBy('earlier')] })
    expect(
      castCounteredCarriesUsedReactions(paused, option, 'first', {
        usedReactions: [failedBy('earlier')]
      })
    ).toBe(true)
    expect(castCounteredCarriesUsedReactions(paused, option, 'first', {})).toBe(false)
    expect(
      castCounteredCarriesUsedReactions(paused, option, 'first', {
        usedReactions: [failedBy('earlier'), failedBy('first')]
      })
    ).toBe(false)
    expect(
      castCounteredCarriesUsedReactions(paused, option, 'other', {
        usedReactions: [failedBy('earlier')]
      })
    ).toBe(false)
    // A decline never counters; nor does a failed roll when no counter stands.
    expect(
      castCounteredCarriesUsedReactions(paused, decline, 'first', {
        usedReactions: [failedBy('earlier')]
      })
    ).toBe(false)
    expect(castCounteredCarriesUsedReactions({}, option, 'first', {})).toBe(false)
  })

  describe('with counters standing', () => {
    const standing = (...reactorActorIds: string[]) => ({
      counters: reactorActorIds.map(failedBy),
      castDeclinedReactorActorIds: []
    })
    const nested = (chain: ReturnType<typeof standing>, overrides: object = {}) =>
      offer('last', {
        pause: { kind: 'CAST_REACTION' as const, payload: { declinedReactorActorIds: [], chain } },
        ...overrides
      })

    it('lets the first counter stand when nobody counters it, spending the later ones with the cast', () => {
      const lone = nested(standing('first'))
      expect(castCounteredCarriesUsedReactions(lone, decline, 'first', {})).toBe(true)
      expect(
        castCounteredCarriesUsedReactions(lone, decline, 'first', {
          usedReactions: [failedBy('first')]
        })
      ).toBe(false)
      expect(castCounteredCarriesUsedReactions(lone, decline, 'other', {})).toBe(false)
    })

    it('spends a failed roll at the counter’s level with the cast that is still countered', () => {
      const lone = nested(standing('first'), {
        pause: {
          kind: 'CAST_REACTION' as const,
          payload: { declinedReactorActorIds: [], chain: standing('first'), check: {} }
        }
      })
      expect(
        castCounteredCarriesUsedReactions(lone, dice, 'first', {
          usedReactions: [failedBy('last')]
        })
      ).toBe(true)
      expect(castCounteredCarriesUsedReactions(lone, dice, 'first', {})).toBe(false)
    })

    it('counters when the answerer stands a third counter, and spends the second', () => {
      const pair = nested(standing('first', 'second'))
      expect(
        castCounteredCarriesUsedReactions(pair, option, 'first', {
          usedReactions: [failedBy('second'), failedBy('last')]
        })
      ).toBe(true)
      // Only the first counter stands against the cast; a later one never counters it.
      expect(
        castCounteredCarriesUsedReactions(pair, option, 'second', {
          usedReactions: [failedBy('first'), failedBy('last')]
        })
      ).toBe(false)
    })
  })
})
