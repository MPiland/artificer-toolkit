import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { powerWordStun } from '@artificer-toolkit/source-data/srd/spells/power-word-stun.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
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
const RANGE_UNCHECKED: EncounterRuleWarningCodeDto[] = ['TARGET_RANGE_UNCHECKED']
const STUNNED = srdSystemRecord.conditionTypes.find(({ code }) => code === 'STUNNED')?.id

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** The GM's dice roll themselves: zero-based, so 0 is a natural 1 and 19 a natural 20. */
function stunRoom(wolfHitPoints: number, rolls: readonly number[]) {
  return actionRoom({
    autoRoll: 'BOTH',
    rolls,
    actors: [
      {
        ...characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID }),
        // Initiative reads the Character's frozen identity, which a turn change checks.
        snapshot: { kind: 'CHARACTER', id: CASTER_ID, systemId: srdSystemRecord.id }
      },
      srdCreatureActor({
        id: WOLF_ID,
        creature: { ...plainWolf, hitPoints: wolfHitPoints },
        currentHitPoints: wolfHitPoints
      })
    ],
    characterSpellcasting: { spells: [powerWordStun], prepared: [powerWordStun.id] },
    characterPlay: { classLevel: 17 },
    characterAction: (action) => action.label.startsWith(powerWordStun.label)
  })
}

type StunRoom = Awaited<ReturnType<typeof stunRoom>>

const wolfIsStunned = async (room: StunRoom) => {
  const wolf = vitalsOf(await readRoomHistory(room.room.base.stub)).find(({ id }) => id === WOLF_ID)
  if (!wolf) throw new Error('The Wolf is missing.')
  return ((wolf.conditions ?? []) as { conditionTypeId: string }[]).some(
    ({ conditionTypeId }) => conditionTypeId === STUNNED
  )
}

async function castStun(room: StunRoom) {
  const { answer } = await room.startAction(WOLF_ID, RANGE_UNCHECKED)
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
}

/** Ends the caster's turn, then the Wolf's, so the Wolf's end-of-turn effects run. */
async function endWolfTurn(room: StunRoom) {
  await room.advanceTurn()
  await room.advanceTurn()
}

describe('Power Word Stun cast by a Character, from data (SPELLS-4.T2i3)', () => {
  it('stuns a creature with 150 hit points, and its natural 20 on the end-of-turn save ends the stun', async () => {
    const room = await stunRoom(150, [19])
    await castStun(room)
    expect(await wolfIsStunned(room)).toBe(true)

    await endWolfTurn(room)
    expect(await wolfIsStunned(room)).toBe(false)
  }, 120000)

  it('keeps the stun when the creature fails its end-of-turn save', async () => {
    const room = await stunRoom(150, [0])
    await castStun(room)

    await endWolfTurn(room)
    expect(await wolfIsStunned(room)).toBe(true)
  }, 120000)

  it('leaves a creature with 151 hit points unstunned, with nothing to save against', async () => {
    const room = await stunRoom(151, [])
    await castStun(room)
    expect(await wolfIsStunned(room)).toBe(false)

    await endWolfTurn(room)
    expect(await wolfIsStunned(room)).toBe(false)
  }, 120000)
})
