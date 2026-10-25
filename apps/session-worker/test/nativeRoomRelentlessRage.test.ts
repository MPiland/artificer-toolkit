import { runInDurableObject } from 'cloudflare:test'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import { srdByLabel } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import {
  characterActor,
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import { barbarian, RAGE_EFFECT_ID } from '@artificer-toolkit/source-data/srd/classes/barbarian.js'
import { afterEach, describe, expect, it } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'

/**
 * SPELLS-31.T5f3 through the room: a raging level 11 Barbarian's Relentless Rage meets a lethal
 * attack with a DC 10 Constitution save. A pass leaves it at 1 hit point; pass or fail, the attempt
 * spends a use on the Character's own Sheet in the attack's commit, and the GM's undo gives back the
 * hit points and the use.
 */

const ATTACKER_ID = testUuid(0x9f30)
const CHARACTER_ACTOR_ID = testUuid(0x9f31)
const CHARACTER_ID = testUuid(0x9f32)
const RAGE_ID = testUuid(0x9f33)
/** The attack d20 face (zero-based) the Bite adds 4 to: a hit on any armor class. */
const HITS = 17

const attacker = biteWolf('ATTACK', { damage: 20 })
const rage = srdByLabel(barbarian.features ?? [], 'Rage').effects?.[0]

afterEach(() => {
  closeTrackedSockets()
})

/** Every later die shows `face` (zero-based): the save's among them. */
async function ragingRoom(face: number, raging = true) {
  if (!rage || rage.id !== RAGE_EFFECT_ID) throw new Error('The SRD Rage has no Rage effect.')
  return actionRoom({
    actors: [
      srdCreatureActor({ id: ATTACKER_ID, creature: attacker, disposition: 'HOSTILE' }),
      characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID })
    ],
    ownerFeatureId: creatureFeature(attacker, 'Bite').id,
    autoRoll: 'BOTH',
    rolls: [HITS],
    fallbackRoll: face,
    characterClassFeatures: [srdByLabel(barbarian.features ?? [], 'Relentless Rage')],
    characterPlay: { characterClass: barbarian, classLevel: 11, currentHitPoints: 5 },
    seed: async ({ effects, encounterId, occurredAt }) => {
      if (!raging) return
      const planned = plannedModifierGrant({
        encounterId,
        sourceActorId: CHARACTER_ACTOR_ID,
        holderActorId: CHARACTER_ACTOR_ID,
        lifecycle: {},
        effect: rage,
        sourceLabel: 'Rage'
      })
      await effects.create({
        id: RAGE_ID,
        // The room fixture moves a Character actor's effects onto the Character, as a live Run holds them.
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: CHARACTER_ACTOR_ID },
        // The fixture compiles under its own effect id; a live Rage keeps its authored one.
        definition: { ...planned.definition, authoredEffectId: RAGE_EFFECT_ID },
        lifecycle: planned.lifecycle,
        occurredAt
      })
    }
  })
}

type Room = Awaited<ReturnType<typeof ragingRoom>>

/** The Character's hit points and the uses its Sheet holds as spent. */
function characterState(room: Room) {
  return runInDurableObject(room.room.base.stub, (_instance, context) => {
    const row = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((candidate) => candidate.characterId === CHARACTER_ID)
    if (!row) throw new Error('Missing room Character play state.')
    const play = readCharacterPlay(row)
    return {
      hitPoints: play.hitpoints.current,
      uses: play.resourceUsage.reduce((total, { used }) => total + used, 0)
    }
  })
}

async function attack(room: Room) {
  const { answer } = await room.startAction(CHARACTER_ACTOR_ID, ['TARGET_RANGE_UNCHECKED'])
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
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

describe('Relentless Rage holds a lethal attack while raging (SPELLS-31.T5f3)', () => {
  it('leaves the raging Character at 1 hit point on a pass, spends a use, and the undo restores both', async () => {
    const room = await ragingRoom(19)
    expect(await characterState(room)).toEqual({ hitPoints: 5, uses: 0 })

    await attack(room)
    expect(await characterState(room)).toEqual({ hitPoints: 1, uses: 1 })

    await undo(room)
    expect(await characterState(room)).toEqual({ hitPoints: 5, uses: 0 })
  })

  it('counts a failed attempt as a use, and the undo gives it back', async () => {
    const room = await ragingRoom(0)

    await attack(room)
    expect(await characterState(room)).toEqual({ hitPoints: 0, uses: 1 })

    await undo(room)
    expect(await characterState(room)).toEqual({ hitPoints: 5, uses: 0 })
  })

  it('does not hold the blow when the Character is not raging', async () => {
    const room = await ragingRoom(19, false)

    await attack(room)
    expect(await characterState(room)).toEqual({ hitPoints: 0, uses: 0 })
  })
})
