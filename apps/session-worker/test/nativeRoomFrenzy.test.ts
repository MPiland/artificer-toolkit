import { runInDurableObject } from 'cloudflare:test'
import { readCharacterEffect } from '@artificer-toolkit/encounter-persistence/effectStore'
import { withEncounterActorIdleTurnMark } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { srdByLabel } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { barbarian, RAGE_EFFECT_ID } from '@artificer-toolkit/source-data/srd/classes/barbarian.js'
import { pathOfTheBerserker } from '@artificer-toolkit/source-data/srd/classes/path-of-the-berserker.js'
import { afterEach, describe, expect, it } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { parseReceiptExecution, readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-31.T5f4 through the room: a raging level 3 Berserker goes into a frenzy for free, which
 * offers one more weapon attack a turn charged to its Bonus Action, and the frenzy ends with the
 * rage. A Barbarian who is not raging is not offered the frenzy.
 */

const CHARACTER_ACTOR_ID = testUuid(0x9f50)
const CHARACTER_ID = testUuid(0x9f51)
const WOLF_ID = testUuid(0x9f52)
const RAGE_ID = testUuid(0x9f53)

const rage = srdByLabel(barbarian.features ?? [], 'Rage').effects?.[0]
const frenzyFeature = srdByLabel(pathOfTheBerserker.features ?? [], 'Frenzy')
const FRENZY_EFFECT_ID = frenzyFeature.effects?.[0]?.id

/** No Scene measures the Club's reach (D11); every attack acknowledges that. */
const RANGE: ['TARGET_RANGE_UNCHECKED'] = ['TARGET_RANGE_UNCHECKED']

afterEach(() => {
  closeTrackedSockets()
})

/**
 * A room on a level 3 Berserker's turn, raging when `raging`: armed, it has neither attacked nor
 * been hurt since its last turn. Its every attack d20 shows 15 (a hit) and d4 shows 2.
 */
async function berserkerRoom(raging: boolean) {
  if (!rage || rage.id !== RAGE_EFFECT_ID) throw new Error('The SRD Rage has no Rage effect.')
  const character = characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID })
  return actionRoom({
    autoRoll: 'BOTH',
    rolls: Array.from({ length: 12 }, (_, index) => (index % 2 === 0 ? 14 : 1)),
    actors: [
      encounterRunActorStateSchema.parse({
        ...character,
        resources: withEncounterActorIdleTurnMark(character, raging ? 'ARMED' : null)
      }),
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf, disposition: 'HOSTILE' })
    ],
    characterAction: (action) => action.label.includes('Club'),
    characterClassFeatures: [frenzyFeature],
    characterPlay: { equipped: true, characterClass: barbarian, classLevel: 3 },
    seed: async ({ effects, encounterId, occurredAt }) => {
      if (!raging) return
      const planned = plannedModifierGrant({
        encounterId,
        sourceActorId: CHARACTER_ACTOR_ID,
        holderActorId: CHARACTER_ACTOR_ID,
        lifecycle: { endOnEvents: ['ON_IDLE_TURN'] },
        // Rage's minute, so only the idle check ends it.
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

type Room = Awaited<ReturnType<typeof berserkerRoom>>

/** The authored ids of the effects the Character holds, as the room keeps them on the Character. */
function heldAuthoredEffectIds(room: Room) {
  return runInDurableObject(room.room.base.stub, (_instance, context) =>
    new RoomEncounterStore(context.storage)
      .documents('characterActiveRuleEffects')
      .map((row) => readCharacterEffect(row).definition.authoredEffectId)
      .sort()
  )
}

async function frenzyActionId(room: Room) {
  return (await room.actionChoices()).actions.find(({ label }) => label.includes('Frenzy'))?.id
}

async function goIntoFrenzy(room: Room) {
  const frenzyId = await frenzyActionId(room)
  if (!frenzyId) throw new Error('The room offers no Frenzy.')
  return room.startAction(CHARACTER_ACTOR_ID, [], null, null, frenzyId)
}

/** The Club attack at the Wolf and the action economy its settled receipt spent, if it committed. */
async function attack(room: Room) {
  const { command, answer } = await room.startAction(WOLF_ID, RANGE)
  if (answer.type !== 'COMMAND_COMMITTED') return { answer, economy: undefined }
  const { receipts } = await readRoomHistory(room.room.base.stub)
  const receipt = receipts.find(
    (candidate) =>
      candidate.commandId === command.commandId && candidate.commandType === 'RESOLVE_ACTION'
  )
  if (!receipt) throw new Error('The attack left no receipt.')
  const execution = parseReceiptExecution(receipt)
  if (
    execution.status !== 'COMPLETE' ||
    execution.applicationOutputs.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
  )
    throw new Error('Expected a settled attack on the Wolf.')
  return { answer, economy: execution.applicationOutputs.actionEconomyTransition }
}

describe('Frenzy in the room (SPELLS-31.T5f4)', () => {
  it('is not offered to a Barbarian who is not raging', async () => {
    const room = await berserkerRoom(false)
    expect(await frenzyActionId(room)).toBeUndefined()
  })

  it('offers one more attack charged to the Bonus Action once the Action is spent', async () => {
    const room = await berserkerRoom(true)
    expect(await frenzyActionId(room)).toBeDefined()

    const frenzy = await goIntoFrenzy(room)
    expect(frenzy.answer.type, JSON.stringify(frenzy.answer)).toBe('COMMAND_COMMITTED')
    expect(await heldAuthoredEffectIds(room)).toEqual([FRENZY_EFFECT_ID, RAGE_EFFECT_ID].sort())
    // Once a rage: a Barbarian already in a frenzy is not offered another.
    expect(await frenzyActionId(room)).toBeUndefined()

    const first = await attack(room)
    expect(first.answer.type, JSON.stringify(first.answer)).toBe('COMMAND_COMMITTED')
    expect(first.economy).toMatchObject({ beforeUsed: 0, afterUsed: 1 })

    // The Action is spent: the frenzy's attack spends the Bonus Action instead.
    const second = await attack(room)
    expect(second.answer.type, JSON.stringify(second.answer)).toBe('COMMAND_COMMITTED')
    expect(second.economy).toMatchObject({ beforeUsed: 0, afterUsed: 1 })
    expect(second.economy?.definitionId).not.toBe(first.economy?.definitionId)

    const third = await attack(room)
    expect(third.answer.type).toBe('COMMAND_REJECTED')
    expect(JSON.stringify(third.answer)).toContain('ACTION_ECONOMY_UNAVAILABLE')
  }, 120000)

  it('ends with the rage that an idle turn ends', async () => {
    const room = await berserkerRoom(true)
    const frenzy = await goIntoFrenzy(room)
    expect(frenzy.answer.type, JSON.stringify(frenzy.answer)).toBe('COMMAND_COMMITTED')
    expect(await heldAuthoredEffectIds(room)).toEqual([FRENZY_EFFECT_ID, RAGE_EFFECT_ID].sort())

    await room.advanceTurn()
    expect(await heldAuthoredEffectIds(room)).toEqual([])
  }, 120000)
})
