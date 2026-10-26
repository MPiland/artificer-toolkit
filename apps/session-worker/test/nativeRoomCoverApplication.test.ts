import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf, fireballWolf } from './actionRoomFixture.js'
import { answerAllSaves, areaReceipts } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { parseReceiptExecution, readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-14.T2: with automatic cover on, the tier the live Scene gives a target is folded into the
 * d20 test: the attack's target AC, a save's modifier. Total cover refuses the target or drops it
 * from an area's caught set. The room, not a fixture, measures the cover.
 */

const SOURCE_ID = testUuid(0xe01)
const BLOCKER_ID = testUuid(0xe02)
const TARGET_ID = testUuid(0xe03)
const WALLED_ID = testUuid(0xe04)
const CASTER_ID = testUuid(0xe10)
const AREA_IDS = [testUuid(0xe11), testUuid(0xe12), testUuid(0xe13)]

const HALF_COVER = { label: 'Half cover', amount: 2 }
const wallAt = (x: number, id: number) => ({
  a: { x, y: 0 },
  b: { x, y: 800 },
  blocksLight: true,
  blocksMovement: true,
  id: testUuid(id),
  kind: 'WALL' as const
})

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** The Wolf's Bite attacks at +4; the blocker stands in the line to the target, the wall hides the fourth wolf. */
function attackRoom(automaticCover: boolean) {
  const attacker = biteWolf('ATTACK', { reachFeet: 150 })
  return actionRoom({
    automaticCover,
    autoRoll: 'GAME_MASTER',
    // The attack die shows 9: 9 + 4 = 13 meets the Wolf's AC 13, but not the AC 15 of half cover.
    rolls: [8],
    actors: [
      srdCreatureActor({ id: SOURCE_ID, creature: attacker }),
      ...[BLOCKER_ID, TARGET_ID, WALLED_ID].map((id) =>
        srdCreatureActor({ id, creature: plainWolf })
      )
    ],
    ownerFeatureId: creatureFeature(attacker, 'Bite').id,
    positions: {
      [SOURCE_ID]: { x: 150, y: 150 },
      [BLOCKER_ID]: { x: 350, y: 150 },
      [TARGET_ID]: { x: 550, y: 150 },
      [WALLED_ID]: { x: 550, y: 550 }
    },
    sceneOverrides: { barriers: [{ ...wallAt(450, 0xe20), a: { x: 450, y: 250 } }] }
  })
}

/** The attack at `targetId`, whose token is the room's Scene token at `index`. */
async function attackAt(
  room: Awaited<ReturnType<typeof attackRoom>>,
  targetId: string,
  index: number
) {
  const { command, answer } = await room.startAction(targetId, [], room.sceneContext(index))
  return { commandId: command.commandId, answer }
}

async function settledBatch(room: Awaited<ReturnType<typeof attackRoom>>, commandId: string) {
  const { receipts } = await readRoomHistory(room.room.base.stub)
  const receipt = receipts.find((candidate) => candidate.commandId === commandId)
  if (!receipt) throw new Error('The attack left no receipt.')
  const execution = parseReceiptExecution(receipt)
  if (
    execution.status !== 'COMPLETE' ||
    execution.applicationOutputs.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
  )
    throw new Error('Expected a settled attack.')
  return execution.applicationOutputs
}

describe('Cover applied to an attack (SPELLS-14.T2)', () => {
  it('raises the target’s AC by the half cover a creature gives, and the roll card says so', async () => {
    const room = await attackRoom(true)
    const { commandId, answer } = await attackAt(room, TARGET_ID, 2)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const { d20 } = await settledBatch(room, commandId)
    expect(d20).toMatchObject({
      total: 13,
      defenseOrDc: 15,
      resultPath: 'ON_MISS',
      foldedBonuses: [{ ...HALF_COVER, operand: 'defenseOrDc' }]
    })
  })

  it('leaves the same roll a hit against AC 13 when automatic cover is off', async () => {
    const room = await attackRoom(false)
    const { commandId, answer } = await attackAt(room, TARGET_ID, 2)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const { d20 } = await settledBatch(room, commandId)
    expect(d20).toMatchObject({ total: 13, defenseOrDc: 13, resultPath: 'ON_HIT' })
    expect(d20?.foldedBonuses).toBeUndefined()
  })

  it('refuses a target behind total cover and changes nothing', async () => {
    const room = await attackRoom(true)
    const before = await readRoomHistory(room.room.base.stub)
    const { answer } = await attackAt(room, WALLED_ID, 3)
    expect(answer.type).toBe('COMMAND_REJECTED')
    expect(JSON.stringify(answer)).toContain('total cover')
    expect(await readRoomHistory(room.room.base.stub)).toEqual(before)
  })
})

/** Three wolves in a row east of a point-sphere that catches them all, the caster in front of them. */
function areaRoom(walls: ReturnType<typeof wallAt>[] = []) {
  const caster = fireballWolf()
  return actionRoom({
    automaticCover: true,
    actors: [
      srdCreatureActor({ id: CASTER_ID, creature: caster }),
      ...AREA_IDS.map((id) => srdCreatureActor({ id, creature: plainWolf }))
    ],
    ownerFeatureId: caster.features?.find((feature) => feature.label === 'Bite')?.id,
    sceneOverrides: { barriers: walls }
  })
}

describe('Cover applied to an area’s saves (SPELLS-14.T2)', () => {
  it('adds half cover to the Dexterity save of a creature the caster and others stand in front of', async () => {
    const room = await areaRoom()
    expect((await room.startAreaAction({ x: 50, y: 150 })).answer.type).toBe('COMMAND_COMMITTED')
    await answerAllSaves(room)
    const { children } = areaReceipts(await readRoomHistory(room.room.base.stub))
    const saves = new Map(
      children.map(({ outputs }) => [outputs.targetActorId, outputs.nestedD20 ?? outputs.d20])
    )
    const uncovered = saves.get(CASTER_ID)
    const covered = saves.get(AREA_IDS[0]!)
    expect(uncovered?.foldedBonuses).toBeUndefined()
    expect(covered).toMatchObject({
      modifier: (uncovered?.modifier ?? NaN) + 2,
      defenseOrDc: uncovered?.defenseOrDc,
      foldedBonuses: [{ ...HALF_COVER, operand: 'modifier' }]
    })
  })

  it('drops a creature behind total cover from the caught set', async () => {
    const room = await areaRoom([wallAt(310, 0xe21)])
    expect((await room.startAreaAction({ x: 50, y: 150 })).answer.type).toBe('COMMAND_COMMITTED')
    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
    const saved = decision.pending.saves.map(({ actorId }) => actorId)
    expect(saved).toContain(AREA_IDS[0])
    expect(saved).not.toContain(AREA_IDS[2])
  })
})
