import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { caltropsBagOf20 } from '@artificer-toolkit/source-data/srd/equipment/caltrops-bag-of-20.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { hitPointsOf, readZones, revertLastAction, walkerMoves } from './placedZoneRoomReads.js'

/**
 * SPELLS-20 T1 (D133): a placed zone whose failed entry save deals dice damage rolls those dice
 * through the same roll request every other authored die uses. Caltrops, authored with 1d4 piercing
 * where the SRD authors 1, is the fixture: the real compile, plan, commit and entry path run on it.
 */

const SPREADER_ACTOR_ID = testUuid(0x2000)
const SPREADER_ID = testUuid(0x2001)
const WALKER_ID = testUuid(0x2002)

const FIELD_POINT = { x: 250, y: 150 }
const WALKER_START = { x: 450, y: 150 }
const WALK_INTO = [WALKER_START, FIELD_POINT]

/** Every die the room rolls shows this face (zero-based), so the save is a 4 against DC 15 and the d4 a 4. */
const DIE = 3
const ROLLED_DAMAGE = DIE + 1

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** The authored tree with every damage outcome turned into 1d4: only the damage value differs from the SRD item. */
function withDiceDamage(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(withDiceDamage)
  if (typeof node !== 'object' || node === null) return node
  const entries = Object.entries(node).filter(([key]) => key !== 'amount')
  const mapped = Object.fromEntries(
    entries.map(([key, value]) => [key, withDiceDamage(value)])
  ) as Record<string, unknown>
  return mapped.effectKind === 'DAMAGE'
    ? { ...mapped, valueKind: 'DICE', diceConfig: '1d4' }
    : mapped
}

const diceCaltrops = withDiceDamage(caltropsBagOf20) as EquipmentAuthored

const walkerActor = srdCreatureActor({ id: WALKER_ID, creature: plainWolf })

function diceRoom(
  autoRoll: Parameters<typeof actionRoom>[0]['autoRoll'],
  seating: Pick<
    Parameters<typeof actionRoom>[0],
    'playerControlledActorIds' | 'otherPlayerControlledActorIds'
  > = {}
) {
  return actionRoom({
    ...seating,
    actors: [
      {
        ...characterActor({ id: SPREADER_ACTOR_ID, characterId: SPREADER_ID }),
        snapshot: { kind: 'CHARACTER', id: SPREADER_ID, systemId: srdSystemRecord.id }
      },
      walkerActor
    ],
    positions: { [WALKER_ID]: WALKER_START },
    characterEquipment: [diceCaltrops],
    characterAction: (action) => action.label === diceCaltrops.label,
    autoRoll,
    fallbackRoll: DIE
  })
}

type Room = Awaited<ReturnType<typeof diceRoom>>

async function spreadAndEnter(room: Room) {
  const { answer } = await room.startAreaAction(FIELD_POINT)
  expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
  await room.advanceTurn()
  const hitPointsBefore = await hitPointsOf(room, WALKER_ID)
  return { hitPointsBefore, walk: await walkerMoves(room, WALK_INTO) }
}

describe('a placed zone that deals dice damage (SPELLS-20 T1)', () => {
  it('stores the zone: dice damage is a placeable zone outcome', async () => {
    const room = await diceRoom('EVERYONE')
    const { answer } = await room.startAreaAction(FIELD_POINT)

    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await readZones(room)).toHaveLength(1)
  })

  it('rolls the authored dice for a creature that fails the entry save and applies the rolled total', async () => {
    const room = await diceRoom('EVERYONE')

    const { hitPointsBefore, walk } = await spreadAndEnter(room)

    expect(walk.executions).toHaveLength(1)
    expect(walk.executions[0]).toMatchObject({
      execution: { movementInterruption: { kind: 'STOP' } },
      applications: [expect.objectContaining({ kind: 'DAMAGE', appliedAmount: ROLLED_DAMAGE })]
    })
    expect(await hitPointsOf(room, WALKER_ID)).toBe((hitPointsBefore ?? 0) - ROLLED_DAMAGE)
  })

  it('restores the hit points when the GM takes the entry back', async () => {
    const room = await diceRoom('EVERYONE')
    const { hitPointsBefore } = await spreadAndEnter(room)
    expect(await hitPointsOf(room, WALKER_ID)).toBe((hitPointsBefore ?? 0) - ROLLED_DAMAGE)

    await revertLastAction(room)

    expect(await hitPointsOf(room, WALKER_ID)).toBe(hitPointsBefore)
    expect(await readZones(room)).toHaveLength(1)
  })
})

describe('a placed zone whose damage dice the source controller rolls (SPELLS-20 T1, D133)', () => {
  /** The wolf's save auto-rolls for the GM; the spreader's player owns the zone, so owns the damage dice. */
  const playerSpreads = { playerControlledActorIds: [SPREADER_ACTOR_ID] }

  async function walkIntoPromptedZone(room: Room) {
    const { answer } = await room.startAreaAction(FIELD_POINT)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    await room.advanceTurn()
    const hitPointsBefore = await hitPointsOf(room, WALKER_ID)
    const walked = await room.room.move(
      WALK_INTO,
      await room.version(),
      room.room.scene.version,
      room.room.scene.tokens[1]!.id
    )
    expect(walked.type, JSON.stringify(walked)).toBe('COMMAND_COMMITTED')
    return hitPointsBefore
  }

  it('asks the source controller, not the GM-controlled creature, for the dice', async () => {
    const room = await diceRoom('GAME_MASTER', playerSpreads)
    await walkIntoPromptedZone(room)

    expect(await room.room.pendingFor(true)).toMatchObject({
      kind: 'ACTION_OUTCOME_EVIDENCE',
      rollerActorId: SPREADER_ACTOR_ID,
      request: { min: 1, max: 4 },
      allowedResponses: ['ENTER_INTEGER', 'SYSTEM_ROLL']
    })
  })

  it('applies the die the player enters and settles the stop', async () => {
    const room = await diceRoom('GAME_MASTER', playerSpreads)
    const hitPointsBefore = await walkIntoPromptedZone(room)
    const prompt = await room.room.pendingFor(true)
    if (prompt?.kind !== 'ACTION_OUTCOME_EVIDENCE') throw new Error('Expected the damage die.')
    expect(await hitPointsOf(room, WALKER_ID)).toBe(hitPointsBefore)

    const answered = await (
      await room.room.asPlayer()
    ).respond({ kind: 'ENTER_INTEGER', requestId: prompt.request.requestId, value: 2 })

    expect(answered.type, JSON.stringify(answered)).toBe('COMMAND_COMMITTED')
    expect(await room.room.pending()).toBeNull()
    expect(await hitPointsOf(room, WALKER_ID)).toBe((hitPointsBefore ?? 0) - 2)
    // Only the wolf's save drew a die: the entered damage die was never rolled.
    expect(room.room.diceDrawn()).toBe(1)
  })

  it('rolls the die for the player on a system roll', async () => {
    const room = await diceRoom('GAME_MASTER', playerSpreads)
    const hitPointsBefore = await walkIntoPromptedZone(room)
    const prompt = await room.room.pendingFor(true)
    if (prompt?.kind !== 'ACTION_OUTCOME_EVIDENCE') throw new Error('Expected the damage die.')

    await (
      await room.room.asPlayer()
    ).respond({ kind: 'SYSTEM_ROLL', requestId: prompt.request.requestId })

    expect(await hitPointsOf(room, WALKER_ID)).toBe((hitPointsBefore ?? 0) - ROLLED_DAMAGE)
    expect(room.room.diceDrawn()).toBe(2)
  })

  it('lets the GM answer for the player and restores the hit points on undo without rerolling', async () => {
    const room = await diceRoom('GAME_MASTER', playerSpreads)
    const hitPointsBefore = await walkIntoPromptedZone(room)
    const prompt = await room.room.pendingFor(true)
    if (prompt?.kind !== 'ACTION_OUTCOME_EVIDENCE') throw new Error('Expected the damage die.')

    const answered = await room.room.respond({
      kind: 'ENTER_INTEGER',
      requestId: prompt.request.requestId,
      value: 1
    })
    expect(answered.type, JSON.stringify(answered)).toBe('COMMAND_COMMITTED')
    expect(await hitPointsOf(room, WALKER_ID)).toBe((hitPointsBefore ?? 0) - 1)

    await revertLastAction(room)

    expect(await hitPointsOf(room, WALKER_ID)).toBe(hitPointsBefore)
    expect(room.room.diceDrawn()).toBe(1)
  })

  it('refuses the answer of a player who does not control the zone source', async () => {
    const room = await diceRoom('GAME_MASTER', {
      ...playerSpreads,
      otherPlayerControlledActorIds: []
    })
    await walkIntoPromptedZone(room)
    const prompt = await room.room.pendingFor(true)
    if (prompt?.kind !== 'ACTION_OUTCOME_EVIDENCE') throw new Error('Expected the damage die.')

    const refused = await (
      await room.room.asPlayer('OTHER_PLAYER')
    ).respond({ kind: 'ENTER_INTEGER', requestId: prompt.request.requestId, value: 4 })

    expect(refused.type).toBe('COMMAND_REJECTED')
    expect(await room.room.pending()).not.toBeNull()
  })
})
