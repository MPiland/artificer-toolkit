import {
  installedSrdCreature,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { brassDragonWyrmling } from '@artificer-toolkit/source-data/srd/creatures/brass-dragon-wyrmling.js'
import { dustMephit } from '@artificer-toolkit/source-data/srd/creatures/dust-mephit.js'
import { silverDragonWyrmling } from '@artificer-toolkit/source-data/srd/creatures/silver-dragon-wyrmling.js'
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
 * SPELLS-19.T3: an unmodified SRD breath that leaves a condition resolves through the area: the
 * creatures whose save fails hold the condition and one timed effect each, in one commit the GM's
 * undo takes back whole.
 */

const BREATHER_ID = testUuid(0xb00)
const FIRST_ID = testUuid(0xb01)
const SECOND_ID = testUuid(0xb02)
const THIRD_ID = testUuid(0xb03)
const CAUGHT_IDS = [FIRST_ID, SECOND_ID, THIRD_ID]

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const conditionId = (code: string) => {
  const condition = SRD_CONDITION_TYPES.find((candidate) => candidate.code === code)
  if (!condition) throw new Error(`The SRD has no ${code} condition.`)
  return condition.id
}

/** The breather at (150, 150) and Wolves in the three cells east of it, all inside a 15 ft cone. */
async function breathRoom(breath: {
  creature: typeof dustMephit
  featureLabel: string
  condition: string
}) {
  const creature = installedSrdCreature(breath.creature)
  const feature = creature.features.find(({ label }) => label.startsWith(breath.featureLabel))
  if (!feature) throw new Error(`${creature.label} has no ${breath.featureLabel}.`)
  // The one Effect of the feature that leaves the condition rather than damage.
  const effect = feature.effects?.find((candidate) =>
    candidate.paths.some(
      (path) =>
        'resultBlock' in path &&
        path.resultBlock.outcomes.some(
          (outcome) =>
            outcome.effectKind === 'CONDITION' &&
            outcome.conditionId === conditionId(breath.condition)
        )
    )
  )
  if (!effect) throw new Error(`${creature.label} ${feature.label} leaves no ${breath.condition}.`)
  return actionRoom({
    rolls: [1, 1, 1],
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

describe.each([
  {
    creature: silverDragonWyrmling,
    featureLabel: 'Breath Weapons',
    condition: 'PARALYZED',
    repeatsSave: true,
    endsOnDamage: false
  },
  {
    creature: dustMephit,
    featureLabel: 'Blinding Breath',
    condition: 'BLINDED',
    repeatsSave: true,
    endsOnDamage: false
  },
  {
    creature: brassDragonWyrmling,
    featureLabel: 'Breath Weapons',
    condition: 'UNCONSCIOUS',
    repeatsSave: false,
    endsOnDamage: true
  }
])(
  'an unmodified SRD $creature.label leaves $condition with its breath',
  ({ creature, featureLabel, condition, repeatsSave, endsOnDamage }) => {
    it('offers the breath instead of listing it unavailable', async () => {
      const room = await breathRoom({ creature, featureLabel, condition })
      const choices = await room.actionChoices()
      expect(choices.actions.map(({ id }) => id)).toContain(room.actionId)
      expect(choices.unavailableActions.map(({ id }) => id)).not.toContain(room.actionId)
    })

    it('holds the condition and one timed effect on each creature that fails, in one commit', async () => {
      const room = await breathRoom({ creature, featureLabel, condition })
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

      const holders = CAUGHT_IDS.filter((id) =>
        readActorConditionIds(committed, id).includes(conditionId(condition))
      )
      expect(holders.sort()).toEqual([FIRST_ID, THIRD_ID].sort())
      expect(committed.activeEffects.map(({ targetActorId }) => targetActorId).sort()).toEqual(
        [FIRST_ID, THIRD_ID].sort()
      )
      for (const effect of committed.activeEffects) {
        const { recurrence, frozenGraphNodeId } = JSON.parse(effect.definitionJson)
        // "for 1 minute" is ten rounds.
        expect(recurrence.expiration).toMatchObject({ kind: 'TICKS', initialRemaining: 10 })
        expect(recurrence.endTriggers).toEqual(
          endsOnDamage ? [{ event: 'DAMAGE_TAKEN', by: 'ANYONE', damageTypeIds: null }] : []
        )
        expect(recurrence.recurrenceStage).toBe('END_OF_TURN')
        // The repeat-save form owns a save node the timed-condition form does not.
        expect(frozenGraphNodeId).toBe(repeatsSave ? 'repeat-save-test' : 'condition-duration')
      }
    })

    it('takes the condition and every effect back with the GM’s one undo', async () => {
      const room = await breathRoom({ creature, featureLabel, condition })
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
  }
)
