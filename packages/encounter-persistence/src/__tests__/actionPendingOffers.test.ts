import { describe, expect, it } from 'vitest'
import {
  castCancelledByReactionChild,
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

    it('carries no passed ward', () => {
      expect(
        castPendingContinues(gateHeld, dice, { ...offered, passedIncomingGate: ward('ward') })
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

  it('refuses a reaction answered at its own offer: a chosen reaction always runs as its own action (D219)', () => {
    const settled = (overrides: object) => ({
      pause: {
        kind: 'CAST_REACTION' as const,
        payload: { declinedReactorActorIds: ['first', 'second'] }
      },
      ...overrides
    })
    expect(castPendingContinues(held, option, settled({}))).toBe(false)
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
    const resumed = {
      reactionChildren: [
        { ...child, resumeOutcome: { kind: 'ROLL_MODE', rollMode: 'DISADVANTAGE' } }
      ]
    }

    it('keeps the same offer held for the same reactor, recording the child unresolved', () => {
      expect(castPendingContinues(held, option, raised)).toBe(true)
      expect(castPendingContinues(held, decline, raised)).toBe(false)
      expect(castPendingContinues(held, null, raised)).toBe(false)
      expect(castPendingContinues(held, option, { ...raised, rollerActorId: 'third' })).toBe(false)
      expect(castPendingContinues(held, option, { ...held, ...resumed })).toBe(false)
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
    })

    it('never offers another creature the chosen counter from the cast’s own pause: that offer is the child’s', () => {
      const offeredOn = (declinedReactorActorIds: string[]) => ({
        rollerActorId: 'third',
        pause: { kind: 'CAST_REACTION' as const, payload: { declinedReactorActorIds } }
      })
      expect(castPendingContinues(held, option, offeredOn([]))).toBe(false)
      expect(castPendingContinues(held, option, offeredOn(['first', 'second']))).toBe(false)
    })

    it('is lost to its child only while it awaits one', () => {
      expect(castCancelledByReactionChild(raised)).toBe(true)
      // A cast that awaits no child is never lost this way.
      expect(castCancelledByReactionChild(held)).toBe(false)
      expect(castCancelledByReactionChild({ ...held, ...resumed })).toBe(false)
      expect(castCancelledByReactionChild({})).toBe(false)
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
      // Never answered in place, and never held on without its child recorded.
      expect(castPendingContinues(rolledHeld, option, {})).toBe(false)
      expect(castPendingContinues(rolledHeld, option, rolledHeld)).toBe(false)
      expect(
        castPendingContinues(rolledHeld, option, { ...raised, pause: offer(['first'], null) })
      ).toBe(false)
      expect(castPendingContinues(rolledHeld, decline, raised)).toBe(false)
    })

    it('moves on from the child by the room’s resume, to the settlement or the next offer of the roll', () => {
      const resumed = { reactionChildren: [{ ...child, resumeOutcome: null }] }
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

  describe('an offer made to the creature an attack hit, which keeps the hit (QUALITY-8.T1d-a, D219)', () => {
    const hit = { originalExecutionChecksum: 'hit', damageTypeIds: ['fire'] }
    const offer = (declinedReactorActorIds: string[] = [], kept: object | null = hit) => ({
      kind: 'CAST_REACTION' as const,
      payload: { declinedReactorActorIds, ...(kept && { hit: kept }) }
    })
    const hitHeld = { rollerActorId: 'target', pause: offer() }
    const child = { commandId: 'child' }
    const raised = { ...hitHeld, reactionChildren: [child] }
    /** An offer the action held before the hit: before its roll, or on the rolled d20. */
    const earlier = (payload: object = {}) => ({
      rollerActorId: 'first',
      pause: {
        kind: 'CAST_REACTION' as const,
        payload: { declinedReactorActorIds: [], ...payload }
      }
    })

    it('follows the action’s own roll, or an earlier offer left by a decline, with no one heard from yet', () => {
      expect(castPendingContinues({}, null, hitHeld)).toBe(true)
      expect(castPendingContinues(earlier(), decline, hitHeld)).toBe(true)
      expect(castPendingContinues(earlier({ rolled: { test: {} } }), decline, hitHeld)).toBe(true)
      // The hit's offer is never the answer to a chosen reaction, and begins with no declines.
      expect(castPendingContinues(earlier(), option, hitHeld)).toBe(false)
      expect(
        castPendingContinues(earlier(), decline, { ...hitHeld, pause: offer(['first']) })
      ).toBe(false)
      expect(castPendingContinues(earlier(), decline, raised)).toBe(false)
    })

    it('follows the resume from an earlier offer’s child', () => {
      const awaited = { ...earlier(), reactionChildren: [child] }
      const resumed = { ...hitHeld, reactionChildren: [{ ...child, resumeOutcome: null }] }
      expect(castPendingContinues(awaited, null, resumed)).toBe(true)
      expect(castPendingContinues(awaited, decline, resumed)).toBe(false)
    })

    it('is left by a decline to the action’s outcome, never to another offer', () => {
      expect(castPendingContinues(hitHeld, decline, {})).toBe(true)
      expect(castPendingContinues(hitHeld, decline, { pause: offer(['target']) })).toBe(false)
      expect(castPendingContinues(hitHeld, decline, { pause: offer(['target'], null) })).toBe(false)
      expect(
        castPendingContinues(hitHeld, decline, {
          pause: offer(['target'], { ...hit, originalExecutionChecksum: 'other' })
        })
      ).toBe(false)
    })

    it('runs a chosen reaction only as its holder’s own action, on the same offer and hit', () => {
      expect(castPendingContinues(hitHeld, option, raised)).toBe(true)
      expect(castPendingContinues(hitHeld, option, {})).toBe(false)
      expect(castPendingContinues(hitHeld, option, { ...raised, pause: offer([], null) })).toBe(
        false
      )
      expect(
        castPendingContinues(hitHeld, option, {
          ...raised,
          pause: offer([], { ...hit, damageTypeIds: ['cold'] })
        })
      ).toBe(false)
      expect(castPendingContinues(hitHeld, decline, raised)).toBe(false)
    })

    it('moves on from the child by the room’s resume, which tests the kept hit again', () => {
      const resumed = { reactionChildren: [{ ...child, resumeOutcome: null }] }
      expect(castPendingContinues(raised, null, resumed)).toBe(true)
      expect(castPendingContinues(raised, option, resumed)).toBe(false)
    })
  })
})

describe('heldActionContinues', () => {
  const offer = (currentnessChecksum: string, resumeOutcome?: null) => ({
    currentnessChecksum,
    rollerActorId: 'next',
    pause: { kind: 'CAST_REACTION' as const, payload: { declinedReactorActorIds: ['holder'] } },
    reactionChildren: [
      { commandId: 'child', ...(resumeOutcome !== undefined && { resumeOutcome }) }
    ]
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
      next: offer(checksum, null),
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

  describe('an attack held on its hit for the creature it hit (QUALITY-8.T1d2b, D219)', () => {
    const child = { commandId: 'child' }
    const hit = { originalExecutionChecksum: 'hit', damageTypeIds: ['fire'] }
    const hitOffer = {
      kind: 'CAST_REACTION' as const,
      payload: { declinedReactorActorIds: [], hit }
    }
    const rolling = { currentnessChecksum: 'sealed' }
    const held = { ...rolling, rollerActorId: 'target', pause: hitOffer }
    const awaiting = { ...held, reactionChildren: [child] }
    /** The attack's outcome as it pauses once the child committed, on the facts named by `checksum`. */
    const outcome = (checksum: string) => ({
      currentnessChecksum: checksum,
      reactionChildren: [{ ...child, resumeOutcome: null }]
    })
    const step = (
      previous: Parameters<typeof heldActionContinues>[0]['next'],
      kind: string | null,
      next: Parameters<typeof heldActionContinues>[0]['next'],
      reactorActorId = 'target'
    ) =>
      heldActionContinues({
        resume: {
          occurrence: { id: 'occurrence' },
          pending: { context: previous },
          reactionChildren: (previous.reactionChildren ?? []).map(({ commandId }) => ({
            commandId,
            reactorActorId,
            descendantReactorActorIds: []
          }))
        },
        response: kind ? { resolution: { kind } } : null,
        occurrenceId: 'occurrence',
        next,
        endpointActorIds: ['attacker', 'target']
      })

    it('is stored from the attack’s roll, kept while its reaction runs, and left for the outcome', () => {
      expect(step(rolling, 'ENTER_DICE', held)).toBe(true)
      expect(step(held, 'OPTION', awaiting)).toBe(true)
      expect(step(awaiting, null, outcome('sealed'))).toBe(true)
      expect(step(held, 'DECLINE', rolling)).toBe(true)
    })

    it('resumes on the facts the hit creature’s own reaction changed, and on no other creature’s', () => {
      expect(step(awaiting, null, outcome('raised'))).toBe(true)
      expect(step(awaiting, null, outcome('raised'), 'bystander')).toBe(false)
    })

    it('refuses a hit stored on changed facts, a use that records no child and a resume that drops it', () => {
      expect(step(rolling, 'ENTER_DICE', { ...held, currentnessChecksum: 'changed' })).toBe(false)
      expect(step(held, 'OPTION', held)).toBe(false)
      expect(step(awaiting, null, rolling)).toBe(false)
    })
  })
})
