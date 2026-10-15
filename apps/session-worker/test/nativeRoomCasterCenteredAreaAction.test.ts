import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import {
  actionRoom,
  casterCenteredAreaWolf,
  directedAreaWolf,
  fireballWolf,
  frightenOnFailedSave
} from './actionRoomFixture.js'
import { areaReceipts, vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readPendingActionDecision, readRoomHistory, type RoomHistory } from './roomHistoryReads.js'

const CASTER_ID = testUuid(0xa00)
const FIRST_ID = testUuid(0xa01)
const SECOND_ID = testUuid(0xa02)
const THIRD_ID = testUuid(0xa03)
const FAR_ID = testUuid(0xa04)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const feet = (amount: number) => ({ amount, unit: 'FEET' as const })
const TEN_FOOT_SPHERE = { shapeKind: 'SPHERE', radius: feet(10) } as const

/**
 * The caster at (150, 150) and Wolves in the cells east of it at x = 250, 350 and 450, all on its
 * row, with a fourth well off that row. A token is 100 px, a cell 5 feet: a 10 ft radius from the
 * edge of the caster's space (x = 200) reaches x = 400, so the first two Wolves are inside it and the
 * third only touches it.
 */
function centeredRoom(creature: ReturnType<typeof casterCenteredAreaWolf>) {
  return actionRoom({
    rolls: [1, 1, 1, 1, 1],
    actors: [
      srdCreatureActor({ id: CASTER_ID, creature }),
      ...[FIRST_ID, SECOND_ID, THIRD_ID, FAR_ID].map((id) =>
        srdCreatureActor({ id, creature: plainWolf })
      )
    ],
    positions: { [FAR_ID]: { x: 450, y: 650 } },
    ownerFeatureId: creature.features?.find((feature) => feature.label === 'Bite')?.id
  })
}
type Room = Awaited<ReturnType<typeof centeredRoom>>

const hitPointsOf = (history: RoomHistory, id: string) =>
  vitalsOf(history).find((vitals) => vitals.id === id)?.currentHitPoints

async function pendingSaves(room: Room) {
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
  return decision.pending.saves.map(({ actorId }) => actorId).sort()
}

describe('room radius centered on the caster', () => {
  it.each([
    ['a sphere', TEN_FOOT_SPHERE],
    ['a cylinder', { shapeKind: 'CYLINDER', radius: feet(10), height: feet(40) }],
    ['a circle', { shapeKind: 'CIRCLE', radius: feet(10) }]
  ] as const)(
    'catches the Wolves within 10 ft of the edge of the caster’s space for %s, not the caster or one only touching it',
    async (_name, shape) => {
      const room = await centeredRoom(casterCenteredAreaWolf(shape))
      const { answer } = await room.startCasterCenteredAreaAction()
      expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
      expect(await pendingSaves(room)).toEqual([FIRST_ID, SECOND_ID].sort())
    }
  )

  it('offers the action with no aim and its authored radius', async () => {
    const room = await centeredRoom(casterCenteredAreaWolf(TEN_FOOT_SPHERE))
    expect((await room.actionChoices()).actions.map(({ target }) => target)).toEqual([
      { kind: 'CASTER_CENTERED', area: { kind: 'RADIUS', radius: feet(10) } }
    ])
  })

  it('commits an area that catches nobody as the caster’s spend alone', async () => {
    const creature = casterCenteredAreaWolf(TEN_FOOT_SPHERE)
    const room = await actionRoom({
      actors: [
        srdCreatureActor({ id: CASTER_ID, creature }),
        srdCreatureActor({ id: THIRD_ID, creature: plainWolf })
      ],
      positions: { [THIRD_ID]: { x: 750, y: 150 } },
      ownerFeatureId: creature.features?.find((feature) => feature.label === 'Bite')?.id
    })
    const { command, answer } = await room.startCasterCenteredAreaAction()
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    const { roots } = areaReceipts(await readRoomHistory(room.room.base.stub))
    expect(roots.map(({ receipt }) => receipt.commandId)).toEqual([command.commandId])
  })

  it('rolls the saves of the Wolves inside, damages the one that fails once, and the GM undoes it', async () => {
    const room = await centeredRoom(casterCenteredAreaWolf(TEN_FOOT_SPHERE, 10))
    const stub = room.room.base.stub
    const before = await readRoomHistory(stub)

    // 1. The caster bursts: two Wolves are caught, never the caster, the one touching it or the far one.
    const started = await room.startCasterCenteredAreaAction()
    expect(started.answer.type, JSON.stringify(started.answer)).toBe('COMMAND_COMMITTED')
    expect(await pendingSaves(room)).toEqual([FIRST_ID, SECOND_ID].sort())

    // 2. Each Wolf answers its own save: one fails, one succeeds. Nothing is damaged before the last.
    const answer = async (actorId: string, face: number) => {
      const decision = await room.pendingDecision()
      if (decision.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
      const save = decision.pending.saves.find((entry) => entry.actorId === actorId)
      if (!save) throw new Error('The creature has no pending save.')
      const answered = await room.send(
        room.resolveCommand(decision, {
          kind: 'ENTER_DICE',
          requestId: save.request.requestId,
          rawFaces: [face],
          rollMode: save.request.rollMode
        })
      )
      expect(answered.type, JSON.stringify(answered)).toBe('COMMAND_COMMITTED')
    }
    await answer(SECOND_ID, 20)
    expect(vitalsOf(await readRoomHistory(stub))).toEqual(vitalsOf(before))
    await answer(FIRST_ID, 1)

    // 3. The last answer commits the area once: full damage on the failure, none on the success.
    expect(await readPendingActionDecision(stub)).toBeNull()
    const committed = await readRoomHistory(stub)
    expect(
      committed.commands.slice(before.commands.length).map((entry) => entry.commandType)
    ).toEqual(['RESOLVE_ACTION'])
    const { roots, children } = areaReceipts(committed)
    expect(roots).toHaveLength(1)
    expect(roots[0]?.outputs).toMatchObject({ sourceActorId: CASTER_ID, removedActorIds: [] })
    expect(children).toHaveLength(2)
    const damageTaken = (id: string) =>
      (hitPointsOf(before, id) ?? Number.NaN) - (hitPointsOf(committed, id) ?? Number.NaN)
    expect(damageTaken(FIRST_ID)).toBe(10)
    expect(damageTaken(SECOND_ID)).toBe(0)
    expect(damageTaken(THIRD_ID)).toBe(0)
    expect(damageTaken(FAR_ID)).toBe(0)
    expect(damageTaken(CASTER_ID)).toBe(0)

    // 4. The GM's undo reverts every target and the caster's spend.
    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(vitalsOf(await readRoomHistory(stub))).toEqual(vitalsOf(before))
  })
})

describe('room refusals of the wrong target for a radius centered on the caster', () => {
  const refused = (answer: { type: string }) =>
    expect(answer).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'TARGET_UNAVAILABLE' })

  it('refuses a point for it', async () => {
    const room = await centeredRoom(casterCenteredAreaWolf(TEN_FOOT_SPHERE))
    refused((await room.startAreaAction({ x: 350, y: 150 })).answer)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
  })

  it('refuses a direction for it', async () => {
    const room = await centeredRoom(casterCenteredAreaWolf(TEN_FOOT_SPHERE))
    refused((await room.startDirectedAreaAction({ x: 200, y: 150 }, { x: 500, y: 150 })).answer)
  })

  it('refuses a creature target for it', async () => {
    const room = await centeredRoom(casterCenteredAreaWolf(TEN_FOOT_SPHERE))
    expect((await room.startAction(FIRST_ID)).answer).toMatchObject({ type: 'COMMAND_REJECTED' })
  })

  it.each([
    ['a point area', fireballWolf()],
    ['a directed area', directedAreaWolf({ shapeKind: 'CONE', length: feet(15) })]
  ])('refuses a centered command for %s', async (_name, creature) => {
    const room = await centeredRoom(creature)
    refused((await room.startCasterCenteredAreaAction()).answer)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
  })

  it('refuses whole an area whose failed save leaves a condition, spending and changing nothing', async () => {
    const room = await centeredRoom(frightenOnFailedSave(casterCenteredAreaWolf(TEN_FOOT_SPHERE)))
    const before = await readRoomHistory(room.room.base.stub)
    refused((await room.startCasterCenteredAreaAction()).answer)
    expect(await readRoomHistory(room.room.base.stub)).toEqual(before)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
  })
})
