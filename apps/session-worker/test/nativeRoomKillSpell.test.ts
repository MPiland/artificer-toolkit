import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { powerWordKill } from '@artificer-toolkit/source-data/srd/spells/power-word-kill.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

const CASTER_ACTOR_ID = testUuid(0xf00)
const CASTER_ID = testUuid(0xf01)
const WOLF_ID = testUuid(0xf02)
const RANGE_UNCHECKED: EncounterRuleWarningCodeDto[] = ['TARGET_RANGE_UNCHECKED']

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

function killRoom(wolfHitPoints: number) {
  return actionRoom({
    autoRoll: 'BOTH',
    rolls: [],
    actors: [
      characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID }),
      srdCreatureActor({
        id: WOLF_ID,
        creature: { ...plainWolf, hitPoints: wolfHitPoints },
        currentHitPoints: wolfHitPoints
      })
    ],
    characterSpellcasting: { spells: [powerWordKill], prepared: [powerWordKill.id] },
    characterPlay: { classLevel: 17 },
    characterAction: (action) => action.label.startsWith(powerWordKill.label)
  })
}

const wolfVitals = async (room: Awaited<ReturnType<typeof killRoom>>) => {
  const wolf = vitalsOf(await readRoomHistory(room.room.base.stub)).find(({ id }) => id === WOLF_ID)
  if (!wolf) throw new Error('The Wolf is missing.')
  return wolf
}

describe('Power Word Kill cast by a Character, from data (SPELLS-4.T2i)', () => {
  it('kills a creature with 100 hit points and one undo restores it and the slot', async () => {
    const room = await killRoom(100)
    const { answer } = await room.startAction(WOLF_ID, RANGE_UNCHECKED)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await wolfVitals(room)).toMatchObject({ currentHitPoints: 0, defeated: true })

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await wolfVitals(room)).toMatchObject({ currentHitPoints: 100 })
  }, 120000)

  it('leaves a creature with 101 hit points untouched', async () => {
    const room = await killRoom(101)
    const { answer } = await room.startAction(WOLF_ID, RANGE_UNCHECKED)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await wolfVitals(room)).toMatchObject({ currentHitPoints: 101 })
  }, 120000)
})
