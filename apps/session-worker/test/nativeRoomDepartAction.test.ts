import { runInDurableObject } from 'cloudflare:test'
import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { SpellAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { planeShift } from '@artificer-toolkit/source-data/srd/spells/plane-shift.js'
import { wordOfRecall } from '@artificer-toolkit/source-data/srd/spells/word-of-recall.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RoomEncounterStore } from '../src/roomEncounterStore.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'

const CHARACTER_ACTOR_ID = testUuid(0x8a0)
const CHARACTER_ID = testUuid(0x8a1)
const WOLF_IDS = [0x8a2, 0x8a3].map(testUuid)
const RANGE_UNCHECKED: EncounterRuleWarningCodeDto[] = ['TARGET_RANGE_UNCHECKED']

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

function travelRoom(spell: SpellAuthored) {
  return actionRoom({
    actors: [
      characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
      ...WOLF_IDS.map((id) => srdCreatureActor({ id, creature: plainWolf }))
    ],
    characterSpellcasting: { spells: [spell], prepared: [spell.id] },
    characterAction: (action) => action.label.startsWith(spell.label),
    rolls: [],
    fallbackRoll: 5
  })
}

type TravelRoom = Awaited<ReturnType<typeof travelRoom>>

const absenceOf = (room: TravelRoom) =>
  runInDurableObject(room.room.base.stub, (_instance, context) =>
    Object.fromEntries(
      new RoomEncounterStore(context.storage)
        .documents('encounterRunActors')
        .map((row) => [row.id, readStoredRunActor(row)?.absence ?? null])
    )
  )

const commit = (answer: { type: string }) =>
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

describe.each([{ spell: wordOfRecall }, { spell: planeShift }])(
  '$spell.label departs the chosen creatures from the Encounter (D125)',
  ({ spell }) => {
    it('sets every chosen actor departed, undoes to present, and lets the GM return one', async () => {
      const room = await travelRoom(spell)
      const chosen = [CHARACTER_ACTOR_ID, ...WOLF_IDS]

      const { answer } = await room.startActorsAction(chosen, RANGE_UNCHECKED, false)
      commit(answer)
      expect(await absenceOf(room)).toEqual(
        Object.fromEntries(chosen.map((id) => [id, 'DEPARTED']))
      )

      const undone = await room.send({
        type: 'REVERT_LAST_ACTION',
        encounterId: room.room.encounterId,
        commandId: crypto.randomUUID(),
        expectedVersion: await room.version()
      })
      commit(undone)
      expect(await absenceOf(room)).toEqual(Object.fromEntries(chosen.map((id) => [id, null])))

      commit((await room.startActorsAction([WOLF_IDS[0]!], RANGE_UNCHECKED, false)).answer)
      const returned = await room.send({
        type: 'UPDATE_ACTOR',
        encounterId: room.room.encounterId,
        commandId: crypto.randomUUID(),
        expectedVersion: await room.version(),
        actorId: WOLF_IDS[0]!,
        returnToInitiative: true
      })
      commit(returned)
      expect((await absenceOf(room))[WOLF_IDS[0]!]).toBeNull()
    }, 120000)
  }
)
