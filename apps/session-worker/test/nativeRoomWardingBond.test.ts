import { runInDurableObject } from 'cloudflare:test'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import { wardingBond } from '@artificer-toolkit/source-data/srd/spells/warding-bond.js'
import { afterEach, describe, expect, it } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readActorHitPoints, readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-4.T2n4 through the room: a Warding Bond (`DAMAGE_MIRROR`) between a wolf (the bond's source)
 * and a Character (its holder). The wolf's own Bite on the Character spends the wolf's action
 * economy, and the half of the damage the Character's resistance lets through is mirrored to the
 * wolf in the same commit, without a stale-source refusal. Mirrored damage is never mirrored again.
 */

const WOLF_ID = testUuid(0x940)
const CHARACTER_ACTOR_ID = testUuid(0x941)
const CHARACTER_ID = testUuid(0x942)
const BOND_ID = testUuid(0x5740)
/** The attack d20 face (zero-based) the Bite adds 4 to: a hit on any armor class. */
const HITS = 17
const BITE_DAMAGE = 8
/** Resistance to all damage halves the Bite. */
const MIRRORED_DAMAGE = BITE_DAMAGE / 2
const CHARACTER_HIT_POINTS = 50

const wolf = biteWolf('ATTACK', { damage: BITE_DAMAGE })
const [bondEffect] = wardingBond.effects ?? []

afterEach(() => {
  closeTrackedSockets()
})

async function bondedRoom(positions?: Record<string, { x: number; y: number }>) {
  if (!bondEffect) throw new Error('The SRD Warding Bond has no effect.')
  return actionRoom({
    actors: [
      srdCreatureActor({ id: WOLF_ID, creature: wolf, disposition: 'HOSTILE' }),
      characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID })
    ],
    ownerFeatureId: creatureFeature(wolf, 'Bite').id,
    autoRoll: 'BOTH',
    rolls: [HITS],
    fallbackRoll: 0,
    characterPlay: { currentHitPoints: CHARACTER_HIT_POINTS },
    positions,
    seed: async ({ effects, encounterId, occurredAt }) => {
      const planned = plannedModifierGrant({
        encounterId,
        sourceActorId: WOLF_ID,
        holderActorId: CHARACTER_ACTOR_ID,
        lifecycle: {},
        effect: bondEffect,
        sourceLabel: wardingBond.label,
        rounds: 600
      })
      await effects.create({
        id: BOND_ID,
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: CHARACTER_ACTOR_ID },
        definition: planned.definition,
        lifecycle: planned.lifecycle,
        occurredAt
      })
    }
  })
}

type Room = Awaited<ReturnType<typeof bondedRoom>>

async function state(room: Room) {
  const characterHitPoints = await runInDurableObject(room.room.base.stub, (_instance, context) => {
    const row = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((candidate) => candidate.characterId === CHARACTER_ID)
    if (!row) throw new Error('Missing room Character play state.')
    return readCharacterPlay(row).hitpoints.current
  })
  const history = await readRoomHistory(room.room.base.stub)
  return {
    characterHitPoints,
    wolfHitPoints: readActorHitPoints(history, WOLF_ID),
    bonded: history.characterEffects.some(({ id }) => id === BOND_ID)
  }
}

describe('Warding Bond mirrors the holder’s damage to its source (SPELLS-4.T2n4)', () => {
  it('passes the damage the holder took after resistance to the attacking source, once', async () => {
    const room = await bondedRoom()
    const before = await state(room)
    expect(before).toMatchObject({ characterHitPoints: CHARACTER_HIT_POINTS, bonded: true })

    const { answer } = await room.startAction(CHARACTER_ACTOR_ID, ['TARGET_RANGE_UNCHECKED'])
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    expect(await state(room)).toEqual({
      characterHitPoints: CHARACTER_HIT_POINTS - MIRRORED_DAMAGE,
      wolfHitPoints: before.wolfHitPoints - MIRRORED_DAMAGE,
      bonded: true
    })
  })

  it('refuses the GM’s undo of an action whose damage was mirrored, leaving both unchanged', async () => {
    const room = await bondedRoom()
    const { answer } = await room.startAction(CHARACTER_ACTOR_ID, ['TARGET_RANGE_UNCHECKED'])
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const settled = await state(room)

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type).not.toBe('COMMAND_COMMITTED')
    expect(JSON.stringify(undone)).toContain('mirror')
    expect(await state(room)).toEqual(settled)
  })

  it('ends the whole bond once the pair is more than 60 feet apart', async () => {
    const room = await bondedRoom({ [CHARACTER_ACTOR_ID]: { x: 150 + 20_000, y: 150 } })
    const { answer } = await room.startAction(CHARACTER_ACTOR_ID, ['TARGET_RANGE_UNCHECKED'])
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect((await state(room)).bonded).toBe(false)
  })
})
