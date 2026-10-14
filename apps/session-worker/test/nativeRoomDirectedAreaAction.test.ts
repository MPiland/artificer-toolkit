import { srdCreatureActor } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { blackDragonWyrmling } from '@artificer-toolkit/source-data/srd/creatures/black-dragon-wyrmling.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, directedAreaWolf, fireballWolf } from './actionRoomFixture.js'
import { areaReceipts, vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readPendingActionDecision, readRoomHistory, type RoomHistory } from './roomHistoryReads.js'

const CASTER_ID = testUuid(0x900)
const FIRST_ID = testUuid(0x901)
const SECOND_ID = testUuid(0x902)
const THIRD_ID = testUuid(0x903)
const FAR_ID = testUuid(0x904)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const feet = (amount: number) => ({ amount, unit: 'FEET' as const })

/**
 * The caster at (150, 150) and Wolves in the cells east of it at x = 250, 350 and 450, all on its
 * row, with a fourth well off that row. A token is 100 px, a cell 5 feet.
 */
function directedRoom(creature: ReturnType<typeof directedAreaWolf>, featureId?: string) {
  return actionRoom({
    rolls: [1, 1, 1, 1, 1],
    actors: [
      srdCreatureActor({ id: CASTER_ID, creature }),
      ...[FIRST_ID, SECOND_ID, THIRD_ID, FAR_ID].map((id) =>
        srdCreatureActor({ id, creature: plainWolf })
      )
    ],
    positions: { [FAR_ID]: { x: 450, y: 650 } },
    ownerFeatureId: featureId ?? creature.features?.find((feature) => feature.label === 'Bite')?.id
  })
}
type Room = Awaited<ReturnType<typeof directedRoom>>

/** The origin on the east edge of the caster's token, and a point east of it. */
const EAST = { origin: { x: 200, y: 150 }, toward: { x: 500, y: 150 } }

const hitPointsOf = (history: RoomHistory, id: string) =>
  vitalsOf(history).find((vitals) => vitals.id === id)?.currentHitPoints

async function pendingSaves(room: Room) {
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
  return decision.pending.saves.map(({ actorId }) => actorId).sort()
}

describe('room cube from the side of the caster’s space', () => {
  it('catches the creatures in the cube and never the caster it extends from', async () => {
    const room = await directedRoom(directedAreaWolf({ shapeKind: 'CUBE', edgeLength: feet(15) }))
    const { answer } = await room.startDirectedAreaAction(EAST.origin, EAST.toward)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    // The cube spans x 200..500: the three Wolves on the row, not the caster, not the far Wolf.
    expect(await pendingSaves(room)).toEqual([FIRST_ID, SECOND_ID, THIRD_ID].sort())
  })

  it('extends from the side the player chose', async () => {
    const room = await directedRoom(directedAreaWolf({ shapeKind: 'CUBE', edgeLength: feet(15) }))
    // Westward, the cube holds nobody, so the action commits as the caster's spend alone.
    const { answer } = await room.startDirectedAreaAction({ x: 100, y: 150 }, { x: -200, y: 150 })
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
  })

  it('offers the action as a direction with its authored cube', async () => {
    const room = await directedRoom(directedAreaWolf({ shapeKind: 'CUBE', edgeLength: feet(15) }))
    expect((await room.actionChoices()).actions.map(({ target }) => target)).toEqual([
      { kind: 'DIRECTED', area: { kind: 'CUBE_FROM_SIDE', edgeLength: feet(15) } }
    ])
  })
})

describe('room cone and line', () => {
  it('catches the Wolves a 15 ft cone touches and not the one off its row', async () => {
    const room = await directedRoom(directedAreaWolf({ shapeKind: 'CONE', length: feet(15) }))
    expect((await room.startDirectedAreaAction(EAST.origin, EAST.toward)).answer.type).toBe(
      'COMMAND_COMMITTED'
    )
    expect(await pendingSaves(room)).toEqual([FIRST_ID, SECOND_ID, THIRD_ID].sort())
  })

  it('catches only the Wolves a 10 ft line touches', async () => {
    const room = await directedRoom(
      directedAreaWolf({ shapeKind: 'LINE', length: feet(10), width: feet(5) })
    )
    expect((await room.startDirectedAreaAction(EAST.origin, EAST.toward)).answer.type).toBe(
      'COMMAND_COMMITTED'
    )
    expect(await pendingSaves(room)).toEqual([FIRST_ID, SECOND_ID].sort())
  })

  it('offers the cone and the line as a direction with their authored sizes', async () => {
    const cone = await directedRoom(directedAreaWolf({ shapeKind: 'CONE', length: feet(15) }))
    expect((await cone.actionChoices()).actions.map(({ target }) => target)).toEqual([
      { kind: 'DIRECTED', area: { kind: 'CONE', length: feet(15) } }
    ])
    const line = await directedRoom(
      directedAreaWolf({ shapeKind: 'LINE', length: feet(100), width: feet(5) })
    )
    expect((await line.actionChoices()).actions.map(({ target }) => target)).toEqual([
      { kind: 'DIRECTED', area: { kind: 'LINE', length: feet(100), width: feet(5) } }
    ])
  })

  it('commits a directed area that catches nobody as the caster’s spend alone', async () => {
    const room = await directedRoom(directedAreaWolf({ shapeKind: 'CONE', length: feet(15) }))
    const { command, answer } = await room.startDirectedAreaAction(
      { x: 150, y: 200 },
      { x: 150, y: 500 }
    )
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
    const { roots } = areaReceipts(await readRoomHistory(room.room.base.stub))
    expect(roots.map(({ receipt }) => receipt.commandId)).toEqual([command.commandId])
  })
})

describe('room refusals of the wrong target for an area', () => {
  const refused = (answer: { type: string }) =>
    expect(answer).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'TARGET_UNAVAILABLE' })

  it('refuses a direction for a point area', async () => {
    const room = await actionRoom({
      actors: [
        srdCreatureActor({ id: CASTER_ID, creature: fireballWolf() }),
        srdCreatureActor({ id: FIRST_ID, creature: plainWolf })
      ],
      ownerFeatureId: fireballWolf().features?.find((feature) => feature.label === 'Bite')?.id
    })
    refused((await room.startDirectedAreaAction(EAST.origin, EAST.toward)).answer)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
  })

  it.each([
    ['a cone', { shapeKind: 'CONE', length: feet(15) }],
    ['a line', { shapeKind: 'LINE', length: feet(30), width: feet(5) }],
    ['a Self cube', { shapeKind: 'CUBE', edgeLength: feet(15) }]
  ] as const)('refuses a point for %s', async (_name, shape) => {
    const room = await directedRoom(directedAreaWolf(shape))
    refused((await room.startAreaAction({ x: 350, y: 150 })).answer)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
  })

  it.each([
    ['away from the token', { x: 300, y: 150 }],
    ['just off the token’s edge', { x: 201, y: 150 }],
    ['inside the token', { x: 150, y: 150 }]
  ])('refuses an origin %s', async (_name, origin) => {
    const room = await directedRoom(directedAreaWolf({ shapeKind: 'CONE', length: feet(15) }))
    refused((await room.startDirectedAreaAction(origin, { x: 500, y: 150 })).answer)
    expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
  })

  it('refuses a direction that points nowhere', async () => {
    const room = await directedRoom(directedAreaWolf({ shapeKind: 'CONE', length: feet(15) }))
    refused((await room.startDirectedAreaAction(EAST.origin, EAST.origin)).answer)
  })

  it('refuses a creature target for a directed area', async () => {
    const room = await directedRoom(directedAreaWolf({ shapeKind: 'CONE', length: feet(15) }))
    expect((await room.startAction(FIRST_ID)).answer).toMatchObject({ type: 'COMMAND_REJECTED' })
  })
})

describe('dragon breath journey', () => {
  /** The SRD Black Dragon Wyrmling's Acid Breath (DC 11 Dexterity, half on a success) as a Self 15 ft cone. */
  function breathingWolf() {
    const breath = blackDragonWyrmling.features?.find(({ label }) =>
      label.startsWith('Acid Breath')
    )
    if (!breath) throw new Error('The SRD Acid Breath action is missing.')
    const creature = creatureAuthoredDtoSchema.parse({
      ...plainWolf,
      features: [
        ...(plainWolf.features ?? []),
        {
          ...breath,
          effects: breath.effects?.map((effect) => {
            if (effect.invocation.kind !== 'ACTION') throw new Error('Expected an action.')
            return {
              ...effect,
              invocation: {
                ...effect.invocation,
                range: { id: effect.invocation.range.id, rangeKind: 'SELF' as const },
                targeting: {
                  selectionKind: 'AREA_CONTENTS' as const,
                  dispositionKind: 'ANY' as const
                },
                shape: {
                  id: '00000000-0000-4000-8000-000000000c98',
                  shapeKind: 'CONE' as const,
                  length: feet(15)
                }
              }
            }
          })
        }
      ]
    })
    return { creature, featureId: breath.id }
  }

  it('catches the Wolves in the cone, rolls their saves, deals full and half damage once, and the GM undoes it', async () => {
    const { creature, featureId } = breathingWolf()
    const room = await directedRoom(creature, featureId)
    const stub = room.room.base.stub
    const before = await readRoomHistory(stub)

    // 1. The GM breathes east: the three Wolves in the cone are caught, the caster and the Wolf
    // off the row are not.
    const started = await room.startDirectedAreaAction(EAST.origin, EAST.toward)
    expect(started.answer.type, JSON.stringify(started.answer)).toBe('COMMAND_COMMITTED')
    expect(await pendingSaves(room)).toEqual([FIRST_ID, SECOND_ID, THIRD_ID].sort())
    // The GM takes the third out, leaving two saves.
    const removed = await room.send(
      room.removeAreaTargetCommand(await room.pendingDecision(), THIRD_ID)
    )
    expect(removed.type, JSON.stringify(removed)).toBe('COMMAND_COMMITTED')
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

    // 3. The last answer commits the area once: full damage on the failure, half on the success.
    expect(await readPendingActionDecision(stub)).toBeNull()
    const committed = await readRoomHistory(stub)
    expect(
      committed.commands.slice(before.commands.length).map((entry) => entry.commandType)
    ).toEqual(['RESOLVE_ACTION'])
    const { roots, children } = areaReceipts(committed)
    expect(roots).toHaveLength(1)
    expect(roots[0]?.outputs).toMatchObject({
      sourceActorId: CASTER_ID,
      removedActorIds: [THIRD_ID]
    })
    expect(children).toHaveLength(2)
    const damageTaken = (id: string) =>
      (hitPointsOf(before, id) ?? Number.NaN) - (hitPointsOf(committed, id) ?? Number.NaN)
    expect(damageTaken(FIRST_ID)).toBe(10)
    expect(damageTaken(SECOND_ID)).toBe(5)
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
