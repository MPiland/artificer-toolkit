import { runInDurableObject } from 'cloudflare:test'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import { deathWard } from '@artificer-toolkit/source-data/srd/spells/death-ward.js'
import { afterEach, describe, expect, it } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-4.T2i2b through the room: a Death Ward on a Character (`DAMAGE_INTERCEPTION`) holds a
 * lethal attack at 1 hit point and ends in the attack's own commit, and the GM's undo gives back
 * both the hit points and the ward.
 */

const ATTACKER_ID = testUuid(0x930)
const CHARACTER_ACTOR_ID = testUuid(0x931)
const CHARACTER_ID = testUuid(0x932)
const WARD_ID = testUuid(0x5730)
/** The attack d20 face (zero-based) the Bite adds 4 to: a hit on any armor class. */
const HITS = 17

const attacker = biteWolf('ATTACK', { damage: 20 })
const [deathWardEffect] = deathWard.effects ?? []

afterEach(() => {
  closeTrackedSockets()
})

async function wardedRoom(uses = 1) {
  if (!deathWardEffect) throw new Error('The SRD Death Ward has no effect.')
  return actionRoom({
    actors: [
      srdCreatureActor({ id: ATTACKER_ID, creature: attacker, disposition: 'HOSTILE' }),
      characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID })
    ],
    ownerFeatureId: creatureFeature(attacker, 'Bite').id,
    autoRoll: 'BOTH',
    rolls: [HITS],
    fallbackRoll: 0,
    characterPlay: { currentHitPoints: 5 },
    seed: async ({ effects, encounterId, occurredAt }) => {
      const planned = plannedModifierGrant({
        encounterId,
        sourceActorId: CHARACTER_ACTOR_ID,
        holderActorId: CHARACTER_ACTOR_ID,
        lifecycle: {},
        effect: deathWardEffect,
        sourceLabel: deathWard.label
      })
      await effects.create({
        id: WARD_ID,
        // The room fixture moves a Character actor's effects onto the Character, as a live Run holds them.
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: CHARACTER_ACTOR_ID },
        definition: planned.definition,
        lifecycle: { ...planned.lifecycle, remainingUses: uses },
        occurredAt
      })
    }
  })
}

type Room = Awaited<ReturnType<typeof wardedRoom>>

async function characterState(room: Room) {
  const hitPoints = await runInDurableObject(room.room.base.stub, (_instance, context) => {
    const row = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((candidate) => candidate.characterId === CHARACTER_ID)
    if (!row) throw new Error('Missing room Character play state.')
    return readCharacterPlay(row).hitpoints.current
  })
  const history = await readRoomHistory(room.room.base.stub)
  return {
    hitPoints,
    ward: history.characterEffects.find(({ id }) => id === WARD_ID)?.lifecycle.remainingUses
  }
}

async function undo(room: Room) {
  const undone = await room.send({
    type: 'REVERT_LAST_ACTION',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version()
  })
  expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
}

describe('Death Ward holds a lethal attack (SPELLS-4.T2i2b)', () => {
  it('leaves the Character at 1 hit point, ends the ward in the attack’s commit, and the undo restores both', async () => {
    const room = await wardedRoom()
    expect(await characterState(room)).toEqual({ hitPoints: 5, ward: 1 })

    const { answer } = await room.startAction(CHARACTER_ACTOR_ID, ['TARGET_RANGE_UNCHECKED'])
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await characterState(room)).toEqual({ hitPoints: 1, ward: undefined })

    await undo(room)
    expect(await characterState(room)).toEqual({ hitPoints: 5, ward: 1 })
  })

  it('spends one use of a ward with more and keeps it, and the undo gives the use back', async () => {
    const room = await wardedRoom(2)

    const { answer } = await room.startAction(CHARACTER_ACTOR_ID, ['TARGET_RANGE_UNCHECKED'])
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await characterState(room)).toEqual({ hitPoints: 1, ward: 1 })

    await undo(room)
    expect(await characterState(room)).toEqual({ hitPoints: 5, ward: 2 })
  })
})
