import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, directedAreaWolf, forceOnFailedSave } from './actionRoomFixture.js'
import { answerAllSaves, tokenPositions } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readPendingActionDecision, readRoomHistory } from './roomHistoryReads.js'

/**
 * ATTACK-7.T5d (AC 7.7, D157): an area whose failed saves push each creature up to 10 feet away
 * holds one pick at a time, the farthest creature first; each offer is derived on the Scene with the
 * farther creatures already where their picks left them, and the area commits after the last answer.
 * A token is 100 px, a cell 5 ft.
 */

const SOURCE_ID = testUuid(0xb30)
const NEAR_ID = testUuid(0xb31)
const FAR_ID = testUuid(0xb32)
const SOURCE_AT: ScenePoint = { x: 150, y: 150 }
const NEAR_AT: ScenePoint = { x: 250, y: 150 }
const FAR_AT: ScenePoint = { x: 350, y: 150 }

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const committed = (answer: { type: string }) =>
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
const east = (...xs: number[]) => xs.map((x) => ({ x, y: 150 }))
const byPosition = (left: ScenePoint, right: ScenePoint) => left.x - right.x || left.y - right.y

/** A Wolf whose 15-foot line pushes each creature that fails its save up to 10 feet away. */
async function lineRoom() {
  const creature = forceOnFailedSave(
    directedAreaWolf({
      shapeKind: 'LINE',
      length: { amount: 15, unit: 'FEET' },
      width: { amount: 5, unit: 'FEET' }
    }),
    'AWAY_FROM_SOURCE',
    10,
    'UP_TO'
  )
  const room = await actionRoom({
    rolls: [],
    actors: [
      srdCreatureActor({ id: SOURCE_ID, creature }),
      srdCreatureActor({ id: NEAR_ID, creature: plainWolf }),
      srdCreatureActor({ id: FAR_ID, creature: plainWolf })
    ],
    positions: { [SOURCE_ID]: SOURCE_AT, [NEAR_ID]: NEAR_AT, [FAR_ID]: FAR_AT },
    ownerFeatureId: creature.features.find(({ label }) => label === 'Bite')?.id
  })
  committed((await room.startDirectedAreaAction({ x: 200, y: 150 }, { x: 500, y: 150 })).answer)
  await answerAllSaves(room)
  return room
}
type Room = Awaited<ReturnType<typeof lineRoom>>

async function destinationPick(room: Room) {
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'FORCED_MOVEMENT_DESTINATION')
    throw new Error(`Expected the destination pick, got ${decision.pending.kind}.`)
  return { decision, pending: decision.pending }
}

async function land(room: Room, position: ScenePoint) {
  const { decision, pending } = await destinationPick(room)
  return room.resolve(decision, {
    kind: 'FORCED_MOVEMENT',
    requestId: pending.requestId,
    position
  })
}

describe('an area push that leaves its creatures a choice (AC 7.7)', () => {
  it('offers the farthest creature’s pick first, moving nothing and committing nothing', async () => {
    const room = await lineRoom()
    const { pending } = await destinationPick(room)

    expect(pending.sourceActorId).toBe(SOURCE_ID)
    expect(pending.targetActorId).toBe(FAR_ID)
    expect(pending.allowedResponses).toEqual(['FORCED_MOVEMENT'])
    expect([...pending.positions].sort(byPosition)).toEqual(east(350, 450, 550))
    expect(tokenPositions(room)(FAR_ID)).toEqual(FAR_AT)
    expect(tokenPositions(room)(NEAR_ID)).toEqual(NEAR_AT)
    const { receipts } = await readRoomHistory(room.room.base.stub)
    expect(receipts.filter(({ commandType }) => commandType === 'RESOLVE_ACTION')).toEqual([])
  })

  it('derives the nearer creature’s offer with the farther one where its pick left it, then commits both moves', async () => {
    const room = await lineRoom()
    committed(await land(room, { x: 450, y: 150 }))

    const { pending } = await destinationPick(room)
    expect(pending.targetActorId).toBe(NEAR_ID)
    // The farther creature now stands 10 feet out, so the nearer one may move 5 feet at most.
    expect([...pending.positions].sort(byPosition)).toEqual(east(250, 350))
    expect(tokenPositions(room)(FAR_ID)).toEqual(FAR_AT)

    committed(await land(room, { x: 350, y: 150 }))
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    expect(tokenPositions(room)(FAR_ID)).toEqual({ x: 450, y: 150 })
    expect(tokenPositions(room)(NEAR_ID)).toEqual({ x: 350, y: 150 })

    committed(
      await room.send({
        type: 'REVERT_LAST_ACTION',
        encounterId: room.room.encounterId,
        commandId: crypto.randomUUID(),
        expectedVersion: await room.version()
      })
    )
    expect(tokenPositions(room)(FAR_ID)).toEqual(FAR_AT)
    expect(tokenPositions(room)(NEAR_ID)).toEqual(NEAR_AT)
  })

  it('offers the nearer creature every square the farther one left free', async () => {
    const room = await lineRoom()
    committed(await land(room, { x: 550, y: 150 }))

    const { pending } = await destinationPick(room)
    expect([...pending.positions].sort(byPosition)).toEqual(east(250, 350, 450))
  })

  it('refuses a square the pick did not offer and keeps it open', async () => {
    const room = await lineRoom()
    committed(await land(room, { x: 450, y: 150 }))

    expect(await land(room, { x: 450, y: 150 })).toMatchObject({ type: 'COMMAND_REJECTED' })
    const { pending } = await destinationPick(room)
    expect(pending.targetActorId).toBe(NEAR_ID)
    expect(tokenPositions(room)(NEAR_ID)).toEqual(NEAR_AT)
  })
})
