import {
  installedSrdCreature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { gorgon } from '@artificer-toolkit/source-data/srd/creatures/gorgon.js'
import { SRD_CONDITION_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { areaReceipts, vitalsOf } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  readActorConditionIds,
  readPendingActionDecision,
  readRoomHistory
} from './roomHistoryReads.js'

/**
 * SPELLS-19.T3c: the unmodified SRD Gorgon's Petrifying Breath. Each creature whose save fails is
 * Restrained and repeats the save at the end of its next turn: a pass frees it, a fail petrifies it
 * (the printed escalation), unless it cannot be petrified.
 */

const BREATHER_ID = testUuid(0xd00)
const FIRST_ID = testUuid(0xd01)
const SECOND_ID = testUuid(0xd02)
const THIRD_ID = testUuid(0xd03)

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const conditionId = (code: string) => {
  const condition = SRD_CONDITION_TYPES.find((candidate) => candidate.code === code)
  if (!condition) throw new Error(`The SRD has no ${code} condition.`)
  return condition.id
}

/** The Gorgon at (150, 150) and the given creatures in the cells east of it, inside a 30 ft cone. */
async function breathRoom(
  caught: readonly { id: string; creature: Parameters<typeof srdCreatureActor>[0]['creature'] }[],
  dice: { rolls: readonly number[]; fallbackRoll: number }
) {
  const creature = installedSrdCreature(gorgon)
  const feature = creature.features?.find(({ label }) => label.startsWith('Petrifying Breath'))
  const effect = feature?.effects?.[0]
  if (!feature || !effect) throw new Error('The Gorgon has no Petrifying Breath.')
  return actionRoom({
    autoRoll: 'GAME_MASTER',
    ...dice,
    actors: [
      srdCreatureActor({ id: BREATHER_ID, creature }),
      ...caught.map(({ id, creature: caughtCreature }) =>
        srdCreatureActor({ id, creature: caughtCreature })
      )
    ],
    ownerFeatureId: feature.id,
    effectId: effect.id
  })
}

type BreathRoom = Awaited<ReturnType<typeof breathRoom>>

/** The origin on the east edge of the breather's token, and a point east of it. */
const EAST = { origin: { x: 200, y: 150 }, toward: { x: 500, y: 150 } }

async function breathe(room: BreathRoom) {
  const started = await room.startDirectedAreaAction(EAST.origin, EAST.toward)
  expect(started.answer.type, JSON.stringify(started.answer)).toBe('COMMAND_COMMITTED')
  expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
}

// Zero-based dice: 0 is a natural 1 and 19 a natural 20. The Wolves' Constitution saves are DC 13.
describe('an unmodified SRD Gorgon restrains with Petrifying Breath, then petrifies', () => {
  const wolves = [FIRST_ID, SECOND_ID, THIRD_ID].map((id) => ({ id, creature: plainWolf }))

  it('is offered instead of listed unavailable', async () => {
    const room = await breathRoom(wolves, { rolls: [0, 19, 0], fallbackRoll: 0 })
    const choices = await room.actionChoices()
    expect(choices.actions.map(({ id }) => id)).toContain(room.actionId)
    expect(choices.unavailableActions.map(({ id }) => id)).not.toContain(room.actionId)
  })

  it('restrains each creature that fails, with one effect that lasts to its next turn end', async () => {
    const room = await breathRoom(wolves, { rolls: [0, 19, 0], fallbackRoll: 0 })
    const stub = room.room.base.stub
    const before = await readRoomHistory(stub)
    await breathe(room)

    const committed = await readRoomHistory(stub)
    expect(
      committed.commands.slice(before.commands.length).map((entry) => entry.commandType)
    ).toEqual(['RESOLVE_ACTION'])
    const { roots, children } = areaReceipts(committed)
    expect(roots).toHaveLength(1)
    expect(children).toHaveLength(3)
    expect(
      [FIRST_ID, SECOND_ID, THIRD_ID].filter((id) =>
        readActorConditionIds(committed, id).includes(conditionId('RESTRAINED'))
      )
    ).toEqual([FIRST_ID, THIRD_ID])
    expect(committed.activeEffects.map(({ targetActorId }) => targetActorId).sort()).toEqual(
      [FIRST_ID, THIRD_ID].sort()
    )
    for (const effect of committed.activeEffects) {
      const { recurrence, frozenGraphNodeId } = JSON.parse(effect.definitionJson)
      expect(recurrence.expiration).toMatchObject({ kind: 'TICKS', initialRemaining: 1 })
      expect(recurrence.recurrenceStage).toBe('END_OF_TURN')
      expect(frozenGraphNodeId).toBe('repeat-save-test')
    }
  })

  it('takes the condition and every effect back with the GM’s one undo', async () => {
    const room = await breathRoom(wolves, { rolls: [0, 19, 0], fallbackRoll: 0 })
    const stub = room.room.base.stub
    const before = await readRoomHistory(stub)
    await breathe(room)

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')

    const reverted = await readRoomHistory(stub)
    expect(reverted.activeEffects).toEqual([])
    expect(vitalsOf(reverted)).toEqual(vitalsOf(before))
  })

  describe("at the end of its holder's next turn, the repeat Constitution save", () => {
    /** The breath, then the Gorgon's turn and the first Wolf's turn end; every later die is `turnSaveDie`. */
    async function breatheThenEndTwoTurns(turnSaveDie: number) {
      const room = await breathRoom(wolves, { rolls: [0, 19, 0], fallbackRoll: turnSaveDie })
      await breathe(room)
      await room.advanceTurn()
      await room.advanceTurn()
      return readRoomHistory(room.room.base.stub)
    }

    it('frees a creature that passes, leaving the other one restrained', async () => {
      const history = await breatheThenEndTwoTurns(19)
      expect(readActorConditionIds(history, FIRST_ID)).toEqual([])
      expect(readActorConditionIds(history, THIRD_ID)).toEqual([conditionId('RESTRAINED')])
      expect(history.activeEffects.map(({ targetActorId }) => targetActorId)).toEqual([THIRD_ID])
    })

    it('petrifies a creature that fails, in place of the restraint, and ends its effect', async () => {
      const history = await breatheThenEndTwoTurns(0)
      expect(readActorConditionIds(history, FIRST_ID)).toEqual([conditionId('PETRIFIED')])
      expect(readActorConditionIds(history, THIRD_ID)).toEqual([conditionId('RESTRAINED')])
      expect(history.activeEffects.map(({ targetActorId }) => targetActorId)).toEqual([THIRD_ID])
    })
  })

  it('leaves a creature that cannot be petrified free of the restraint and not petrified', async () => {
    const room = await breathRoom(
      [
        { id: FIRST_ID, creature: plainWolf },
        { id: SECOND_ID, creature: installedSrdCreature(gorgon) }
      ],
      { rolls: [0, 0], fallbackRoll: 0 }
    )
    await breathe(room)
    await room.advanceTurn()
    await room.advanceTurn()
    await room.advanceTurn()
    const history = await readRoomHistory(room.room.base.stub)
    expect(readActorConditionIds(history, FIRST_ID)).toEqual([conditionId('PETRIFIED')])
    expect(readActorConditionIds(history, SECOND_ID)).toEqual([])
    expect(history.activeEffects).toEqual([])
  })
})
