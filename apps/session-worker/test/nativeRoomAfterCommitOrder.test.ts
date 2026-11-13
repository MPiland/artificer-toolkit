import { discoverEncounterFeatureActions } from '@artificer-toolkit/rules-runtime/encounterFeatureActionCapabilityDiscoveryRegistry'
import { systemTriggerCommandId } from '@artificer-toolkit/rules-runtime/encounterSystemTrigger'
import { SRD, srdByLabel } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { spiritGuardians } from '@artificer-toolkit/source-data/srd/spells/spirit-guardians.js'
import { wardingBond } from '@artificer-toolkit/source-data/srd/spells/warding-bond.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf, deathBurstWolf, fireballWolf } from './actionRoomFixture.js'
import { areaReceipts, vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readPendingActionDecision, readRoomHistory, type RoomHistory } from './roomHistoryReads.js'

/**
 * QUALITY-11.T1a: the order of what one command does after it commits. An attacker bites a Wolf that
 * holds a Warding Bond; the bond's source is a Wolf that carries a death burst and has just the hit
 * points the mirrored damage takes. The mirror settles before the hit-point effects are raised, so
 * the command that never touched the source raises its burst, as the next command after the attack.
 */

const ATTACKER_ID = testUuid(0x11a0)
const HOLDER_ID = testUuid(0x11a1)
const SOURCE_ID = testUuid(0x11a2)
const BOND_ID = testUuid(0x11a3)
const BITE_DAMAGE = 8
/** The bond's resistance to all damage halves the Bite, and the holder's loss is the source's. */
const MIRRORED_DAMAGE = BITE_DAMAGE / 2

const attacker = biteWolf('ATTACK', { reachFeet: 150, damage: BITE_DAMAGE })
const source = srdCreatureActor({
  id: SOURCE_ID,
  creature: deathBurstWolf(30),
  currentHitPoints: MIRRORED_DAMAGE
})
const [bondEffect] = wardingBond.effects ?? []

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const hitPointsOf = (history: RoomHistory, id: string) =>
  vitalsOf(history).find((vitals) => vitals.id === id)?.currentHitPoints

/** The action the event table raises for `actor` when it is defeated: its death burst. */
function burstActionId(actor: EncounterRunActorState) {
  const [burst] = discoverEncounterFeatureActions({
    spells: new Map(),
    actor,
    conditionDefinitionIds: srdSystemRecord.conditionTypes.map((condition) => condition.id),
    abilityDefinitions: (srdSystemRecord.abilities ?? []).map(({ id, code }) => ({ id, code }))
  }).raisedActions.filter(({ hook }) => hook.subscription.event === 'DEFEATED')
  if (!burst) throw new Error('The Wolf carries no death burst.')
  return burst.capability.actionId
}

/** The root the room raises for `actor`'s death burst under the command that defeated it. */
const burstCommandId = (parentCommandId: string, actor: EncounterRunActorState) =>
  systemTriggerCommandId(parentCommandId, actor.id, burstActionId(actor))

describe('what one room command raises after it commits (QUALITY-11.T1a)', () => {
  it('settles a mirror kill, then raises the killed source’s burst under the same command', async () => {
    if (!bondEffect) throw new Error('The SRD Warding Bond has no effect.')
    const room = await actionRoom({
      autoRoll: 'GAME_MASTER',
      rolls: [19],
      fallbackRoll: 0,
      actors: [
        srdCreatureActor({ id: ATTACKER_ID, creature: attacker }),
        srdCreatureActor({ id: HOLDER_ID, creature: plainWolf }),
        source
      ],
      ownerFeatureId: attacker.features?.find((feature) => feature.label === 'Bite')?.id,
      seed: async ({ effects, encounterId, occurredAt }) => {
        const planned = plannedModifierGrant({
          encounterId,
          sourceActorId: SOURCE_ID,
          holderActorId: HOLDER_ID,
          lifecycle: {},
          effect: bondEffect,
          sourceLabel: wardingBond.label,
          rounds: 600
        })
        await effects.create({
          id: BOND_ID,
          owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: HOLDER_ID },
          definition: planned.definition,
          lifecycle: planned.lifecycle,
          occurredAt
        })
      }
    })
    const stub = room.room.base.stub
    const before = await readRoomHistory(stub)
    expect(hitPointsOf(before, SOURCE_ID)).toBe(MIRRORED_DAMAGE)

    const { command, answer } = await room.startAction(HOLDER_ID, [], room.sceneContext())
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(stub)).toBeNull()

    const after = await readRoomHistory(stub)
    // The attack names only the holder; the mirrored damage alone defeats the bond's source.
    expect(hitPointsOf(after, HOLDER_ID)).toBe(
      (hitPointsOf(before, HOLDER_ID) ?? 0) - MIRRORED_DAMAGE
    )
    expect(hitPointsOf(after, SOURCE_ID)).toBe(0)

    // The burst is the one root raised, and the next command the Run records after the attack.
    const parentCommandId = command.commandId.toLowerCase()
    const burstId = burstCommandId(parentCommandId, source)
    expect(areaReceipts(after).roots.map(({ receipt }) => receipt.commandId)).toEqual([burstId])
    expect(after.commands.slice(before.commands.length).map(({ commandId }) => commandId)).toEqual([
      parentCommandId,
      burstId
    ])
    // The burst reaches the attacker, who stands within 30 feet of the source.
    expect(hitPointsOf(after, ATTACKER_ID)).toBe((hitPointsOf(before, ATTACKER_ID) ?? 0) - 1)
  }, 120000)

  it('refuses a submitted action that names a standing creature’s burst (QUALITY-11.T1b)', async () => {
    const room = await actionRoom({
      autoRoll: 'GAME_MASTER',
      fallbackRoll: 0,
      actors: [srdCreatureActor({ id: ATTACKER_ID, creature: attacker }), source],
      ownerFeatureId: attacker.features?.find((feature) => feature.label === 'Bite')?.id
    })
    const stub = room.room.base.stub
    const before = await readRoomHistory(stub)
    const answer = await room.send({
      type: 'RESOLVE_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version(),
      actorId: SOURCE_ID,
      actionId: burstActionId(source),
      target: { kind: 'ACTOR', actorId: ATTACKER_ID },
      acceptedWieldConflict: null,
      acknowledgedWarnings: [],
      sceneContext: null
    })
    expect(answer).toMatchObject({
      type: 'COMMAND_REJECTED',
      reason: 'SOURCE_REQUIREMENTS_NOT_MET'
    })
    const after = await readRoomHistory(stub)
    expect(after.commands).toHaveLength(before.commands.length)
    expect(hitPointsOf(after, ATTACKER_ID)).toBe(hitPointsOf(before, ATTACKER_ID))
  }, 120000)
})

/**
 * QUALITY-11.T2: each child one command raises moves the Run, so the second is admitted against its
 * parent's version plus the committed sibling before it, not the parent's version alone.
 */
describe('several system-trigger children of one command (QUALITY-11.T2)', () => {
  const FIREBALL_ID = testUuid(0x11b0)
  const FIRST_ID = testUuid(0x11b1)
  const SECOND_ID = testUuid(0x11b2)
  const ONI_ID = testUuid(0x11b3)
  const CASTER_ID = testUuid(0x11b4)
  const REGENERATION = 10
  const WOUNDED = 40
  const fireball = fireballWolf()

  it('commits both death bursts of two creatures one command defeats, in actor order', async () => {
    const first = srdCreatureActor({
      id: FIRST_ID,
      creature: deathBurstWolf(1),
      currentHitPoints: 1
    })
    const second = srdCreatureActor({
      id: SECOND_ID,
      creature: deathBurstWolf(1),
      currentHitPoints: 1
    })
    const room = await actionRoom({
      autoRoll: 'GAME_MASTER',
      fallbackRoll: 1,
      actors: [srdCreatureActor({ id: FIREBALL_ID, creature: fireball }), first, second],
      // The two stand 10 feet apart, far from the caster, so no burst reaches anyone.
      positions: { [FIRST_ID]: { x: 1000, y: 150 }, [SECOND_ID]: { x: 1200, y: 150 } },
      ownerFeatureId: fireball.features?.find((feature) => feature.label === 'Bite')?.id
    })
    const stub = room.room.base.stub
    const before = await readRoomHistory(stub)

    const { command, answer } = await room.startAreaAction({ x: 1100, y: 150 })
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(stub)).toBeNull()

    const after = await readRoomHistory(stub)
    expect(hitPointsOf(after, FIRST_ID)).toBe(0)
    expect(hitPointsOf(after, SECOND_ID)).toBe(0)
    const parentCommandId = command.commandId.toLowerCase()
    expect(after.commands.slice(before.commands.length).map(({ commandId }) => commandId)).toEqual([
      parentCommandId,
      burstCommandId(parentCommandId, first),
      burstCommandId(parentCommandId, second)
    ])
  }, 120000)

  it('commits both start-of-turn passives of one creature, each healing', async () => {
    const oni = srdByLabel(SRD.creatures, 'Oni')
    const regeneration = oni.features?.find((feature) => feature.label === 'Regeneration')
    if (!regeneration) throw new Error('The Oni has no Regeneration.')
    // A second Regeneration the Oni also carries, under ids of its own.
    const twin = {
      ...regeneration,
      id: testUuid(0x11b5),
      effects: regeneration.effects?.map((effect, index) => ({
        ...effect,
        id: testUuid(0x11b6 + index)
      }))
    }
    const room = await actionRoom({
      actors: [
        {
          ...characterActor({ id: testUuid(0x11b7), characterId: CASTER_ID }),
          snapshot: { kind: 'CHARACTER' as const, id: CASTER_ID, systemId: srdSystemRecord.id }
        },
        srdCreatureActor({
          id: ONI_ID,
          creature: { ...oni, features: [...(oni.features ?? []), twin] },
          currentHitPoints: WOUNDED
        })
      ],
      characterSpellcasting: { spells: [spiritGuardians], prepared: [spiritGuardians.id] },
      characterAction: (action) => action.label === 'Spirit Guardians (3rd level)',
      autoRoll: 'EVERYONE',
      fallbackRoll: 1
    })
    const stub = room.room.base.stub
    const before = await readRoomHistory(stub)

    const answer = await room.send({
      type: 'ADVANCE_TURN',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const after = await readRoomHistory(stub)
    // The advance and one raised root for each of the two passives.
    expect(after.commands.length - before.commands.length).toBe(3)
    expect(hitPointsOf(after, ONI_ID)).toBe(WOUNDED + 2 * REGENERATION)
  }, 120000)
})
