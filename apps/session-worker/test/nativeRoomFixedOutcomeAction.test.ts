import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import type { ClassFeature } from '../src/testing/srdCharacterSource.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { parseReceiptExecution, readRoomHistory } from './roomHistoryReads.js'

const FIGHTER_ACTOR_ID = testUuid(0xd00)
const FIGHTER_ID = testUuid(0xd01)
const WOLF_ID = testUuid(0xd02)
const FIXED_HEAL = 3
const WOUNDED_HIT_POINTS = 5

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** An authored Fighter Feature whose only outcome is a fixed heal: no attack roll and no dice. */
const steadyingWord: ClassFeature = {
  id: testUuid(0xd10),
  label: 'Steadying Word',
  description: 'Heals a fixed amount.',
  attributes: [],
  availableAtLevel: 1,
  order: 1,
  effects: [
    {
      id: testUuid(0xd11),
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: 'ACTIVATED',
        activation: { code: 'ACTION', amount: 1 },
        range: { id: testUuid(0xd12), rangeKind: 'SELF' },
        targeting: { selectionKind: 'SELF' }
      },
      paths: [
        {
          id: testUuid(0xd13),
          order: 1,
          pathCode: 'ON_USE',
          groupType: 'SINGLE',
          originKind: 'SOURCE',
          selectionKind: 'FIXED',
          resultBlock: {
            id: testUuid(0xd14),
            resultKind: 'SINGLE',
            outcomes: [
              {
                id: testUuid(0xd15),
                effectKind: 'HEAL',
                valueKind: 'FIXED',
                scalingKind: 'NONE',
                amount: FIXED_HEAL
              }
            ]
          }
        }
      ]
    }
  ]
}

describe('a Character action whose only outcome is fixed', () => {
  it('is offered and heals the exact fixed amount with a receipt', async () => {
    const room = await actionRoom({
      autoRoll: 'BOTH',
      rolls: [],
      characterPlay: { currentHitPoints: WOUNDED_HIT_POINTS },
      actors: [
        characterActor({ id: FIGHTER_ACTOR_ID, characterId: FIGHTER_ID }),
        srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
      ],
      characterClassFeatures: [steadyingWord],
      characterAction: (action) => action.label === steadyingWord.label
    })
    const { command, answer } = await room.startAction(FIGHTER_ACTOR_ID)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const history = await readRoomHistory(room.room.base.stub)
    const receipt = history.receipts.find(
      (candidate) =>
        candidate.commandId === command.commandId && candidate.commandType === 'RESOLVE_ACTION'
    )
    if (!receipt) throw new Error('The root action receipt is missing.')
    const execution = parseReceiptExecution(receipt)
    if (execution.status !== 'COMPLETE') throw new Error('The root action did not complete.')
    expect(execution.applicationOutputs).toMatchObject({
      kind: 'CHARACTER_MECHANICS_BATCH',
      sourceCharacterId: FIGHTER_ID,
      targetTransition: {
        before: { currentHitPoints: WOUNDED_HIT_POINTS },
        after: { currentHitPoints: WOUNDED_HIT_POINTS + FIXED_HEAL }
      },
      applications: [
        {
          kind: 'HEAL',
          requestedAmount: FIXED_HEAL,
          appliedAmount: FIXED_HEAL,
          beforeCurrentHitPoints: WOUNDED_HIT_POINTS,
          afterCurrentHitPoints: WOUNDED_HIT_POINTS + FIXED_HEAL
        }
      ]
    })
  })
})
