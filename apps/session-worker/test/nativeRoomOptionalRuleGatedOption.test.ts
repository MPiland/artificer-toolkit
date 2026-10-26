import {
  creatureFeature,
  currentSrdDefinition,
  srdCondition,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { encounterBasicActionId } from '@artificer-toolkit/rules-runtime/encounterBasicActionCapabilityDiscovery'
import { DND5E_SHOVE_ASIDE_DEFINITION_ID } from '@artificer-toolkit/schema/shared/optionalCombat'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  SRD_BASIC_ACTION_DEFINITIONS,
  SRD_BASIC_ACTION_IDS
} from '@artificer-toolkit/source-data/srd/basicActions.js'
import {
  SRD_ACROBATICS_SKILL_ID,
  SRD_ATHLETICS_SKILL_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom, withCheckTotals } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readActorConditionIds, readRoomHistory } from './roomHistoryReads.js'

const SHOVER_ID = testUuid(0xb30)
const TARGET_ID = testUuid(0xb31)
const TRIP_ACTION_DEFINITION_ID = testUuid(0xb32)
const TRIP_EFFECT_ID = testUuid(0xb33)
const PRONE = srdCondition('Prone')
const TRIP_ACTION_ID = encounterBasicActionId(SHOVER_ID, TRIP_ACTION_DEFINITION_ID, TRIP_EFFECT_ID)
/** The zero-based draw of a d20 that shows `face`. */
const draw = (face: number) => face - 1

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/**
 * A homebrew Shove whose pick adds a third option, Trip, offered only while the Encounter uses the
 * Shove Aside optional rule (MOVE-2.T2a): authored data, no gate-specific code.
 */
function tripDefinition() {
  const shove = SRD_BASIC_ACTION_DEFINITIONS.find(({ id }) => id === SRD_BASIC_ACTION_IDS.SHOVE)
  if (shove?.document.kind !== 'BASIC_ACTION') throw new Error('Missing Shove fixture.')
  const [effect] = shove.document.effects
  const [path] = effect!.paths
  if (path?.selectionKind !== 'CHOICE') throw new Error('Shove has no pick.')
  const document = {
    ...shove.document,
    id: TRIP_ACTION_DEFINITION_ID,
    effects: [
      {
        ...effect!,
        id: TRIP_EFFECT_ID,
        paths: [
          {
            ...path,
            options: [
              ...path.options,
              {
                id: testUuid(0xb34),
                order: path.options.length + 1,
                label: 'Trip',
                description: 'The target has the Prone condition.',
                requiresOptionalRule: { definitionId: DND5E_SHOVE_ASIDE_DEFINITION_ID },
                resultBlock: {
                  id: testUuid(0xb35),
                  resultKind: 'SINGLE' as const,
                  outcomes: [
                    { id: testUuid(0xb36), effectKind: 'CONDITION' as const, conditionId: PRONE }
                  ]
                }
              }
            ]
          }
        ]
      }
    ]
  }
  return currentSrdDefinition({
    ...shove,
    id: TRIP_ACTION_DEFINITION_ID,
    label: 'Homebrew Shove',
    document,
    checksum: checksumRuleDocument(document)
  })
}

/** The shover Wolf (Athletics +5) beats the adjacent Wolf (Acrobatics +2): 12 + 5 against 10 + 2. */
function tripRoom(shoveAside: boolean) {
  return actionRoom({
    autoRoll: 'BOTH',
    rolls: [12, 10].map(draw),
    actors: [
      withCheckTotals(srdCreatureActor({ id: SHOVER_ID, creature: plainWolf }), {
        [SRD_ATHLETICS_SKILL_ID]: 5
      }),
      withCheckTotals(srdCreatureActor({ id: TARGET_ID, creature: plainWolf }), {
        [SRD_ATHLETICS_SKILL_ID]: 0,
        [SRD_ACROBATICS_SKILL_ID]: 2
      })
    ],
    positions: { [SHOVER_ID]: { x: 150, y: 150 }, [TARGET_ID]: { x: 250, y: 150 } },
    ownerFeatureId: creatureFeature(plainWolf, 'Bite').id,
    definitions: [tripDefinition()],
    ...(shoveAside && { optionalCombatKinds: ['SHOVE_ASIDE' as const] })
  })
}

type TripRoom = Awaited<ReturnType<typeof tripRoom>>

async function offeredLabels(room: TripRoom) {
  const choices = await room.actionChoices(SHOVER_ID)
  const action = choices.basicActionChoices.find(({ id }) => id === TRIP_ACTION_ID)
  const options =
    action?.target && 'choiceOptions' in action.target ? action.target.choiceOptions : undefined
  return options?.map(({ label }) => label)
}

const pick = (room: TripRoom, choiceOptionId: string) =>
  room.startAction(
    TARGET_ID,
    ['TARGET_RANGE_UNCHECKED'],
    null,
    null,
    TRIP_ACTION_ID,
    SHOVER_ID,
    choiceOptionId
  )

describe('An option gated on an optional combat rule, in the room (MOVE-2.T2a)', () => {
  it('hides the option and refuses its pick while the Encounter does not use the rule', async () => {
    const room = await tripRoom(false)
    expect(await offeredLabels(room)).toEqual(['Knock prone', 'Push 5 feet away'])
    const before = await readRoomHistory(room.room.base.stub)

    const { answer } = await pick(room, testUuid(0xb34))
    expect(answer).toMatchObject({ type: 'COMMAND_REJECTED', reason: 'TARGET_UNAVAILABLE' })
    const after = await readRoomHistory(room.room.base.stub)
    expect(after.receipts).toEqual(before.receipts)
    expect(readActorConditionIds(after, TARGET_ID)).toEqual([])
  }, 120000)

  it('offers the option and runs its pick while the Encounter uses the rule', async () => {
    const room = await tripRoom(true)
    expect(await offeredLabels(room)).toEqual(['Knock prone', 'Push 5 feet away', 'Trip'])

    const { answer } = await pick(room, testUuid(0xb34))
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const history = await readRoomHistory(room.room.base.stub)
    expect(readActorConditionIds(history, TARGET_ID)).toEqual([PRONE])
  }, 120000)
})
