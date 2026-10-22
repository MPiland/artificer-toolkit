import {
  installedSrdCreature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { goldDragonWyrmling } from '@artificer-toolkit/source-data/srd/creatures/gold-dragon-wyrmling.js'
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
 * SPELLS-19.T3b: an unmodified SRD breath whose lasting effect is a set of modifier grants resolves
 * through the area: the creatures whose save fails hold one grant effect each, which repeats its
 * save every turn, in one commit the GM's undo takes back whole.
 */

const BREATHER_ID = testUuid(0xc00)
const FIRST_ID = testUuid(0xc01)
const SECOND_ID = testUuid(0xc02)
const THIRD_ID = testUuid(0xc03)
const CAUGHT_IDS = [FIRST_ID, SECOND_ID, THIRD_ID]

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** The breather at (150, 150) and Wolves in the three cells east of it, all inside a 15 ft cone. */
async function breathRoom(
  creatureAuthored: typeof goldDragonWyrmling,
  dice: { autoRoll?: 'GAME_MASTER'; rolls: readonly number[]; fallbackRoll?: number } = {
    rolls: [1, 1, 1]
  }
) {
  const creature = installedSrdCreature(creatureAuthored)
  const feature = creature.features.find(({ label }) => label.startsWith('Breath Weapons'))
  if (!feature) throw new Error(`${creature.label} has no Breath Weapons.`)
  // The one Effect of the feature that repeats a save: its lasting effect is the breath's grant.
  const effect = feature.effects?.find((candidate) =>
    candidate.paths.some(
      (path) =>
        'resultBlock' in path &&
        path.resultBlock.outcomes.some(({ effectKind }) => effectKind === 'FOLLOW_UP_SAVE')
    )
  )
  if (!effect) throw new Error(`${creature.label} Breath Weapons repeat no save.`)
  return actionRoom({
    ...dice,
    actors: [
      srdCreatureActor({ id: BREATHER_ID, creature }),
      ...CAUGHT_IDS.map((id) => srdCreatureActor({ id, creature: plainWolf }))
    ],
    ownerFeatureId: feature.id,
    effectId: effect.id
  })
}

type BreathRoom = Awaited<ReturnType<typeof breathRoom>>

/** The origin on the east edge of the breather's token, and a point east of it. */
const EAST = { origin: { x: 200, y: 150 }, toward: { x: 500, y: 150 } }

/** Answers the pending save of `actorId` with `face`. */
async function answer(room: BreathRoom, actorId: string, face: number) {
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

/** The breath aimed east, the first and third Wolves failing their saves and the second passing. */
async function breatheAndFailTwo(room: BreathRoom) {
  const started = await room.startDirectedAreaAction(EAST.origin, EAST.toward)
  expect(started.answer.type, JSON.stringify(started.answer)).toBe('COMMAND_COMMITTED')
  const decision = await room.pendingDecision()
  if (decision.pending.kind !== 'AREA_SAVES') throw new Error('Expected the area saves.')
  expect(decision.pending.saves.map(({ actorId }) => actorId).sort()).toEqual(
    [...CAUGHT_IDS].sort()
  )
  await answer(room, SECOND_ID, 20)
  await answer(room, THIRD_ID, 1)
  await answer(room, FIRST_ID, 1)
  expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
}

describe('an unmodified SRD Gold Dragon Wyrmling leaves its grants with Weakening Breath', () => {
  const creature = goldDragonWyrmling

  it('offers the breath instead of listing it unavailable', async () => {
    const room = await breathRoom(creature)
    const choices = await room.actionChoices()
    expect(choices.actions.map(({ id }) => id)).toContain(room.actionId)
    expect(choices.unavailableActions.map(({ id }) => id)).not.toContain(room.actionId)
  })

  it('holds one repeating grant effect on each creature that fails, in one commit', async () => {
    const room = await breathRoom(creature)
    const stub = room.room.base.stub
    const before = await readRoomHistory(stub)
    await breatheAndFailTwo(room)

    const committed = await readRoomHistory(stub)
    expect(
      committed.commands.slice(before.commands.length).map((entry) => entry.commandType)
    ).toEqual(['RESOLVE_ACTION'])
    const { roots, children } = areaReceipts(committed)
    expect(roots).toHaveLength(1)
    expect(children).toHaveLength(3)

    expect(committed.activeEffects.map(({ targetActorId }) => targetActorId).sort()).toEqual(
      [FIRST_ID, THIRD_ID].sort()
    )
    for (const effect of committed.activeEffects) {
      const { recurrence, frozenGraphNodeId, stateContributions } = JSON.parse(
        effect.definitionJson
      )
      expect(stateContributions.length).toBeGreaterThan(0)
      for (const contribution of stateContributions)
        expect(contribution).toMatchObject({ kind: 'MODIFIER_GRANT' })
      // Weakening Breath: disadvantage on Strength checks, Strength saves and Strength attacks.
      expect(
        stateContributions
          .flatMap(({ modifiers }: { modifiers: { valueDomainCode: string }[] }) => modifiers)
          .map(
            (modifier: {
              valueDomainCode: string
              modifierKind: string
              payload: { influence: string }
            }) =>
              [modifier.valueDomainCode, modifier.modifierKind, modifier.payload.influence].join(
                ':'
              )
          )
          .sort()
      ).toEqual([
        'ABILITY_CHECK:ROLL_INFLUENCE:DISADVANTAGE',
        'ATTACK_ROLL:ROLL_INFLUENCE:DISADVANTAGE',
        'ATTACK_ROLL:ROLL_INFLUENCE:DISADVANTAGE',
        'ATTACK_ROLL:ROLL_INFLUENCE:DISADVANTAGE',
        'SAVING_THROW_MODIFIER:ROLL_INFLUENCE:DISADVANTAGE'
      ])
      // "for 1 minute" is ten rounds, and the grant repeats its save at the end of its holder's turn.
      expect(recurrence.expiration).toMatchObject({ kind: 'TICKS', initialRemaining: 10 })
      expect(recurrence.recurrenceStage).toBe('END_OF_TURN')
      expect(frozenGraphNodeId).toBe('repeat-save-test')
    }
    // The breath leaves grants, not a condition.
    for (const id of CAUGHT_IDS) expect(readActorConditionIds(committed, id)).toEqual([])
  })

  it("takes every effect back with the GM's one undo", async () => {
    const room = await breathRoom(creature)
    const stub = room.room.base.stub
    const before = await readRoomHistory(stub)
    await breatheAndFailTwo(room)

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

  // Zero-based dice: 0 is a natural 1 and 19 a natural 20. The Wolves' Strength saves are DC 13.
  describe("at the end of its holder's turn, the grant rolls its repeating Strength save", () => {
    /** The breath, its three area saves auto-rolled (the first and third Wolves fail), then two turns end; every later die is `turnSaveDie`. */
    async function breatheThenEndTwoTurns(turnSaveDie: number) {
      const room = await breathRoom(creature, {
        autoRoll: 'GAME_MASTER',
        rolls: [0, 19, 0],
        fallbackRoll: turnSaveDie
      })
      const started = await room.startDirectedAreaAction(EAST.origin, EAST.toward)
      expect(started.answer.type, JSON.stringify(started.answer)).toBe('COMMAND_COMMITTED')
      expect(await readPendingActionDecision(room.room.base.stub)).toBeNull()
      // The breather's turn ends, then the first Wolf's: its grant's save rolls.
      await room.advanceTurn()
      await room.advanceTurn()
      return readRoomHistory(room.room.base.stub)
    }

    it("ends on a passed save, leaving the other creature's grant held", async () => {
      const history = await breatheThenEndTwoTurns(19)
      expect(history.activeEffects.map(({ targetActorId }) => targetActorId)).toEqual([THIRD_ID])
    })

    it('continues on a failed save, one round shorter', async () => {
      const history = await breatheThenEndTwoTurns(0)
      expect(
        history.activeEffects
          .map(({ targetActorId, lifecycle }) => [targetActorId, lifecycle])
          .sort()
      ).toEqual(
        [FIRST_ID, THIRD_ID]
          .map((id) => [id, { schemaVersion: 1, remainingTicks: id === FIRST_ID ? 9 : 10 }])
          .sort()
      )
    })
  })
})
