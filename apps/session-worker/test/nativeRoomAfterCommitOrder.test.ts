import { discoverEncounterFeatureActions } from '@artificer-toolkit/rules-runtime/encounterFeatureActionCapabilityDiscoveryRegistry'
import { systemTriggerCommandId } from '@artificer-toolkit/rules-runtime/encounterSystemTrigger'
import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { wardingBond } from '@artificer-toolkit/source-data/srd/spells/warding-bond.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf, deathBurstWolf } from './actionRoomFixture.js'
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

/** The root the room raises for `actor`'s death burst under the command that defeated it. */
function burstCommandId(parentCommandId: string, actor: EncounterRunActorState) {
  const [burst] = discoverEncounterFeatureActions({
    spells: new Map(),
    actor,
    conditionDefinitionIds: srdSystemRecord.conditionTypes.map((condition) => condition.id),
    abilityDefinitions: (srdSystemRecord.abilities ?? []).map(({ id, code }) => ({ id, code }))
  }).passiveHpZeroEffects
  if (!burst) throw new Error('The Wolf carries no death burst.')
  return systemTriggerCommandId(parentCommandId, actor.id, burst.capability.actionId)
}

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
    expect(
      after.commands.slice(before.commands.length).map(({ commandId }) => commandId)
    ).toEqual([parentCommandId, burstId])
    // The burst reaches the attacker, who stands within 30 feet of the source.
    expect(hitPointsOf(after, ATTACKER_ID)).toBe((hitPointsOf(before, ATTACKER_ID) ?? 0) - 1)
  }, 120000)
})
