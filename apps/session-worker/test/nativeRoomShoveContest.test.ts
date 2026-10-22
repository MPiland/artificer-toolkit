import {
  creatureFeature,
  srdCondition,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { encounterBasicActionId } from '@artificer-toolkit/rules-runtime/encounterBasicActionCapabilityDiscovery'
import {
  SRD_BASIC_ACTION_DEFINITIONS,
  SRD_BASIC_ACTION_IDS
} from '@artificer-toolkit/source-data/srd/basicActions.js'
import {
  SRD_ACROBATICS_SKILL_ID,
  SRD_ATHLETICS_SKILL_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, withCheckTotals } from './actionRoomFixture.js'
import { tokenPositions } from './areaRoomReads.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import {
  parseReceiptExecution,
  readActorConditionIds,
  readRoomHistory
} from './roomHistoryReads.js'

const SHOVER_ID = testUuid(0xa80)
const TARGET_ID = testUuid(0xa81)
const SHOVER_AT = { x: 150, y: 150 }
const TARGET_AT = { x: 250, y: 150 }
const PRONE = srdCondition('Prone')
const shoveDefinition = SRD_BASIC_ACTION_DEFINITIONS.find(
  ({ id }) => id === SRD_BASIC_ACTION_IDS.SHOVE
)
if (shoveDefinition?.document.kind !== 'BASIC_ACTION') throw new Error('Missing Shove fixture.')
const SHOVE_ACTION_ID = encounterBasicActionId(
  SHOVER_ID,
  SRD_BASIC_ACTION_IDS.SHOVE,
  shoveDefinition.document.effects[0]!.id
)
/** The zero-based draw of a d20 that shows `face`. */
const draw = (face: number) => face - 1

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * The shover Wolf (Athletics +5) shoves the adjacent Wolf (Athletics +0, Acrobatics +2) 5 feet to
 * its east; a token is 100 px, a cell 5 ft. The shover's d20 is drawn first, then the defender's.
 */
function shoveRoom(
  faces: number[],
  target: { at?: { x: number; y: number }; size?: CreatureAuthored['size'] } = {}
) {
  return actionRoom({
    autoRoll: 'BOTH',
    rolls: faces.map(draw),
    actors: [
      withCheckTotals(srdCreatureActor({ id: SHOVER_ID, creature: plainWolf }), {
        [SRD_ATHLETICS_SKILL_ID]: 5
      }),
      withCheckTotals(
        srdCreatureActor({
          id: TARGET_ID,
          creature: target.size ? { ...plainWolf, size: target.size } : plainWolf
        }),
        {
          [SRD_ATHLETICS_SKILL_ID]: 0,
          [SRD_ACROBATICS_SKILL_ID]: 2
        }
      )
    ],
    positions: { [SHOVER_ID]: SHOVER_AT, [TARGET_ID]: target.at ?? TARGET_AT },
    ownerFeatureId: creatureFeature(plainWolf, 'Bite').id
  })
}

type ShoveRoom = Awaited<ReturnType<typeof shoveRoom>>

/** The option the room offers the shover for `label`, picked with the attempt (D105). */
async function shoveOption(room: ShoveRoom, label: string) {
  const choices = await room.actionChoices(SHOVER_ID)
  const shove = choices.basicActionChoices.find(({ id }) => id === SHOVE_ACTION_ID)
  const options = shove?.target && 'choiceOptions' in shove.target ? shove.target.choiceOptions : []
  expect(options?.map((option) => option.label)).toEqual(['Knock prone', 'Push 5 feet away'])
  const option = options?.find((value) => value.label === label)
  if (!option) throw new Error(`The room offers no ${label} option.`)
  return option.id
}

async function shove(room: ShoveRoom, label: string) {
  const choiceOptionId = await shoveOption(room, label)
  return room.startAction(
    TARGET_ID,
    ['TARGET_RANGE_UNCHECKED'],
    null,
    null,
    SHOVE_ACTION_ID,
    SHOVER_ID,
    choiceOptionId
  )
}

async function settled(room: ShoveRoom) {
  const history = await readRoomHistory(room.room.base.stub)
  const outputs = history.receipts.flatMap((receipt) => {
    if (receipt.commandType !== 'RESOLVE_ACTION') return []
    const execution = parseReceiptExecution(receipt)
    return execution.status === 'COMPLETE' &&
      execution.applicationOutputs?.kind === 'CONTESTED_ACTION'
      ? [execution.applicationOutputs]
      : []
  })
  return {
    outputs,
    occurrences: history.occurrences.map(({ state }) => state),
    targetConditions: readActorConditionIds(history, TARGET_ID),
    targetAt: tokenPositions(room)(TARGET_ID)
  }
}

describe('Shove, a basic action contested by the target, in the room (ATTACK-7 AC 7.6)', () => {
  it('knocks a target the shover beats prone, where it stands', async () => {
    // The shover rolls 12 (+5 = 17); the defender auto-takes Acrobatics +2 and rolls 10 (12).
    const room = await shoveRoom([12, 10])
    const { answer } = await shove(room, 'Knock prone')
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const { outputs, occurrences, targetConditions, targetAt } = await settled(room)
    expect(outputs).toMatchObject([
      {
        sourceActorId: SHOVER_ID,
        targetActorId: TARGET_ID,
        sourceRoll: { selectedNatural: 12, modifier: 5, total: 17 },
        targetRoll: { selectedNatural: 10, modifier: 2, total: 12 },
        outcome: 'SOURCE_WIN',
        stateTransition: {
          kind: 'TARGET_OUTCOME',
          mechanics: {
            applications: [{ kind: 'CONDITION_APPLY', conditionId: PRONE }],
            targetTransition: { after: { conditionIds: expect.arrayContaining([PRONE]) } }
          },
          forcedMovements: []
        }
      }
    ])
    expect(occurrences).toEqual(['COMPLETED'])
    expect(targetConditions).toContain(PRONE)
    expect(targetAt).toEqual(TARGET_AT)
  })

  it('pushes a target the shover beats 5 feet straight away, and leaves it standing', async () => {
    const room = await shoveRoom([12, 10])
    const { answer } = await shove(room, 'Push 5 feet away')
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const { outputs, occurrences, targetConditions, targetAt } = await settled(room)
    expect(outputs).toMatchObject([
      {
        outcome: 'SOURCE_WIN',
        stateTransition: {
          kind: 'TARGET_OUTCOME',
          mechanics: null,
          forcedMovements: [{ direction: 'AWAY_FROM_SOURCE', feet: 5, upTo: false }]
        }
      }
    ])
    expect(occurrences).toEqual(['COMPLETED'])
    expect(targetConditions).not.toContain(PRONE)
    expect(targetAt).toEqual({ x: 350, y: 150 })
    expect(tokenPositions(room)(SHOVER_ID)).toEqual(SHOVER_AT)
  })

  it.each(['Knock prone', 'Push 5 feet away'])(
    'does nothing to the target on a tie (%s), yet the shover’s attack is spent',
    async (label) => {
      // 7 + 5 = 12 against the defender's 10 + 2 = 12: a tie goes to the defender.
      const room = await shoveRoom([7, 10])
      const { answer } = await shove(room, label)
      expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

      const { outputs, targetConditions, targetAt } = await settled(room)
      expect(outputs).toMatchObject([
        { outcome: 'TARGET_WIN_OR_TIE', stateTransition: { kind: 'NONE' } }
      ])
      expect(targetConditions).not.toContain(PRONE)
      expect(targetAt).toEqual(TARGET_AT)
    }
  )

  it.each(['Knock prone', 'Push 5 feet away'])(
    'refuses to undo a won Shove (%s), like every contest, and leaves its outcome',
    async (label) => {
      const room = await shoveRoom([12, 10])
      const { answer } = await shove(room, label)
      expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
      const before = await settled(room)

      const undo = await room.send({
        type: 'REVERT_LAST_ACTION',
        encounterId: room.room.encounterId,
        commandId: crypto.randomUUID(),
        expectedVersion: await room.version()
      })
      expect(undo).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'REVERT_UNAVAILABLE' })
      expect(JSON.stringify(undo)).toContain("Undo can't restore a contest")
      expect(await settled(room)).toEqual(before)
    }
  )

  describe('with the Scene checked', () => {
    // The Wolf is Medium: a Large target is one size larger, a Huge one two.
    const checked = async (
      target: Parameters<typeof shoveRoom>[1],
      acknowledged: Parameters<ShoveRoom['startAction']>[1] = []
    ) => {
      const room = await shoveRoom([12, 10], target)
      const choiceOptionId = await shoveOption(room, 'Knock prone')
      const started = await room.startAction(
        TARGET_ID,
        acknowledged,
        room.sceneContext(),
        null,
        SHOVE_ACTION_ID,
        SHOVER_ID,
        choiceOptionId
      )
      return { room, answer: started.answer }
    }
    const warningCodes = (answer: object) =>
      (answer as { warnings: { code: string }[] }).warnings.map(({ code }) => code)

    it('shoves a target within reach that is one size larger', async () => {
      const { answer } = await checked({ size: 'LARGE' })
      expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    })

    it('refuses a target beyond reach until the GM overrides', async () => {
      const far = { x: 450, y: 150 }
      const { room, answer } = await checked({ at: far })
      expect(answer).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'RULE_WARNINGS' })
      expect(warningCodes(answer)).toEqual(['TARGET_OUT_OF_RANGE'])
      expect((await settled(room)).outputs).toEqual([])
    })

    it('refuses a target more than one size larger until the GM overrides', async () => {
      const { room, answer } = await checked({ size: 'HUGE' })
      expect(answer).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'RULE_WARNINGS' })
      expect(warningCodes(answer)).toEqual(['TARGET_TOO_LARGE'])
      expect((await settled(room)).outputs).toEqual([])

      const overridden = await checked({ size: 'HUGE' }, ['TARGET_TOO_LARGE'])
      expect(overridden.answer.type, JSON.stringify(overridden.answer)).toBe('COMMAND_COMMITTED')
    })
  })

  it('refuses a Shove that names no outcome, or one it does not offer', async () => {
    const room = await shoveRoom([])
    for (const choiceOptionId of [undefined, testUuid(0xa8f)]) {
      const { answer } = await room.startAction(
        TARGET_ID,
        ['TARGET_RANGE_UNCHECKED'],
        null,
        null,
        SHOVE_ACTION_ID,
        SHOVER_ID,
        choiceOptionId
      )
      expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_REJECTED')
    }
  })
})
