import {
  characterActor,
  currentSrdDefinition,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { ruleMaintenanceReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/ruleMaintenance'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import type { ClassFeature } from '../src/testing/srdCharacterSource.js'
import { actionRoom } from './actionRoomFixture.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { parseReceiptExecution, readRoomHistory } from './roomHistoryReads.js'

const FIGHTER_ACTOR_ID = testUuid(0xc00)
const FIGHTER_ID = testUuid(0xc01)
const WOLF_ID = testUuid(0xc02)
const MAINTENANCE_DEFINITION_ID = '00000000-0000-4000-8000-0000000008f0'
/** The captured Character page starts at Character stream version 1 (see `characterPageFixture`). */
const CAPTURED_STREAM_VERSION = 1

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

const maintenanceDocument = ruleMaintenanceReusableDefinitionDocumentDtoSchema.parse({
  schemaVersion: 1,
  kind: 'RULE_MAINTENANCE',
  id: MAINTENANCE_DEFINITION_ID,
  gameSystemId: srdSystemRecord.id,
  replacementPolicy: 'REPLACE_SAME_DEFINITION',
  emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY',
  damageCheckDefinitionId: null
})
const maintenanceDefinition = currentSrdDefinition({
  id: maintenanceDocument.id,
  definitionFamilyKey: 'rule-maintenance',
  label: 'Native maintained effect fixture',
  description: 'Reusable maintenance policy for native test actions.',
  document: jsonValueSchema.parse(maintenanceDocument),
  checksum: checksumRuleDocument(maintenanceDocument)
})

/**
 * A Fighter Feature that spends one of two charges to heal 1d4 and maintains the shared
 * maintenance definition for three rounds: on the Fighter, or on one target.
 */
function surgeFeature(input: { seed: number; label: string; self: boolean }): ClassFeature {
  const chargeId = testUuid(input.seed)
  return {
    id: testUuid(input.seed + 1),
    label: input.label,
    description: 'Heals and maintains a native test effect.',
    attributes: ['LIMITED_USE'],
    charges: {
      id: chargeId,
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'SHORT_REST',
      amount: 2
    },
    availableAtLevel: 1,
    order: 1,
    effects: [
      {
        id: testUuid(input.seed + 2),
        order: 1,
        invocation: {
          kind: 'ACTION',
          triggerCode: 'ACTIVATED',
          resourceUse: { chargeId, cost: 1 },
          activation: { code: 'ACTION', amount: 1 },
          range: {
            id: testUuid(input.seed + 3),
            rangeKind: input.self ? 'SELF' : 'UNLIMITED'
          },
          targeting: input.self
            ? { selectionKind: 'SELF' }
            : { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
        },
        paths: [
          {
            id: testUuid(input.seed + 4),
            order: 1,
            pathCode: 'ON_USE',
            groupType: 'SINGLE',
            originKind: 'SOURCE',
            selectionKind: 'FIXED',
            resultBlock: {
              id: testUuid(input.seed + 5),
              resultKind: 'SINGLE',
              maintenanceDefinitionId: MAINTENANCE_DEFINITION_ID,
              duration: { id: testUuid(input.seed + 6), durationKind: 'ROUND', amount: 3 },
              lifecycle: { recurringKind: 'START_OF_TURN' },
              outcomes: [
                {
                  id: testUuid(input.seed + 7),
                  effectKind: 'HEAL',
                  valueKind: 'DICE',
                  scalingKind: 'NONE',
                  diceConfig: '1d4'
                }
              ]
            }
          }
        ]
      }
    ]
  }
}

const selfSurge = surgeFeature({
  seed: 0xc100,
  label: 'Self Surge',
  self: true
})
const targetedSurge = surgeFeature({
  seed: 0xc200,
  label: 'Targeted Surge',
  self: false
})

/** The Fighter acts first; the Wolf is the other actor. Every roll is the player's or the GM's auto-roll. */
function surgeRoom() {
  return actionRoom({
    autoRoll: 'BOTH',
    // Each action's one d4 shows 1.
    rolls: [0, 0],
    // Wounded, so the heal changes the Fighter's hit points.
    characterPlay: { currentHitPoints: 5 },
    actors: [
      characterActor({ id: FIGHTER_ACTOR_ID, characterId: FIGHTER_ID }),
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
    ],
    characterClassFeatures: [selfSurge, targetedSurge],
    definitions: [maintenanceDefinition],
    characterAction: (action) => action.label.includes('Self Surge')
  })
}

/** The settled root action receipt of `commandId`, and the checksum its command metadata froze. */
async function settledAction(room: Awaited<ReturnType<typeof surgeRoom>>, commandId: string) {
  const history = await readRoomHistory(room.room.base.stub)
  const receipt = history.receipts.find(
    (candidate) => candidate.commandId === commandId && candidate.commandType === 'RESOLVE_ACTION'
  )
  if (!receipt) throw new Error('The root action receipt is missing.')
  const execution = parseReceiptExecution(receipt)
  if (execution.status !== 'COMPLETE') throw new Error('The root action did not complete.')
  expect(execution.initialFactsChecksum).toBe(JSON.parse(receipt.commandMetadataJson).factsChecksum)
  return { history, execution }
}

describe('a Character action source in the room', () => {
  it('settles a self action’s resource and hit points in one Character batch', async () => {
    const room = await surgeRoom()
    const { command, answer } = await room.startAction(FIGHTER_ACTOR_ID)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const { history, execution } = await settledAction(room, command.commandId)
    const [created] = history.characterEffects
    const [state] = history.maintainedStates
    expect(history.characterEffects).toHaveLength(1)
    expect(history.maintainedStates).toHaveLength(1)
    expect(created!.maintainedEffectStateId).toBe(state!.id)
    expect(execution.applicationOutputs).toMatchObject({
      kind: 'CHARACTER_MECHANICS_BATCH',
      sourceActorId: FIGHTER_ACTOR_ID,
      sourceCharacterId: FIGHTER_ID,
      targetActorId: FIGHTER_ACTOR_ID,
      sourceCharacterStreamVersion: null,
      targetCharacterStreamVersion: CAPTURED_STREAM_VERSION + 1,
      maintenanceTransition: {
        priorState: null,
        createdState: {
          id: state!.id,
          sourceActionId: room.actionId,
          sourceActorId: FIGHTER_ACTOR_ID,
          maintenanceDefinitionId: MAINTENANCE_DEFINITION_ID
        },
        createdDependentEffectIds: [created!.id]
      }
    })
  })

  it('replaces the self maintenance from a targeted action, advancing the distinct source Character once', async () => {
    const room = await surgeRoom()
    const first = await room.startAction(FIGHTER_ACTOR_ID)
    expect(first.answer.type, JSON.stringify(first.answer)).toBe('COMMAND_COMMITTED')
    const { history: afterCreated } = await settledAction(room, first.command.commandId)
    const [priorEffect] = afterCreated.characterEffects
    const [priorState] = afterCreated.maintainedStates

    const targetedActionId = (await room.actionChoices()).actions.find(({ label }) =>
      label.includes('Targeted Surge')
    )?.id
    if (!targetedActionId) throw new Error('The Fighter offers no Targeted Surge.')
    // Both actions use the turn's one Action: the second is a soft override.
    const second = await room.startAction(
      WOLF_ID,
      ['ACTION_ECONOMY_UNAVAILABLE'],
      null,
      null,
      targetedActionId
    )
    expect(second.answer.type, JSON.stringify(second.answer)).toBe('COMMAND_COMMITTED')

    const { history: afterReplaced, execution } = await settledAction(
      room,
      second.command.commandId
    )
    const [wolfEffect] = afterReplaced.activeEffects.filter(
      ({ targetActorId }) => targetActorId === WOLF_ID
    )
    const [replacementState] = afterReplaced.maintainedStates
    expect(afterReplaced.maintainedStates).toHaveLength(1)
    expect(replacementState!.id).not.toBe(priorState!.id)
    expect(afterReplaced.characterEffects).toEqual([])
    expect(wolfEffect!.maintainedEffectStateId).toBe(replacementState!.id)
    expect(execution.applicationOutputs).toMatchObject({
      kind: 'ENCOUNTER_ACTOR_MECHANICS_BATCH',
      sourceActorId: FIGHTER_ACTOR_ID,
      sourceCharacterId: FIGHTER_ID,
      targetActorId: WOLF_ID,
      sourceCharacterStreamVersion: CAPTURED_STREAM_VERSION + 2,
      activeEffectTransitions: [
        expect.objectContaining({
          kind: 'CREATE',
          maintainedEffectStateId: replacementState!.id
        })
      ],
      maintenanceTransition: {
        kind: 'REPLACE_SAME_DEFINITION',
        priorState: { id: priorState!.id },
        removedDependentEffects: [
          expect.objectContaining({
            kind: 'CHARACTER',
            characterId: FIGHTER_ID,
            activeEffectId: priorEffect!.id
          })
        ],
        characterOwnerTransitions: [
          {
            characterId: FIGHTER_ID,
            beforeStreamVersion: CAPTURED_STREAM_VERSION + 1,
            afterStreamVersion: CAPTURED_STREAM_VERSION + 2
          }
        ],
        createdState: {
          id: replacementState!.id,
          sourceActionId: targetedActionId,
          sourceActorId: FIGHTER_ACTOR_ID,
          maintenanceDefinitionId: MAINTENANCE_DEFINITION_ID
        },
        createdDependentEffectIds: [wolfEffect!.id]
      }
    })
  })
})
