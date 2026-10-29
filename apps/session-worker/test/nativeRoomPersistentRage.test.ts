import { runInDurableObject } from 'cloudflare:test'
import { withEncounterActorIdleTurnMark } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { srdByLabel } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { barbarian, RAGE_EFFECT_ID } from '@artificer-toolkit/source-data/srd/classes/barbarian.js'
import { afterEach, describe, expect, it } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'

/**
 * SPELLS-31.T5f2 through the room: a raging Barbarian whose turn passes idle keeps Rage at level 15
 * (Persistent Rage) and loses it below.
 */

const CHARACTER_ACTOR_ID = testUuid(0x9f40)
const CHARACTER_ID = testUuid(0x9f41)
const WOLF_ID = testUuid(0x9f42)
const RAGE_ID = testUuid(0x9f43)

const rage = srdByLabel(barbarian.features ?? [], 'Rage').effects?.[0]
const wolf = biteWolf('ATTACK', { damage: 1 })

afterEach(() => {
  closeTrackedSockets()
})

/** A room on the raging Character's turn, armed: it has neither attacked nor been hurt since. */
async function ragingRoom(classLevel: number) {
  if (!rage || rage.id !== RAGE_EFFECT_ID) throw new Error('The SRD Rage has no Rage effect.')
  const character = characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID })
  return actionRoom({
    actors: [
      encounterRunActorStateSchema.parse({
        ...character,
        resources: withEncounterActorIdleTurnMark(character, 'ARMED')
      }),
      srdCreatureActor({ id: WOLF_ID, creature: wolf, disposition: 'HOSTILE' })
    ],
    // The room needs an action to offer; these turns pass without one.
    characterAction: () => true,
    characterClassFeatures: barbarian.features?.filter(
      ({ label, availableAtLevel }) =>
        label === 'Persistent Rage' && (availableAtLevel ?? 1) <= classLevel
    ),
    characterPlay: { characterClass: barbarian, classLevel, currentHitPoints: 30 },
    seed: async ({ effects, encounterId, occurredAt }) => {
      const planned = plannedModifierGrant({
        encounterId,
        sourceActorId: CHARACTER_ACTOR_ID,
        holderActorId: CHARACTER_ACTOR_ID,
        lifecycle: { endTriggers: [{ event: 'LIFECYCLE', timing: 'END', code: 'ON_IDLE_TURN' }] },
        // Rage's minute: a one-round grant would expire at this turn's end whatever the idle check did.
        rounds: 10,
        effect: rage,
        sourceLabel: 'Rage',
        keepAuthoredEffectId: true
      })
      await effects.create({
        id: RAGE_ID,
        // The room fixture moves a Character actor's effects onto the Character, as a live Run holds them.
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: CHARACTER_ACTOR_ID },
        definition: planned.definition,
        lifecycle: planned.lifecycle,
        occurredAt
      })
    }
  })
}

/** The Rage the Character holds: the room keeps a Character actor's effects on the Character. */
function rageIds(room: Awaited<ReturnType<typeof ragingRoom>>) {
  return runInDurableObject(room.room.base.stub, (_instance, context) =>
    new RoomEncounterStore(context.storage)
      .documents('characterActiveRuleEffects')
      .map(({ id }) => id)
      .filter((id) => id === RAGE_ID)
  )
}

describe('Persistent Rage keeps Rage through an idle turn (SPELLS-31.T5f2)', () => {
  it('keeps the Rage of a level 15 Barbarian whose turn passed idle', async () => {
    const room = await ragingRoom(15)
    expect(await rageIds(room)).toEqual([RAGE_ID])

    await room.advanceTurn()
    expect(await rageIds(room)).toEqual([RAGE_ID])
  })

  it('ends the Rage of a level 14 Barbarian whose turn passed idle', async () => {
    const room = await ragingRoom(14)
    expect(await rageIds(room)).toEqual([RAGE_ID])

    await room.advanceTurn()
    expect(await rageIds(room)).toEqual([])
  })
})
