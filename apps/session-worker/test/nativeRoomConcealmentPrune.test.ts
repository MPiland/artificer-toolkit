import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { concealmentRecord } from '@artificer-toolkit/rules-runtime/testing/concealmentFixture'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readRoomHistory } from './roomHistoryReads.js'

const HIDER_ID = testUuid(0xe20)
/** Behind the wall of the hider's side, so it cannot see the hider until one of them crosses. */
const NEAR_ID = testUuid(0xe21)
/** Behind a second wall: it never sees the hider in these tests. */
const FAR_ID = testUuid(0xe22)
const EFFECT_ID = testUuid(0xe23)
const STEALTH_TOTAL = 15

const bite = biteWolf('ATTACK', { damage: 1, reachFeet: 5 })

const sideWall = {
  kind: 'WALL' as const,
  id: testUuid(0xe24),
  a: { x: 300, y: -500 },
  b: { x: 300, y: 500 },
  blocksLight: true,
  blocksMovement: false
}
const floorWall = {
  kind: 'WALL' as const,
  id: testUuid(0xe25),
  a: { x: 0, y: 500 },
  b: { x: 1000, y: 500 },
  blocksLight: true,
  blocksMovement: false
}

const HIDER_AT = { x: 150, y: 150 }
const NEAR_AT = { x: 450, y: 150 }
const FAR_AT = { x: 350, y: 650 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** A Run whose hider holds a seeded concealment from both observers; `mover` acts first. */
function pruneRoom(mover: 'HIDER' | 'NEAR') {
  const hider = srdCreatureActor({ id: HIDER_ID, creature: bite })
  const near = srdCreatureActor({ id: NEAR_ID, creature: bite, disposition: 'FRIENDLY' })
  const far = srdCreatureActor({ id: FAR_ID, creature: bite, disposition: 'FRIENDLY' })
  return actionRoom({
    autoRoll: 'BOTH',
    rolls: [14],
    sceneOverrides: { barriers: [sideWall, floorWall] },
    actors: mover === 'HIDER' ? [hider, near, far] : [near, hider, far],
    positions: { [HIDER_ID]: HIDER_AT, [NEAR_ID]: NEAR_AT, [FAR_ID]: FAR_AT },
    ownerFeatureId: creatureFeature(bite, 'Bite').id,
    seed: async ({ effects, encounterId, occurredAt }) => {
      const record = concealmentRecord({
        id: EFFECT_ID,
        encounterId,
        holderActorId: HIDER_ID,
        observerActorIds: [NEAR_ID, FAR_ID],
        concealmentTotal: STEALTH_TOTAL
      })
      await effects.create({
        id: EFFECT_ID,
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId, targetActorId: HIDER_ID },
        lifecycle: record.lifecycle,
        definition: record.definition,
        occurredAt
      })
    }
  })
}

type PruneRoom = Awaited<ReturnType<typeof pruneRoom>>

/** The observers the hider's seeded concealment still hides it from; null once it has ended. */
async function observers(room: PruneRoom) {
  const { activeEffects } = await readRoomHistory(room.room.base.stub)
  const effect = activeEffects.find(({ id }) => id === EFFECT_ID)
  return effect ? (effect.lifecycle.concealedFromActorIds ?? []) : null
}

async function undoLastMove(room: PruneRoom, expectedSceneVersion: number) {
  const commandId = crypto.randomUUID()
  return room.room.send(commandId, {
    scope: 'SCENE',
    command: {
      type: 'UNDO_LAST_SCENE_MOVE',
      commandId,
      expectedSceneVersion,
      sceneId: room.room.scene.id
    }
  })
}

describe('a token move that brings an observer into sight of a concealed hider', () => {
  it('drops the observer who now sees the hider, and the GM undo of the move gives it back', async () => {
    const room = await pruneRoom('HIDER')
    expect(await observers(room)).toEqual([NEAR_ID, FAR_ID].sort())

    const moved = await room.room.move([HIDER_AT, { x: 350, y: 150 }])
    expect(moved.type, JSON.stringify(moved)).toBe('COMMAND_COMMITTED')
    expect(await observers(room)).toEqual([FAR_ID])

    const undone = await undoLastMove(room, room.room.scene.version + 1)
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await observers(room)).toEqual([NEAR_ID, FAR_ID].sort())
  })

  it('drops an observer that itself walks into sight of the hider, and not the others', async () => {
    const room = await pruneRoom('NEAR')

    const moved = await room.room.move([NEAR_AT, { x: 250, y: 150 }])
    expect(moved.type, JSON.stringify(moved)).toBe('COMMAND_COMMITTED')
    expect(await observers(room)).toEqual([FAR_ID])

    const undone = await undoLastMove(room, room.room.scene.version + 1)
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await observers(room)).toEqual([NEAR_ID, FAR_ID].sort())
  })

  it('leaves the concealment ended when the GM undoes the move after the hider attacked', async () => {
    const room = await pruneRoom('HIDER')
    const moved = await room.room.move([HIDER_AT, { x: 350, y: 150 }])
    expect(moved.type, JSON.stringify(moved)).toBe('COMMAND_COMMITTED')

    const { tokens } = room.room.scene
    const sceneContext = {
      sceneId: room.room.scene.id,
      expectedSceneVersion: room.room.scene.version + 1,
      sourceTokenId: tokens[0]!.id,
      targetTokenId: tokens[1]!.id
    }
    const attacked = await room.startAction(NEAR_ID, ['ACTION_ECONOMY_UNAVAILABLE'], sceneContext)
    expect(attacked.answer.type, JSON.stringify(attacked.answer)).toBe('COMMAND_COMMITTED')
    expect(await observers(room)).toBeNull()

    const undone = await undoLastMove(room, room.room.scene.version + 1)
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await observers(room)).toBeNull()
  })
})
