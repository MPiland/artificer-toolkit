import {
  creatureFeature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { SRD_ATHLETICS_SKILL_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import type { ScenePoint } from '@artificer-toolkit/shared/vtt'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, biteWolf } from './actionRoomFixture.js'
import { tokenPositions } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { parseReceiptExecution, readRoomHistory } from './roomHistoryReads.js'

/**
 * MOVE-4.3 (MOVE-4.T3a): the creature a climber clings to can dislodge it with the cling's authored
 * contest, its Athletics against the climber's Athletics or Acrobatics. A win ends the cling and drops
 * the climber 5 feet away, on the square the dislodger picks when several are free (D157).
 */

const CLIMBER_ID = testUuid(0xea0)
const MOUNT_ID = testUuid(0xea1)
const CLIMBER_START: ScenePoint = { x: 150, y: 150 }
const MOUNT_START: ScenePoint = { x: 350, y: 150 }
/** Each Scene square is 100 units: 5 feet. */
const SQUARE = 100

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const committed = (answer: { type: string }) =>
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

/**
 * A Small FRIENDLY Wolf that climbs a Large HOSTILE Wolf (20 against 1), then the mount's dislodge
 * contest rolls `mountFace` against the climber's `climberFace`.
 */
async function clingRoom(mountFace: number, climberFace: number) {
  const climber = { ...biteWolf('ATTACK'), size: 'SMALL' as const }
  return actionRoom({
    autoRoll: 'BOTH',
    rolls: [19, 0, mountFace - 1, climberFace - 1],
    actors: [
      srdCreatureActor({ id: CLIMBER_ID, creature: climber, disposition: 'FRIENDLY' }),
      srdCreatureActor({ id: MOUNT_ID, creature: { ...plainWolf, size: 'LARGE' } })
    ],
    positions: { [CLIMBER_ID]: CLIMBER_START, [MOUNT_ID]: MOUNT_START },
    optionalCombatKinds: ['CLIMB_ONTO_LARGER_CREATURE'],
    ownerFeatureId: creatureFeature(climber, 'Bite').id
  })
}

type ClingRoom = Awaited<ReturnType<typeof clingRoom>>

/** The climber climbs onto the mount, then the turn passes to the mount; the cling's ID. */
async function clinging(room: ClingRoom) {
  await room.room.move([CLIMBER_START, { x: 750, y: 150 }])
  const pending = await room.room.pending()
  if (pending?.context.kind !== 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE')
    throw new Error(`Expected a passage choice, got ${pending?.context.kind}.`)
  const climb = pending.context.options.find(
    (option) => option.ruleKind === 'CLIMB_ONTO_LARGER_CREATURE'
  )
  if (!climb) throw new Error('The climb option is missing.')
  committed(await room.room.respond({ kind: 'PASSAGE_OPTION', optionId: climb.optionId }))
  expect(tokenPositions(room)(CLIMBER_ID)).toEqual(MOUNT_START)
  await room.advanceTurn()
  const [cling] = await mountEffects(room)
  if (!cling) throw new Error('Expected the cling on the mount.')
  return cling.id
}

async function mountEffects(room: ClingRoom) {
  const history = await readRoomHistory(room.room.base.stub)
  return history.activeEffects.filter(({ targetActorId }) => targetActorId === MOUNT_ID)
}

/** The mount, on its own turn, tries to shake the climber off with its Athletics. */
async function dislodge(room: ClingRoom, activeEffectId: string) {
  return room.send({
    type: 'ESCAPE',
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version(),
    actorId: MOUNT_ID,
    activeEffectId,
    checkDefinitionId: SRD_ATHLETICS_SKILL_ID,
    acknowledgedWarnings: []
  })
}

/** The contested escape's settled output, from the ESCAPE command's receipt. */
async function dislodgeOutput(room: ClingRoom) {
  const history = await readRoomHistory(room.room.base.stub)
  return history.receipts.flatMap((receipt) => {
    if (receipt.commandType !== 'ESCAPE') return []
    const execution = parseReceiptExecution(receipt)
    return execution.status === 'COMPLETE' &&
      execution.applicationOutputs?.kind === 'CONTESTED_ACTION'
      ? [execution.applicationOutputs]
      : []
  })
}

describe('dislodging a clinging climber (MOVE-4.3), in the room', () => {
  it('ends the cling on a won contest and lands the climber on the free square the mount picks', async () => {
    const room = await clingRoom(20, 1)
    const clingId = await clinging(room)

    committed(await dislodge(room, clingId))
    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'FORCED_MOVEMENT_DESTINATION')
      throw new Error(`Expected the landing pick, got ${decision.pending.kind}.`)
    const { pending } = decision
    // The mount pushes the climber; the GM answers for the HOSTILE mount.
    expect(pending).toMatchObject({ sourceActorId: MOUNT_ID, targetActorId: CLIMBER_ID })
    expect(pending.positions.length).toBeGreaterThan(1)
    // Every offered square is exactly 5 feet from where the climber clings.
    for (const position of pending.positions)
      expect(
        Math.max(Math.abs(position.x - MOUNT_START.x), Math.abs(position.y - MOUNT_START.y))
      ).toBe(SQUARE)
    // The cling stands until the pick lands the climber.
    expect((await mountEffects(room)).map(({ id }) => id)).toEqual([clingId])
    expect(tokenPositions(room)(CLIMBER_ID)).toEqual(MOUNT_START)

    const landing = pending.positions.at(-1)!
    committed(
      await room.resolve(decision, {
        kind: 'FORCED_MOVEMENT',
        requestId: pending.requestId,
        position: landing
      })
    )
    expect(await room.room.pending()).toBeNull()
    expect(tokenPositions(room)(CLIMBER_ID)).toEqual(landing)
    expect(tokenPositions(room)(MOUNT_ID)).toEqual(MOUNT_START)
    expect(await mountEffects(room)).toEqual([])
    expect(await dislodgeOutput(room)).toMatchObject([
      {
        sourceActorId: MOUNT_ID,
        targetActorId: CLIMBER_ID,
        sourceRoll: { selectedNatural: 20 },
        targetRoll: { selectedNatural: 1 },
        outcome: 'SOURCE_WIN',
        stateTransition: { kind: 'RELATIONSHIP_ENDED', endedEffectId: clingId }
      }
    ])
  }, 60_000)

  it('keeps the cling and the climber in place on a lost contest', async () => {
    const room = await clingRoom(1, 20)
    const clingId = await clinging(room)

    committed(await dislodge(room, clingId))
    expect(await room.room.pending()).toBeNull()
    expect(tokenPositions(room)(CLIMBER_ID)).toEqual(MOUNT_START)
    expect((await mountEffects(room)).map(({ id }) => id)).toEqual([clingId])
    expect(await dislodgeOutput(room)).toMatchObject([
      { outcome: 'TARGET_WIN_OR_TIE', stateTransition: { kind: 'NONE' } }
    ])
  }, 60_000)
})
