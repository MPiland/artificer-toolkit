import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { fleshToStone } from '@artificer-toolkit/source-data/srd/spells/flesh-to-stone.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readActorConditionIds, readRoomHistory, type RoomHistory } from './roomHistoryReads.js'

/**
 * QUALITY-15.T3ad: the unmodified SRD Flesh to Stone, cast by a Character. A failed save restrains
 * the target for the spell's minute; three failed end-of-turn saves add the petrified condition for
 * the rest of the duration, and a target still held when the full minute runs out is left petrified.
 */

const CASTER_ACTOR_ID = testUuid(0xf20)
const CASTER_ID = testUuid(0xf21)
const WOLF_ID = testUuid(0xf22)
const RANGE_UNCHECKED: EncounterRuleWarningCodeDto[] = ['TARGET_RANGE_UNCHECKED']

const conditionId = (code: string) => {
  const condition = srdSystemRecord.conditionTypes.find((candidate) => candidate.code === code)
  if (!condition) throw new Error(`The SRD has no ${code} condition.`)
  return condition.id
}
const RESTRAINED = conditionId('RESTRAINED')
const PETRIFIED = conditionId('PETRIFIED')

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** The GM's dice roll themselves: zero-based, so 0 is a natural 1 and 19 a natural 20. */
async function castFleshToStone(rolls: readonly number[]) {
  const room = await actionRoom({
    autoRoll: 'BOTH',
    rolls,
    actors: [
      {
        ...characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID }),
        // Initiative reads the Character's frozen identity, which a turn change checks.
        snapshot: { kind: 'CHARACTER', id: CASTER_ID, systemId: srdSystemRecord.id }
      },
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
    ],
    characterSpellcasting: { spells: [fleshToStone], prepared: [fleshToStone.id] },
    characterPlay: { classLevel: 17 },
    characterAction: (action) => action.label.startsWith(fleshToStone.label)
  })
  const { answer } = await room.startAction(WOLF_ID, RANGE_UNCHECKED)
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  return room
}

type FleshToStoneRoom = Awaited<ReturnType<typeof castFleshToStone>>

/** Ends `rounds` rounds of the caster's turn, then the Wolf's, so the Wolf's end-of-turn effects run. */
async function endRounds(room: FleshToStoneRoom, rounds: number) {
  for (let round = 0; round < rounds; round += 1) {
    await room.advanceTurn()
    await room.advanceTurn()
  }
  return readRoomHistory(room.room.base.stub)
}

const wolfConditions = (history: RoomHistory) => [...readActorConditionIds(history, WOLF_ID)].sort()

describe('Flesh to Stone cast by a Character, from data (QUALITY-15.T3ad)', () => {
  it('restrains the Wolf, and three failed saves add the petrified condition while the spell lasts', async () => {
    const room = await castFleshToStone([0, 0, 0, 0])
    const cast = await readRoomHistory(room.room.base.stub)
    expect(wolfConditions(cast)).toEqual([RESTRAINED])
    const [effect] = cast.activeEffects
    expect(JSON.parse(effect!.definitionJson).recurrence.expiration).toMatchObject({
      kind: 'TICKS',
      initialRemaining: 10
    })

    const twoFailures = await endRounds(room, 2)
    expect(wolfConditions(twoFailures)).toEqual([RESTRAINED])

    const threeFailures = await endRounds(room, 1)
    expect(wolfConditions(threeFailures)).toEqual([PETRIFIED, RESTRAINED].sort())
    expect(threeFailures.activeEffects.map(({ targetActorId }) => targetActorId)).toEqual([WOLF_ID])
  }, 240000)

  it('leaves the Wolf petrified, and no longer restrained, once the spell runs its full minute', async () => {
    const room = await castFleshToStone([0, 0, 0, 0])
    const lastRound = await endRounds(room, 9)
    expect(wolfConditions(lastRound)).toEqual([PETRIFIED, RESTRAINED].sort())
    expect(lastRound.activeEffects).toHaveLength(1)

    const completed = await endRounds(room, 1)
    expect(wolfConditions(completed)).toEqual([PETRIFIED])
    expect(completed.activeEffects).toEqual([])
  }, 240000)

  it('ends the spell, freeing the Wolf, at its third successful save', async () => {
    const room = await castFleshToStone([0, 19, 0, 19, 19])
    const history = await endRounds(room, 4)
    expect(wolfConditions(history)).toEqual([])
    expect(history.activeEffects).toEqual([])
  }, 240000)
})
