import { describe, expect, it } from 'vitest'
import {
  castCounteredCarriesUsedReactions,
  castPendingContinues,
  heldActionContinues,
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

  it('lets a held cast leave its pause only by a decline', () => {
    expect(castPendingContinues(held, decline, {})).toBe(true)
    expect(castPendingContinues(held, option, {})).toBe(false)
    expect(castPendingContinues(held, null, {})).toBe(false)
    expect(castPendingContinues(held, dice, {})).toBe(false)
  })

  it('lets a reaction spent at its own offer leave the cast as a decline does, carried as used', () => {
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
    // A roll never answers the offer.
    expect(castPendingContinues(held, dice, settled({}))).toBe(false)
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

  describe('an offer made after the attack roll, which keeps the rolled d20 (QUALITY-9.T1e1, D219)', () => {
    const rolled = { test: { d20: { selectedNatural: 14, total: 19 } }, appRollId: null }
    const offer = (declinedReactorActorIds: string[], kept: object | null = rolled) => ({
      kind: 'CAST_REACTION' as const,
      payload: { declinedReactorActorIds, ...(kept && { rolled: kept }) }
    })
    const rolledHeld = { rollerActorId: 'second', pause: offer(['first']) }
    const child = { commandId: 'child' }
    const raised = { ...rolledHeld, reactionChildren: [child] }

    it('is left by a decline, to the roll’s settlement or to the next reactor’s offer of the same roll', () => {
      expect(castPendingContinues(rolledHeld, decline, {})).toBe(true)
      expect(castPendingContinues(rolledHeld, decline, { pause: offer(['first', 'second']) })).toBe(
        true
      )
      // The next offer never drops the roll, and never holds another.
      expect(
        castPendingContinues(rolledHeld, decline, { pause: offer(['first', 'second'], null) })
      ).toBe(false)
      expect(
        castPendingContinues(rolledHeld, decline, {
          pause: offer(['first', 'second'], {
            test: { d20: { selectedNatural: 15, total: 20 } },
            appRollId: null
          })
        })
      ).toBe(false)
      expect(castPendingContinues(rolledHeld, decline, { pause: offer(['first']) })).toBe(false)
    })

    it('runs a chosen reaction only as its holder’s own action, on the same offer and roll', () => {
      expect(castPendingContinues(rolledHeld, option, raised)).toBe(true)
      // Never spent with the action's own commit, and never held on without its child recorded.
      expect(castPendingContinues(rolledHeld, option, {})).toBe(false)
      expect(castPendingContinues(rolledHeld, option, { ...rolledHeld, usedReactions: [] })).toBe(
        false
      )
      expect(
        castPendingContinues(rolledHeld, option, { ...raised, pause: offer(['first'], null) })
      ).toBe(false)
      expect(castPendingContinues(rolledHeld, decline, raised)).toBe(false)
    })

    it('moves on from the child by the room’s resume, to the settlement or the next offer of the roll', () => {
      const resumed = { reactionChildren: [{ ...child, rollMode: null }] }
      expect(castPendingContinues(raised, null, resumed)).toBe(true)
      expect(
        castPendingContinues(raised, null, { ...resumed, pause: offer(['first', 'second']) })
      ).toBe(true)
      expect(
        castPendingContinues(raised, null, {
          ...resumed,
          pause: offer(['first', 'second'], null)
        })
      ).toBe(false)
      expect(castPendingContinues(raised, option, resumed)).toBe(false)
    })
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
  })
})

describe('heldActionContinues', () => {
  const offer = (currentnessChecksum: string, rollMode?: 'NORMAL') => ({
    currentnessChecksum,
    rollerActorId: 'next',
    pause: { kind: 'CAST_REACTION' as const, payload: { declinedReactorActorIds: ['holder'] } },
    reactionChildren: [{ commandId: 'child', ...(rollMode && { rollMode }) }]
  })
  /** A cast held on the child `reactor` committed, resumed to its next offer on `checksum`. */
  const resumed = (reactor: string, checksum: string, descendants: string[] = []) =>
    heldActionContinues({
      resume: {
        occurrence: { id: 'occurrence' },
        pending: {
          context: {
            ...offer('sealed'),
            rollerActorId: 'holder',
            pause: { kind: 'CAST_REACTION', payload: { declinedReactorActorIds: [] } }
          }
        },
        reactionChildren: [
          { commandId: 'child', reactorActorId: reactor, descendantReactorActorIds: descendants }
        ]
      },
      response: null,
      occurrenceId: 'occurrence',
      next: offer(checksum, 'NORMAL'),
      endpointActorIds: ['caster', 'chosen']
    })

  it('resumes on the facts the cast was sealed on', () => {
    expect(resumed('bystander', 'sealed')).toBe(true)
  })

  it('refuses changed facts when the awaited child’s tree holds none of the cast’s creatures', () => {
    expect(resumed('bystander', 'changed')).toBe(false)
    expect(resumed('bystander', 'changed', ['other'])).toBe(false)
  })

  it('takes changed facts when a creature the cast names reacted in the awaited child’s tree', () => {
    expect(resumed('chosen', 'changed')).toBe(true)
    expect(resumed('bystander', 'changed', ['caster'])).toBe(true)
  })

  it('records no child on an action that resumes nothing', () => {
    const fresh = { resume: null, response: null, occurrenceId: 'occurrence' }
    const { reactionChildren, ...unrecorded } = offer('sealed')
    expect(heldActionContinues({ ...fresh, next: unrecorded, endpointActorIds: ['caster'] })).toBe(
      true
    )
    expect(
      heldActionContinues({
        ...fresh,
        next: { ...unrecorded, reactionChildren },
        endpointActorIds: ['caster']
      })
    ).toBe(false)
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
    // A decline never counters when no counter stands.
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

    it('never counters the cast by a counter chosen against the one standing, or by a roll', () => {
      const lone = nested(standing('first'))
      const failed = { usedReactions: [failedBy('last')] }
      expect(castCounteredCarriesUsedReactions(lone, option, 'first', failed)).toBe(false)
      expect(castCounteredCarriesUsedReactions(lone, dice, 'first', failed)).toBe(false)
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
