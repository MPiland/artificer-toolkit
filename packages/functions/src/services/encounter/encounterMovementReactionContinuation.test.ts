import { describe, expect, it } from 'vitest'

import { movementReactionChoiceGroupDtoSchema } from '@artificer-toolkit/schema/shared/reaction'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { createMovementReactionChoiceDefinition } from '../rules/movementReactionChoice.js'
import { DND5E_SYSTEM_ID } from '../rules/systems/dnd5e/characterActionCapabilityDiscovery.js'
import { createDnd5eCharacterActionRuntime } from '../rules/systems/dnd5e/characterActionRuntime.js'
import {
  appendEncounterMovementReactionResolutionCommand,
  movementReactionRemainderAfterCurrentChoice,
  resolveEncounterMovementReactionChoice,
  retainEncounterMovementReactionActionEvidence,
  startEncounterMovementReactionAtBoundary,
  startEncounterMovementReactionChoice
} from './encounterMovementReactionContinuation.js'

const ids = {
  actor: '00000000-0000-4000-8000-000000000502',
  allowance: '00000000-0000-4000-8000-000000000503',
  character: '00000000-0000-4000-8000-000000000504',
  choiceDefinition: '00000000-0000-4000-8000-000000000505',
  command: '00000000-0000-4000-8000-000000000506',
  eligibility: '00000000-0000-4000-8000-000000000507',
  encounter: '00000000-0000-4000-8000-000000000508',
  mover: '00000000-0000-4000-8000-000000000509',
  occurrence: '00000000-0000-4000-8000-000000000510',
  scene: '00000000-0000-4000-8000-000000000511',
  token: '00000000-0000-4000-8000-000000000512',
  user: '00000000-0000-4000-8000-000000000513'
} as const

function runtime() {
  return createDnd5eCharacterActionRuntime({
    continuationIntegrityKey: new Uint8Array(32).fill(5),
    definitions: {
      async requireCurrent() {
        throw new Error('A resolved reaction choice must not reload its source.')
      }
    }
  })
}

function choice() {
  const contactSourceId = 'a'.repeat(64)
  return movementReactionChoiceGroupDtoSchema.parse({
    pathDistance: 5,
    reactorActorId: ids.actor,
    reactorTokenId: ids.token,
    options: [
      {
        optionId: 'b'.repeat(64),
        contactSourceId,
        actionId: 'exact-reaction-action',
        actionSourceKind: 'CHARACTER_ACTION',
        actionSourceCurrentnessChecksum: 'c'.repeat(64),
        candidate: {
          contact: { x: 5, y: 0 },
          movingActorId: ids.mover,
          pathDistance: 5,
          reactorActorId: ids.actor,
          reactorTokenId: ids.token,
          sourceId: contactSourceId,
          stage: 'BEFORE_LEAVE_REACH'
        },
        binding: {
          kind: 'MOVEMENT',
          stage: 'BEFORE_LEAVE_REACH',
          perceptionRequirement: 'SEE',
          eligibilityDefinitionId: ids.eligibility
        },
        policy: {
          eligible: true,
          allowanceDefinitionId: ids.allowance,
          allowanceMaximum: 1,
          allowanceRefreshBoundary: 'START_OF_TURN',
          selectionPolicy: 'CHOICE',
          choiceDefinitionId: ids.choiceDefinition,
          targetPolicy: 'MOVER'
        },
        eligibilityEvidenceChecksum: 'd'.repeat(64),
        authority: {
          kind: 'CHARACTER_CONTROLLER',
          characterId: ids.character
        },
        visibility: 'CONTROLLER'
      }
    ]
  })
}

function context() {
  const originalPath = [
    { x: 0, y: 0 },
    { x: 10, y: 0 }
  ]
  return {
    root: {
      commandId: ids.command,
      commandFingerprint: 'e'.repeat(64),
      initiatorUserId: ids.user,
      correlationId: null,
      encounterId: ids.encounter,
      sceneId: ids.scene,
      tokenId: ids.token,
      expectedEncounterVersion: 2,
      expectedSceneVersion: 3,
      currentSceneVersion: 4,
      movementKind: 'VOLUNTARY' as const,
      originalPath,
      pathChecksum: checksumRuleDocument(originalPath),
      pathStartDistance: 5,
      currentPosition: { x: 5, y: 0 },
      resolutionCommands: []
    },
    spatialSelectionChecksum: 'f'.repeat(64),
    spatialCurrentnessChecksum: 'a'.repeat(64),
    completedSpatialExecutions: [],
    appliedSpatialPrefix: null,
    completedReactionExecutions: [],
    remainingSpatialCandidates: [],
    reactionTimeline: [{ kind: 'CONTROLLER_CHOICE' as const, group: choice() }]
  }
}

describe('Encounter movement reaction continuation', () => {
  it('appends choices to the same contiguous movement occurrence history', () => {
    const sourceContext = context()
    const command = {
      commandId: ids.command,
      commandFingerprint: '1'.repeat(64),
      actorUserId: ids.user,
      correlationId: null,
      expectedOccurrenceVersion: 0,
      kind: 'OPTION' as const,
      optionId: choice().options[0]!.optionId
    }

    expect(
      appendEncounterMovementReactionResolutionCommand({
        history: sourceContext.root.resolutionCommands,
        command,
        selection: { kind: 'OPTION', optionId: choice().options[0]!.optionId },
        actorUserId: ids.user,
        proposedOccurrenceVersion: 1
      })
    ).toEqual([command])
    expect(() =>
      appendEncounterMovementReactionResolutionCommand({
        history: [command],
        command,
        selection: { kind: 'OPTION', optionId: choice().options[0]!.optionId },
        actorUserId: ids.user,
        proposedOccurrenceVersion: 2
      })
    ).toThrow('stale')

    const remainder = movementReactionRemainderAfterCurrentChoice({
      context: {
        kind: 'ENCOUNTER_MOVEMENT_REACTION',
        schemaVersion: 1,
        phase: { kind: 'CHOICE' },
        reactionSelectionChecksum: checksumRuleDocument(sourceContext.reactionTimeline),
        ...sourceContext
      },
      resolutionCommands: [command]
    })
    expect(remainder).toMatchObject({
      root: { resolutionCommands: [{ kind: 'OPTION' }] },
      currentSpatialCandidate: null,
      reactionTimeline: []
    })
  })

  it('seals the staged spatial-first boundary into the same movement occurrence', async () => {
    const sourceContext = context()
    const {
      currentSceneVersion: _currentSceneVersion,
      pathChecksum: _pathChecksum,
      pathStartDistance: _pathStartDistance,
      currentPosition: _currentPosition,
      resolutionCommands: _resolutionCommands,
      ...root
    } = sourceContext.root
    const pending = await startEncounterMovementReactionAtBoundary({
      runtime: runtime(),
      occurrenceId: ids.occurrence,
      gameSystemId: DND5E_SYSTEM_ID,
      publishedChoice: createMovementReactionChoiceDefinition({
        definitionId: ids.choiceDefinition,
        gameSystemId: DND5E_SYSTEM_ID
      }),
      root,
      currentSceneVersion: 4,
      boundary: {
        kind: 'REACTION_BOUNDARY',
        boundaryDistance: 5,
        boundaryPosition: { x: 5, y: 0 },
        movementIntent: { tokenId: ids.token, position: { x: 5, y: 0 } },
        completedExecutions: [],
        appliedPrefix: null,
        completedReactionExecutions: [],
        remainingCandidates: [],
        resolutionCommands: [],
        selectionChecksum: 'f'.repeat(64),
        currentnessChecksum: 'a'.repeat(64)
      },
      reactionTimeline: sourceContext.reactionTimeline
    })

    expect(pending.applicationContext).toMatchObject({
      kind: 'ENCOUNTER_MOVEMENT_REACTION',
      root: {
        currentSceneVersion: 4,
        pathStartDistance: 5,
        currentPosition: { x: 5, y: 0 }
      },
      phase: { kind: 'CHOICE' },
      spatialSelectionChecksum: 'f'.repeat(64),
      spatialCurrentnessChecksum: 'a'.repeat(64),
      completedSpatialExecutions: [],
      remainingSpatialCandidates: []
    })
  })

  it('maps only an issued option identity to its bounded Kernel index', async () => {
    const rulesRuntime = runtime()
    const pending = await startEncounterMovementReactionChoice({
      runtime: rulesRuntime,
      occurrenceId: ids.occurrence,
      gameSystemId: DND5E_SYSTEM_ID,
      publishedChoice: createMovementReactionChoiceDefinition({
        definitionId: ids.choiceDefinition,
        gameSystemId: DND5E_SYSTEM_ID
      }),
      context: context()
    })
    expect(pending.request).toMatchObject({ min: 0, max: 1 })
    const result = await resolveEncounterMovementReactionChoice({
      runtime: rulesRuntime,
      pendingSnapshot: pending,
      selection: { kind: 'OPTION', optionId: choice().options[0]!.optionId }
    })
    expect(result).toMatchObject({
      kind: 'SELECTED',
      option: { actionId: 'exact-reaction-action' }
    })
    await expect(
      resolveEncounterMovementReactionChoice({
        runtime: rulesRuntime,
        pendingSnapshot: pending,
        selection: { kind: 'OPTION', optionId: '9'.repeat(64) }
      })
    ).rejects.toThrow('was not issued')
  })

  it('keeps Decline non-authored and re-pauses selected action evidence in the same occurrence', async () => {
    const rulesRuntime = runtime()
    const pending = await startEncounterMovementReactionChoice({
      runtime: rulesRuntime,
      occurrenceId: ids.occurrence,
      gameSystemId: DND5E_SYSTEM_ID,
      publishedChoice: createMovementReactionChoiceDefinition({
        definitionId: ids.choiceDefinition,
        gameSystemId: DND5E_SYSTEM_ID
      }),
      context: context()
    })
    await expect(
      resolveEncounterMovementReactionChoice({
        runtime: rulesRuntime,
        pendingSnapshot: pending,
        selection: { kind: 'DECLINE' }
      })
    ).resolves.toMatchObject({ kind: 'DECLINED' })
    const movementContext = pending.applicationContext
    if (movementContext.kind !== 'ENCOUNTER_MOVEMENT_REACTION') {
      throw new Error('Expected a movement reaction context.')
    }
    const { applicationContext: _applicationContext, ...continuation } = pending
    const actionPending = retainEncounterMovementReactionActionEvidence({
      continuation,
      context: movementContext,
      selectedOptionId: choice().options[0]!.optionId,
      d20Policy: {
        requestNodeId: 'choice',
        rollMode: 'NORMAL',
        contributors: [],
        contributorChecksum: checksumRuleDocument([]),
        modifier: 0,
        dc: 10
      }
    })
    expect(actionPending).toMatchObject({
      occurrenceId: ids.occurrence,
      applicationContext: {
        phase: {
          kind: 'ACTION_EVIDENCE',
          selectedOptionId: choice().options[0]!.optionId
        }
      }
    })
  })
})
