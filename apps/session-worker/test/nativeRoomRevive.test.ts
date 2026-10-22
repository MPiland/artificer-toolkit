import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { cleric } from '@artificer-toolkit/source-data/srd/classes/cleric.js'
import { revivify } from '@artificer-toolkit/source-data/srd/spells/revivify.js'
import { trueResurrection } from '@artificer-toolkit/source-data/srd/spells/true-resurrection.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

const CASTER_ACTOR_ID = testUuid(0xf10)
const CASTER_ID = testUuid(0xf11)
const WOLF_ID = testUuid(0xf12)
const TOUCH_UNCHECKED: EncounterRuleWarningCodeDto[] = ['TARGET_RANGE_UNCHECKED']

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

function reviveRoom(spell: typeof revivify, wolf: { currentHitPoints: number; defeated: boolean }) {
  return actionRoom({
    autoRoll: 'BOTH',
    rolls: [],
    actors: [
      characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID }),
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf, ...wolf })
    ],
    characterSpellcasting: { spells: [spell], prepared: [spell.id] },
    characterPlay: { characterClass: cleric, classLevel: 17 },
    characterAction: (action) => action.label.startsWith(spell.label)
  })
}

const wolfVitals = async (room: Awaited<ReturnType<typeof reviveRoom>>) => {
  const wolf = vitalsOf(await readRoomHistory(room.room.base.stub)).find(({ id }) => id === WOLF_ID)
  if (!wolf) throw new Error('The Wolf is missing.')
  return wolf
}

describe('Revivify cast by a Character, from data (SPELLS-4.T2g1)', () => {
  it('returns a dead creature to 1 hit point, clears its defeat, and one undo restores it', async () => {
    const room = await reviveRoom(revivify, { currentHitPoints: 0, defeated: true })
    const { answer } = await room.startAction(WOLF_ID, TOUCH_UNCHECKED)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await wolfVitals(room)).toMatchObject({ currentHitPoints: 1, defeated: false })

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await wolfVitals(room)).toMatchObject({ currentHitPoints: 0, defeated: true })
  }, 120000)

  it('warns, overridably, for a target that is not dead and then changes nothing', async () => {
    const room = await reviveRoom(revivify, { currentHitPoints: 5, defeated: false })
    const refused = await room.startAction(WOLF_ID, TOUCH_UNCHECKED)
    expect(refused.answer.type).toBe('COMMAND_REJECTED')
    expect(JSON.stringify(refused.answer)).toContain('TARGET_NOT_DEAD')

    const { answer } = await room.startAction(WOLF_ID, [...TOUCH_UNCHECKED, 'TARGET_NOT_DEAD'])
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await wolfVitals(room)).toMatchObject({ currentHitPoints: 5 })
  }, 120000)
})

describe('True Resurrection cast by a Character, from data (SPELLS-4.T2g1)', () => {
  it('returns a dead creature to its maximum hit points', async () => {
    const room = await reviveRoom(trueResurrection, { currentHitPoints: 0, defeated: true })
    const { answer } = await room.startAction(WOLF_ID, TOUCH_UNCHECKED)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await wolfVitals(room)).toMatchObject({
      currentHitPoints: plainWolf.hitPoints,
      defeated: false
    })
  }, 120000)
})
