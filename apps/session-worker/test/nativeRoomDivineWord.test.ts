import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { divineWord } from '@artificer-toolkit/source-data/srd/spells/divine-word.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

const CASTER_ACTOR_ID = testUuid(0xf30)
const CASTER_ID = testUuid(0xf31)
const WOLF_IDS = [0xf32, 0xf33, 0xf34, 0xf35, 0xf36].map(testUuid)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const conditionId = (code: string) => {
  const entry = srdSystemRecord.conditionTypes.find((type) => type.code === code)
  if (!entry) throw new Error(`Condition ${code} required.`)
  return entry.id
}

/** A Wolf at each of `hitPoints`, the GM's dice rolling `rolls` (raw 0 is a natural 1, 19 a 20). */
function wordRoom(hitPoints: readonly number[], rolls: readonly number[]) {
  return actionRoom({
    autoRoll: 'BOTH',
    rolls,
    actors: [
      {
        ...characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID }),
        snapshot: { kind: 'CHARACTER', id: CASTER_ID, systemId: srdSystemRecord.id }
      },
      ...hitPoints.map((current, index) =>
        srdCreatureActor({
          id: WOLF_IDS[index]!,
          creature: { ...plainWolf, hitPoints: current },
          currentHitPoints: current
        })
      )
    ],
    characterSpellcasting: { spells: [divineWord], prepared: [divineWord.id] },
    characterPlay: { classLevel: 17 },
    characterAction: (action) => action.label.startsWith(divineWord.label)
  })
}

async function castOn(room: Awaited<ReturnType<typeof wordRoom>>, count: number) {
  const { answer } = await room.startActorsAction(
    WOLF_IDS.slice(0, count),
    ['TARGET_RANGE_UNCHECKED'],
    false
  )
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  return vitalsOf(await readRoomHistory(room.room.base.stub))
}

describe('Divine Word cast by a Character, from data (SPELLS-4.T2i4b2)', () => {
  it('leaves each creature that fails its save what its hit point band owes, and kills the weakest', async () => {
    const room = await wordRoom([50, 40, 30, 20, 51], [0, 0, 0, 0, 0])
    const vitals = await castOn(room, 5)
    const read = (index: number) => {
      const wolf = vitals.find(({ id }) => id === WOLF_IDS[index])
      if (!wolf) throw new Error('A Wolf is missing.')
      return {
        hitPoints: wolf.currentHitPoints,
        conditions: ((wolf.conditions ?? []) as { conditionTypeId: string }[])
          .map(({ conditionTypeId }) => conditionTypeId)
          .sort()
      }
    }
    const sorted = (...codes: string[]) => codes.map(conditionId).sort()

    expect(read(0)).toEqual({ hitPoints: 50, conditions: sorted('DEAFENED') })
    expect(read(1)).toEqual({ hitPoints: 40, conditions: sorted('DEAFENED', 'BLINDED') })
    expect(read(2)).toEqual({
      hitPoints: 30,
      conditions: sorted('BLINDED', 'DEAFENED', 'STUNNED')
    })
    expect(read(3).hitPoints).toBe(0)
    expect(read(4)).toEqual({ hitPoints: 51, conditions: [] })
  }, 120000)

  it('leaves a creature that makes its save untouched, whatever its hit points', async () => {
    const room = await wordRoom([20], [19])
    const [wolf] = (await castOn(room, 1)).filter(({ id }) => id === WOLF_IDS[0])
    expect(wolf?.currentHitPoints).toBe(20)
    expect(wolf?.conditions ?? []).toEqual([])
  }, 120000)
})
