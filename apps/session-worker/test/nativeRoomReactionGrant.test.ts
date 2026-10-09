import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { joltingGauntlet } from '@artificer-toolkit/rules-runtime/testing/joltingGauntlet'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { reactionWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-5.5: a creature under `REACTION_COUNT SET_VALUE 0` is offered no reaction until the grant
 * ends (D99, closing D15). The Character strikes the Wolf with a homebrew gauntlet whose hit, like
 * Shocking Grasp's, stops the target taking reactions until the start of its next turn, then walks
 * out of the Wolf's reach.
 */

const CHARACTER_ACTOR_ID = testUuid(0xf20)
const CHARACTER_ID = testUuid(0xf21)
const WOLF_ID = testUuid(0xf22)
const gauntlet = joltingGauntlet()

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** The Character (acting first) stands beside the Wolf, which can make opportunity attacks. */
async function reactionGrantRoom(attackRoll: number) {
  return actionRoom({
    autoRoll: 'BOTH',
    rolls: [attackRoll, attackRoll],
    actors: [
      {
        ...characterActor({ id: CHARACTER_ACTOR_ID, characterId: CHARACTER_ID }),
        // Initiative reads the Character's frozen identity, which a turn change checks.
        snapshot: { kind: 'CHARACTER', id: CHARACTER_ID, systemId: srdSystemRecord.id }
      },
      srdCreatureActor({ id: WOLF_ID, creature: reactionWolf })
    ],
    characterEquipment: [gauntlet],
    characterAction: (action) => action.label === gauntlet.label
  })
}

type Room = Awaited<ReturnType<typeof reactionGrantRoom>>

const activeEffects = async (room: Room) =>
  (await readRoomHistory(room.room.base.stub)).activeEffects

async function strike(room: Room) {
  const struck = await room.startAction(WOLF_ID, ['TARGET_RANGE_UNCHECKED'])
  expect(struck.answer.type, JSON.stringify(struck.answer)).toBe('COMMAND_COMMITTED')
}

/** Walks the Character out of the Wolf's reach and returns the decision the move left pending. */
async function walkAway(room: Room) {
  const walked = await room.room.move(
    [
      { x: 150, y: 150 },
      { x: 150, y: 450 }
    ],
    await room.version()
  )
  expect(walked.type, JSON.stringify(walked)).toBe('COMMAND_COMMITTED')
  return room.room.pending()
}

describe('a creature that can’t take reactions (SPELLS-5.5)', () => {
  it('is offered no opportunity attack while the grant lasts', async () => {
    const room = await reactionGrantRoom(18)

    await strike(room)
    const pending = await walkAway(room)

    expect(await activeEffects(room)).toMatchObject([{ targetActorId: WOLF_ID }])
    expect(pending).toBeNull()
  })

  it('is offered its opportunity attack when the strike misses and applies nothing', async () => {
    const room = await reactionGrantRoom(1)

    await strike(room)
    const pending = await walkAway(room)

    expect(await activeEffects(room)).toEqual([])
    expect(pending?.context.kind).toBe('ENCOUNTER_MOVEMENT_REACTION')
  })

  it('is offered its opportunity attack again once the grant ends at its start of turn', async () => {
    const room = await reactionGrantRoom(18)
    await strike(room)
    expect(await activeEffects(room)).toHaveLength(1)

    await room.advanceTurn()
    expect(await activeEffects(room)).toEqual([])
    await room.advanceTurn()
    const pending = await walkAway(room)

    expect(pending?.context.kind).toBe('ENCOUNTER_MOVEMENT_REACTION')
  })
})
