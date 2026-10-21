import { readStoredActorSnapshot } from '@artificer-toolkit/encounter-persistence/actorSnapshots'
import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import { discoverEncounterFeatureActions } from '@artificer-toolkit/rules-runtime/encounterFeatureActionCapabilityDiscoveryRegistry'
import { snapshotCreatureEquipmentLoadout } from '@artificer-toolkit/rules-runtime/encounterCreatureEquipmentSources'
import {
  creatureFeature,
  srdCondition,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { escapeGrappleEffectDefinition } from '@artificer-toolkit/rules-runtime/testing/escapeGrappleEffectFixture'
import { runInDurableObject } from 'cloudflare:test'
import { afterEach, describe, expect, it } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'
import { seededSrdCreature } from './seededSrdCreature.js'

const OGRE_ID = testUuid(0xe30)
const TARGET_ID = testUuid(0xe31)
const HELD_ID = testUuid(0xe32)
const EFFECT_ID = testUuid(0xe33)
const GRAPPLED = srdCondition('Grappled')

afterEach(() => {
  closeTrackedSockets()
})

/**
 * An Ogre carrying its two-handed Greatclub (not drawn) beside a Wolf to attack and, with `holding`,
 * a second Wolf the Ogre holds by hand, which fills one of its two hands (D152).
 */
async function drawRoom({ holding = false, naturalAttack = false } = {}) {
  const ogre = seededSrdCreature('Ogre')
  const carrying = {
    ...ogre,
    equipmentLoadout: ogre.equipmentLoadout?.map((entry) =>
      entry.useState === 'MAIN_HAND' ? { ...entry, useState: 'CARRIED' as const } : entry
    )
  }
  const carriedWolf = { ...plainWolf, equipmentLoadout: carrying.equipmentLoadout }
  const room = await actionRoom({
    actors: [
      srdCreatureActor({ id: OGRE_ID, creature: naturalAttack ? carriedWolf : carrying }),
      srdCreatureActor({ id: TARGET_ID, creature: plainWolf }),
      srdCreatureActor({
        id: HELD_ID,
        creature: plainWolf,
        conditionIds: holding ? [GRAPPLED] : []
      })
    ],
    positions: { [HELD_ID]: { x: 200, y: 150 } },
    ownerFeatureId: naturalAttack
      ? creatureFeature(carriedWolf, 'Bite').id
      : creatureFeature(ogre, 'Greatclub').id,
    seed: async ({ effects, encounterId, occurredAt }) => {
      if (!holding) return
      await effects.create({
        id: EFFECT_ID,
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: HELD_ID },
        lifecycle: { schemaVersion: 1, remainingTicks: null },
        definition: escapeGrappleEffectDefinition({
          encounterId,
          grapplerId: OGRE_ID,
          conditionIds: [GRAPPLED],
          occupiesHand: true
        }),
        occurredAt
      })
    }
  })
  const stub = room.room.base.stub
  const clubEntryId = snapshotCreatureEquipmentLoadout(
    srdCreatureActor({ id: OGRE_ID, creature: ogre })
  ).find((entry) => entry.useState === 'MAIN_HAND')?.id
  if (!clubEntryId) throw new Error('The Ogre holds no main-hand item.')

  /** The Ogre's loadout as the room stores it, read through the snapshot its record names. */
  async function storedLoadout() {
    const { actors } = await readRoomHistory(stub)
    const row = actors.find(({ id }) => id === OGRE_ID)
    if (!row) throw new Error('The stored Run holds no Ogre.')
    const actor = readStoredRunActor(row)
    if (actor.kind !== 'CREATURE') throw new Error('Expected a Creature actor.')
    const snapshotRow = await runInDurableObject(stub, async (_instance, context) =>
      new RoomEncounterStore(context.storage)
        .documents('encounterActorSnapshots')
        .find(({ checksum }) => checksum === actor.snapshotChecksum)
    )
    if (!snapshotRow) throw new Error('The Ogre snapshot is not stored.')
    return snapshotCreatureEquipmentLoadout({
      ...actor,
      snapshot: readStoredActorSnapshot(snapshotRow)
    })
  }
  const clubState = async () =>
    (await storedLoadout()).find((entry) => entry.id === clubEntryId)?.useState
  const revert = async () =>
    room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
  /** The attack's d20 entered for the pending request: the attack resolves and commits. */
  const attackTarget = async () => {
    const { answer } = await room.startAction(TARGET_ID, ['TARGET_RANGE_UNCHECKED'])
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the attack roll.')
    return room.resolve(decision, {
      kind: 'ENTER_DICE',
      requestId: decision.pending.request.requestId,
      // A natural 1 misses, so the attack commits with no damage roll to answer.
      rawFaces: [1],
      rollMode: decision.pending.request.rollMode
    })
  }
  return { room, clubState, revert, attackTarget }
}

describe('an attack draws its carried weapon into a free hand (D107, ATTACK-19.2), in the room', () => {
  it('draws a Creature loadout weapon for free and undo puts it back in the carried state', async () => {
    const { clubState, revert, attackTarget } = await drawRoom()
    expect(await clubState()).toBe('CARRIED')
    const answer = await attackTarget()
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await clubState()).toBe('MAIN_HAND')

    const undone = await revert()
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await clubState()).toBe('CARRIED')
  })

  it('draws nothing for a natural attack, leaving a carried item carried', async () => {
    const { clubState, attackTarget } = await drawRoom({ naturalAttack: true })
    const answer = await attackTarget()
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await clubState()).toBe('CARRIED')
  })

  it('holds, releases, attacks and draws: a held creature fills a hand the weapon needs', async () => {
    const { room, clubState, attackTarget } = await drawRoom({ holding: true })
    const choices = await room.actionChoices(OGRE_ID)
    const attack = choices.actions.find(({ label }) => label.includes('Greatclub'))
    expect(attack?.handRelease).toEqual({
      holds: [{ activeEffectId: EFFECT_ID, heldActorId: HELD_ID }]
    })

    const blocked = await room.startAction(TARGET_ID, ['TARGET_RANGE_UNCHECKED'])
    expect(blocked.answer).toMatchObject({
      type: 'COMMAND_REJECTED',
      message: 'Release a held creature first: your hands are full.'
    })
    expect(await clubState()).toBe('CARRIED')

    const released = await room.send({
      type: 'RELEASE_RELATIONSHIP',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version(),
      actorId: OGRE_ID,
      heldActorId: HELD_ID,
      activeEffectId: EFFECT_ID
    })
    expect(released.type, JSON.stringify(released)).toBe('COMMAND_COMMITTED')

    const answer = await attackTarget()
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await clubState()).toBe('MAIN_HAND')
  })
})

describe('a thrown weapon leaves its hand (D107, ATTACK-19.3), in the room', () => {
  it('throws the held Javelin into the carried state and undo puts it back in the hand', async () => {
    const bugbear = seededSrdCreature('Bugbear')
    const javelinFeatureId = creatureFeature(bugbear, 'Javelin').id
    const holding = {
      ...bugbear,
      equipmentLoadout: bugbear.equipmentLoadout?.map((entry) => ({
        ...entry,
        useState: entry.actionFeatureIds.includes(javelinFeatureId)
          ? ('MAIN_HAND' as const)
          : entry.useState === 'MAIN_HAND'
            ? ('CARRIED' as const)
            : entry.useState
      }))
    }
    const bugbearActor = srdCreatureActor({ id: OGRE_ID, creature: holding })
    const [, thrownJavelin] = discoverEncounterFeatureActions({
      spells: new Map(),
      actor: bugbearActor,
      conditionDefinitionIds: [],
      abilityDefinitions: []
    }).available.filter((entry) => entry.ownerFeatureId === javelinFeatureId)
    if (!thrownJavelin) throw new Error('The Bugbear offers no thrown Javelin action.')
    const room = await actionRoom({
      actors: [bugbearActor, srdCreatureActor({ id: TARGET_ID, creature: plainWolf })],
      ownerFeatureId: javelinFeatureId
    })
    const stub = room.room.base.stub
    const javelinEntryId = snapshotCreatureEquipmentLoadout(bugbearActor).find((entry) =>
      entry.actionFeatureIds.includes(javelinFeatureId)
    )?.id
    const javelinState = async () => {
      const { actors } = await readRoomHistory(stub)
      const row = actors.find(({ id }) => id === OGRE_ID)
      if (!row) throw new Error('The stored Run holds no Bugbear.')
      const actor = readStoredRunActor(row)
      if (actor.kind !== 'CREATURE') throw new Error('Expected a Creature actor.')
      const snapshotRow = await runInDurableObject(stub, async (_instance, context) =>
        new RoomEncounterStore(context.storage)
          .documents('encounterActorSnapshots')
          .find(({ checksum }) => checksum === actor.snapshotChecksum)
      )
      if (!snapshotRow) throw new Error('The Bugbear snapshot is not stored.')
      return snapshotCreatureEquipmentLoadout({
        ...actor,
        snapshot: readStoredActorSnapshot(snapshotRow)
      }).find((entry) => entry.id === javelinEntryId)?.useState
    }
    expect(await javelinState()).toBe('MAIN_HAND')

    const { answer } = await room.startAction(
      TARGET_ID,
      ['TARGET_RANGE_UNCHECKED'],
      null,
      null,
      thrownJavelin.actionId
    )
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the attack roll.')
    const resolved = await room.resolve(decision, {
      kind: 'ENTER_DICE',
      requestId: decision.pending.request.requestId,
      rawFaces: [1],
      rollMode: decision.pending.request.rollMode
    })
    expect(resolved.type, JSON.stringify(resolved)).toBe('COMMAND_COMMITTED')
    expect(await javelinState()).toBe('CARRIED')

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await javelinState()).toBe('MAIN_HAND')
  })
})

describe('a weapon swap spends no action economy (D107, ATTACK-19.3), in the room', () => {
  it('draws the carried Shortsword beside the held Longsword and still makes the whole Multiattack', async () => {
    const veteran = seededSrdCreature('Veteran')
    const longsword = creatureFeature(veteran, 'Longsword')
    const shortsword = creatureFeature(veteran, 'Shortsword')
    const swapping = {
      ...veteran,
      equipmentLoadout: veteran.equipmentLoadout?.map((entry) => ({
        ...entry,
        useState: entry.actionFeatureIds.includes(longsword.id)
          ? ('MAIN_HAND' as const)
          : entry.actionFeatureIds.includes(shortsword.id)
            ? ('CARRIED' as const)
            : entry.useState
      }))
    }
    const room = await actionRoom({
      autoRoll: 'BOTH',
      rolls: Array.from({ length: 12 }, (_, index) => (index % 2 === 0 ? 14 : 1)),
      actors: [
        srdCreatureActor({ id: OGRE_ID, creature: swapping }),
        srdCreatureActor({ id: TARGET_ID, creature: plainWolf })
      ],
      ownerFeatureId: longsword.id,
      grip: 'ONE_HANDED'
    })
    const choices = async () => room.actionChoices()
    const swap = (await choices()).actions.find(({ label }) => label.includes('Shortsword'))
    if (!swap) throw new Error('The Veteran offers no Shortsword attack.')
    const range: ['TARGET_RANGE_UNCHECKED'] = ['TARGET_RANGE_UNCHECKED']

    const first = await room.startAction(TARGET_ID, range)
    expect(first.answer.type, JSON.stringify(first.answer)).toBe('COMMAND_COMMITTED')
    // The swap: the Shortsword is drawn beside the Longsword and fills the Multiattack's optional slot.
    const drawn = await room.startAction(TARGET_ID, range, null, null, swap.id)
    expect(drawn.answer.type, JSON.stringify(drawn.answer)).toBe('COMMAND_COMMITTED')
    expect((await choices()).openAttackAction).toMatchObject({ made: 2, complete: false })
    // The swap took no slot and no action: the second Longsword attack is still the Multiattack's.
    const last = await room.startAction(TARGET_ID, range)
    expect(last.answer.type, JSON.stringify(last.answer)).toBe('COMMAND_COMMITTED')
    expect((await choices()).openAttackAction).toMatchObject({ made: 3, total: 3, complete: true })
  })
})
