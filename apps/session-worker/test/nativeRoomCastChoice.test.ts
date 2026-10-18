import { runInDurableObject } from 'cloudflare:test'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { blindnessDeafness } from '@artificer-toolkit/source-data/srd/spells/blindness-deafness.js'
import { protectionFromEnergy } from '@artificer-toolkit/source-data/srd/spells/protection-from-energy.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readMaintainedStates } from './placedZoneRoomReads.js'
import {
  readActorConditionIds,
  readPendingActionDecision,
  readRoomHistory
} from './roomHistoryReads.js'

/**
 * SPELLS-30.T1 (D148): a spell whose caster picks at cast what it does to its targets resolves the
 * picked option alone, on one creature or on several, and the room refuses a cast that names no
 * option, or one the action does not offer, before any roll.
 */

const CHARACTER_ACTOR_ID = testUuid(0x7f0)
const CHARACTER_ID = testUuid(0x7f1)
const FIRST_ID = testUuid(0x7f2)
const SECOND_ID = testUuid(0x7f3)
const RANGE_UNCHECKED = ['TARGET_RANGE_UNCHECKED' as const]

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const deafened = srdSystemRecord.conditionTypes.find(({ code }) => code === 'DEAFENED')
if (!deafened) throw new Error('The SRD names the Deafened condition.')

/** A Character who knows `spell`, and two Wolves; `dice` are the GM's dice for the Wolves. */
function casterRoom(
  spell: SpellAuthored,
  label: string,
  dice: { autoRoll?: 'GAME_MASTER'; rolls?: readonly number[]; fallbackRoll?: number } = {}
) {
  return actionRoom({
    ...dice,
    actors: [
      characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
      srdCreatureActor({ id: FIRST_ID, creature: plainWolf }),
      srdCreatureActor({ id: SECOND_ID, creature: plainWolf })
    ],
    characterSpellcasting: { spells: [spell], prepared: [spell.id] },
    characterAction: (action) => action.label === label
  })
}

type CasterRoom = Awaited<ReturnType<typeof casterRoom>>

/** The id of the option `label` the room offers the player for the room's action. */
async function offeredOptionId(room: CasterRoom, label: string) {
  const choices = await room.actionChoicesAsPlayer(CHARACTER_ACTOR_ID)
  const action = choices.actions.find(({ id }) => id === room.actionId)
  if (!action || !('choiceOptions' in action.target))
    throw new Error('The room offers no pick for the action.')
  const option = action.target.choiceOptions?.find((each) => each.label === label)
  if (!option) throw new Error(`The room offers no ${label} option.`)
  return option.id
}

const readSpellSlots = (room: CasterRoom) =>
  runInDurableObject(room.room.base.stub, (_instance, context) => {
    const row = new RoomEncounterStore(context.storage)
      .documents('characterPlayStates')
      .find((candidate) => candidate.characterId === CHARACTER_ID)
    if (!row) throw new Error('Missing room Character play state.')
    return readCharacterPlay(row).spellSlots ?? []
  })

describe('room Protection from Energy cast with the damage type picked (SPELLS-30.1)', () => {
  const label = 'Protection from Energy (3rd level)'

  it('offers the five damage types and holds resistance to the picked one for its Concentration', async () => {
    const room = await casterRoom(protectionFromEnergy, label)
    const choices = await room.actionChoicesAsPlayer(CHARACTER_ACTOR_ID)
    const action = choices.actions.find(({ id }) => id === room.actionId)
    expect(action?.target).toMatchObject({
      kind: 'ACTOR',
      choiceOptions: ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder'].map((each) => ({
        label: each
      }))
    })

    const fire = await offeredOptionId(room, 'Fire')
    const { answer } = await room.startAction(
      CHARACTER_ACTOR_ID,
      [],
      null,
      null,
      room.actionId,
      CHARACTER_ACTOR_ID,
      fire
    )
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const history = await readRoomHistory(room.room.base.stub)
    const path = protectionFromEnergy.effects?.[0]?.paths[0]
    if (path?.selectionKind !== 'CHOICE') throw new Error('The spell offers a pick.')
    const fireOutcome = path.options.find((each) => each.id === fire)?.resultBlock.outcomes[0]
    if (fireOutcome?.effectKind !== 'APPLY_GRANT') throw new Error('Fire grants a modifier.')
    const firePayload = fireOutcome.grants.modifiers?.[0]?.payload
    expect(history.characterEffects).toHaveLength(1)
    const { stateContributions } = JSON.parse(history.characterEffects[0]!.definitionJson)
    expect(
      stateContributions.flatMap(
        ({ modifiers }: { modifiers: { valueDomainCode: string; payload: unknown }[] }) =>
          modifiers.map(({ valueDomainCode, payload }) => ({ valueDomainCode, payload }))
      )
    ).toEqual([{ valueDomainCode: 'DAMAGE_RESISTANCE', payload: firePayload }])
    expect(await readMaintainedStates(room)).toHaveLength(1)
    expect(await readSpellSlots(room)).toEqual([{ slotKey: 'STANDARD:3', used: 1 }])
  }, 120000)

  it.each([
    { pick: 'no', choiceOptionId: undefined },
    { pick: 'an unknown', choiceOptionId: testUuid(0x7ff) }
  ])(
    'refuses a cast with $pick pick before any roll, and spends nothing',
    async ({ choiceOptionId }) => {
      const room = await casterRoom(protectionFromEnergy, label)
      const before = await readRoomHistory(room.room.base.stub)

      const { answer } = await room.startAction(
        CHARACTER_ACTOR_ID,
        [],
        null,
        null,
        room.actionId,
        CHARACTER_ACTOR_ID,
        choiceOptionId
      )
      expect(answer).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'TARGET_UNAVAILABLE' })
      const after = await readRoomHistory(room.room.base.stub)
      expect(after.receipts).toEqual(before.receipts)
      expect(after.characterEffects).toEqual([])
      expect(await readSpellSlots(room)).toEqual([])
    },
    120000
  )
})

describe('room Blindness/Deafness cast with the condition picked (SPELLS-30.1)', () => {
  it('deafens both creatures of a 3rd-level cast that fail, until a repeat save at a turn end ends it', async () => {
    // The Wolves' first two saves are natural 1s (a raw 0); every later save is a natural 20.
    const room = await casterRoom(blindnessDeafness, 'Blindness/Deafness (3rd level)', {
      autoRoll: 'GAME_MASTER',
      rolls: [0, 0],
      fallbackRoll: 19
    })
    const choices = await room.actionChoicesAsPlayer(CHARACTER_ACTOR_ID)
    expect(choices.actions.find(({ id }) => id === room.actionId)?.target).toMatchObject({
      kind: 'ACTORS',
      maxTargets: 2,
      choiceOptions: [{ label: 'Blindness' }, { label: 'Deafness' }]
    })

    const deafness = await offeredOptionId(room, 'Deafness')
    const { answer } = await room.startActorsAction(
      [FIRST_ID, SECOND_ID],
      RANGE_UNCHECKED,
      false,
      null,
      undefined,
      undefined,
      deafness
    )
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    const cast = await readRoomHistory(room.room.base.stub)
    for (const id of [FIRST_ID, SECOND_ID])
      expect(readActorConditionIds(cast, id)).toEqual([deafened.id])
    expect(await readSpellSlots(room)).toEqual([{ slotKey: 'STANDARD:3', used: 1 }])

    // The caster's turn ends, then the first Wolf's: its repeat Constitution save succeeds.
    await room.advanceTurn()
    await room.advanceTurn()
    const later = await readRoomHistory(room.room.base.stub)
    expect(readActorConditionIds(later, FIRST_ID)).toEqual([])
    expect(readActorConditionIds(later, SECOND_ID)).toEqual([deafened.id])
  }, 120000)

  it.each([
    { pick: 'no', choiceOptionId: undefined },
    { pick: 'an unknown', choiceOptionId: testUuid(0x7fe) }
  ])(
    'refuses a cast with $pick pick before any save, and spends nothing',
    async ({ choiceOptionId }) => {
      const room = await casterRoom(blindnessDeafness, 'Blindness/Deafness (3rd level)')
      const before = await readRoomHistory(room.room.base.stub)

      const { answer } = await room.startActorsAction(
        [FIRST_ID, SECOND_ID],
        RANGE_UNCHECKED,
        false,
        null,
        undefined,
        undefined,
        choiceOptionId
      )
      expect(answer).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'TARGET_UNAVAILABLE' })
      expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
      const after = await readRoomHistory(room.room.base.stub)
      expect(after.receipts).toEqual(before.receipts)
      expect(after.evidenceRolls).toEqual(before.evidenceRolls)
      expect(await readSpellSlots(room)).toEqual([])
    },
    120000
  )
})
