import { describe, expect, it } from 'vitest'

import type {
  ServerKernelRuleExecutionPendingSnapshotDto,
  ServerRuleExecutionContinuationDto
} from '@artificer-toolkit/schema/shared/rulesExecution'

import type { PendingEncounterInitiativeLifecycle } from './encounterInitiativeLifecycle.js'
import {
  createEncounterInitiativeDeclarationPendingSnapshot,
  createEncounterInitiativePendingSnapshot,
  projectEncounterInitiativePendingSummary,
  restoreEncounterInitiativePending,
  type EncounterInitiativeOccurrenceRoot
} from './encounterInitiativeOccurrence.js'
import type { InitiativeScoreBatchEntity } from './encounterInitiativeScoreBatch.js'

const occurrenceId = '00000000-0000-4000-8000-000000000001'
const commandId = '00000000-0000-4000-8000-000000000002'
const userId = '00000000-0000-4000-8000-000000000003'
const gameSystemId = '00000000-0000-4000-8000-000000000004'
const definitionId = '00000000-0000-4000-8000-000000000005'
const actorA = '00000000-0000-4000-8000-000000000011'
const actorB = '00000000-0000-4000-8000-000000000012'
const sideA = '00000000-0000-4000-8000-000000000021'
const sideB = '00000000-0000-4000-8000-000000000022'
const checksum = 'a'.repeat(64)

const stagedRoundState = {
  round: {
    encounterId: '00000000-0000-4000-8000-000000000010',
    round: 1,
    procedure: 'ACTOR_ROLL' as const,
    cadence: 'ENCOUNTER_START' as const,
    status: 'PREPARING' as const,
    policySnapshotChecksum: checksum,
    nextTurnOrderOrdinal: 0,
    version: 0
  },
  participants: [
    {
      encounterId: '00000000-0000-4000-8000-000000000010',
      round: 1,
      actorId: actorA,
      sideId: sideA,
      status: 'UNRESOLVED' as const,
      initiativeScore: null,
      evaluation: { occurrenceId: null, resultChecksum: null },
      tie: { occurrenceId: null, resultChecksum: null },
      declaration: null,
      declarationChecksum: null,
      turnOrderOrdinal: null,
      // The aggregate choice binds the exact staged participant version.
      version: 4
    },
    {
      encounterId: '00000000-0000-4000-8000-000000000010',
      round: 1,
      actorId: actorB,
      sideId: sideB,
      status: 'UNRESOLVED' as const,
      initiativeScore: null,
      evaluation: { occurrenceId: null, resultChecksum: null },
      tie: { occurrenceId: null, resultChecksum: null },
      declaration: null,
      declarationChecksum: null,
      turnOrderOrdinal: null,
      version: 0
    }
  ],
  sides: []
}

const root: EncounterInitiativeOccurrenceRoot = {
  rootCommandId: commandId,
  commandFingerprint: checksum,
  commandType: 'START',
  initiatorUserId: userId,
  correlationId: null,
  expectedEncounterVersion: 3,
  round: 1,
  policySnapshotChecksum: checksum,
  initiativeBeforePin: { kind: 'INITIAL_START', actorIds: [actorA, actorB] },
  stagedInitiativeRoundState: stagedRoundState,
  startSystemId: gameSystemId,
  resolutionCommands: []
}

function entity(kind: 'ACTOR' | 'SIDE', id: string): InitiativeScoreBatchEntity {
  return { kind, id, binding: { automatic: true, facts: { 'initiative.value': 10 } } }
}

function unavailableResult(value: InitiativeScoreBatchEntity) {
  return {
    entity: { kind: value.kind, id: value.id },
    result: { kind: 'FACTS_UNAVAILABLE' as const }
  }
}

function continuation(
  requestId: string,
  min: number,
  max: number
): ServerRuleExecutionContinuationDto {
  return {
    schemaVersion: 1,
    occurrenceId,
    graph: {
      schemaVersion: 1,
      source: {
        definitionId,
        gameSystemId,
        definitionFamilyKey: 'initiative-score',
        checksum
      },
      capabilityContractVersion: 1,
      factContracts: [],
      nodes: [
        {
          id: 'resolve',
          operation: { key: 'initiative.resolve', contractVersion: 1 },
          inputs: {}
        }
      ],
      outputs: { result: { kind: 'NODE_OUTPUT', nodeId: 'resolve', port: 'result' } }
    },
    facts: {},
    nextNodeIndex: 0,
    nodeOutputs: {},
    trace: [],
    request: {
      requestId,
      kind: 'INTEGER_RANGE',
      nodeId: 'resolve',
      ordinal: 0,
      min,
      max
    },
    authority: 'APPLICATION_SERVICE',
    redaction: 'SERVER_ONLY',
    seal: 'b'.repeat(64)
  }
}

describe('Encounter initiative occurrence state', () => {
  it('seals and projects the exact sanitized declaration options', () => {
    const pendingSnapshot = createEncounterInitiativeDeclarationPendingSnapshot({
      occurrenceId,
      root,
      request: {
        requestId: 'speed-factor-declaration',
        kind: 'INITIATIVE_DECLARATION',
        encounterId: stagedRoundState.round.encounterId,
        round: 1,
        actorId: actorA,
        participantExpectedVersion: 4,
        primaryOptions: [
          {
            kind: 'CHARACTER_ACTION',
            optionId: 'action:longsword',
            label: 'Longsword',
            selectionContract: checksum
          }
        ],
        bonusOptions: [
          {
            kind: 'CHARACTER_SPELL_CAST',
            optionId: 'spell:misty-step',
            label: 'Misty Step',
            selectionContract: checksum
          }
        ],
        adjudicationFields: [],
        controllerUserId: userId,
        sourceOptionsChecksum: checksum
      }
    })

    expect(pendingSnapshot.snapshotKind).toBe('AGGREGATE_CHOICE')
    expect(
      projectEncounterInitiativePendingSummary({
        pendingSnapshot,
        occurrenceVersion: 2,
        encounterVersion: 3
      })
    ).toEqual({
      kind: 'INITIATIVE_DECLARATION',
      occurrenceId,
      occurrenceVersion: 2,
      encounterVersion: 3,
      actorId: actorA,
      requestId: 'speed-factor-declaration',
      primaryOptions: [
        {
          kind: 'CHARACTER_ACTION',
          optionId: 'action:longsword',
          label: 'Longsword',
          selectionContract: checksum
        }
      ],
      bonusOptions: [
        {
          kind: 'CHARACTER_SPELL_CAST',
          optionId: 'spell:misty-step',
          label: 'Misty Step',
          selectionContract: checksum
        }
      ],
      adjudicationFields: [],
      allowedResponses: ['INITIATIVE_DECLARATION']
    })
  })

  it('projects the exact sealed declaration options from a kernel phase', () => {
    const primaryOptions = [
      {
        kind: 'CHARACTER_ACTION' as const,
        optionId: 'action:longsword',
        label: 'Longsword',
        selectionContract: checksum
      }
    ]
    const bonusOptions = [
      {
        kind: 'CREATURE_FEATURE_ACTION' as const,
        optionId: 'feature:second-wind',
        label: 'Second Wind',
        selectionContract: checksum
      }
    ]
    const kernelSnapshot: ServerKernelRuleExecutionPendingSnapshotDto = {
      ...continuation('kernel-declaration', 0, 1),
      snapshotKind: 'KERNEL_EVIDENCE',
      optionalCombatSnapshotChecksum: null,
      applicationContext: {
        kind: 'ENCOUNTER_INITIATIVE',
        schemaVersion: 1,
        root,
        phase: {
          kind: 'INITIATIVE_DECLARATION',
          actorId: actorA,
          participantVersion: 4,
          requestId: 'kernel-speed-factor-declaration',
          primaryOptions,
          bonusOptions,
          adjudicationFields: []
        }
      }
    }

    const pendingSummary = projectEncounterInitiativePendingSummary({
      pendingSnapshot: kernelSnapshot,
      occurrenceVersion: 4,
      encounterVersion: 5
    })
    expect(pendingSummary).toMatchObject({
      kind: 'INITIATIVE_DECLARATION',
      occurrenceId,
      occurrenceVersion: 4,
      encounterVersion: 5,
      actorId: actorA,
      requestId: 'kernel-speed-factor-declaration',
      primaryOptions,
      bonusOptions,
      adjudicationFields: []
    })
  })

  it('round-trips a primary score pause without persisting fact bindings', () => {
    const entities = [entity('ACTOR', actorA), entity('ACTOR', actorB)]
    const pending: PendingEncounterInitiativeLifecycle = {
      phase: 'PRIMARY_SCORE',
      scoreBatch: {
        kind: 'PENDING',
        completed: [],
        current: entities[0]!,
        remaining: [entities[1]!],
        continuation: continuation('initiative-score', 1, 20)
      }
    }
    const pendingSnapshot = {
      ...createEncounterInitiativePendingSnapshot({ root, pending }),
      optionalCombatSnapshotChecksum: 'a'.repeat(64)
    }

    expect(JSON.stringify(pendingSnapshot.applicationContext)).not.toContain('binding')
    expect(JSON.stringify(pendingSnapshot.applicationContext)).not.toContain('continuation')
    expect(
      projectEncounterInitiativePendingSummary({
        pendingSnapshot,
        occurrenceVersion: 2,
        encounterVersion: 3
      })
    ).toEqual({
      kind: 'INITIATIVE_EVIDENCE',
      occurrenceId,
      occurrenceVersion: 2,
      encounterVersion: 3,
      request: { requestId: 'initiative-score', min: 1, max: 20 },
      allowedResponses: ['ENTER_INTEGER', 'SYSTEM_ROLL']
    })

    const restored = restoreEncounterInitiativePending({ pendingSnapshot, entities })
    expect(restored.root).toEqual(root)
    expect(restored.pending).toMatchObject({
      phase: 'PRIMARY_SCORE',
      scoreBatch: {
        current: entities[0],
        remaining: [entities[1]],
        continuation: { request: { requestId: 'initiative-score' } }
      }
    })
    expect(() =>
      restoreEncounterInitiativePending({ pendingSnapshot, entities: [entities[0]!] })
    ).toThrow('exact locked entity cohort')
  })

  it('retains a tied subgroup while rebinding only its current score batch', () => {
    const entities = [entity('ACTOR', actorA), entity('ACTOR', actorB)]
    const pending: PendingEncounterInitiativeLifecycle = {
      phase: 'TIE_RESOLUTION',
      primaryResults: entities.map(unavailableResult),
      tieResolution: {
        kind: 'PENDING',
        completedAttempts: [
          {
            originalScore: 12,
            attemptOrdinal: 1,
            results: entities.map(unavailableResult)
          }
        ],
        completedSegments: [],
        currentOriginalGroup: {
          score: 12,
          members: entities.map(({ kind, id }) => ({ kind, id })),
          classification: 'TIED'
        },
        attemptOrdinal: 2,
        pendingScoreBatch: {
          kind: 'PENDING',
          completed: [],
          current: entities[0]!,
          remaining: [entities[1]!],
          continuation: continuation('initiative-tie', 1, 20)
        },
        laterOriginalGroups: []
      }
    }
    const pendingSnapshot = createEncounterInitiativePendingSnapshot({ root, pending })
    const restored = restoreEncounterInitiativePending({ pendingSnapshot, entities })

    expect(restored.pending).toMatchObject({
      phase: 'TIE_RESOLUTION',
      tieResolution: {
        completedAttempts: [{ originalScore: 12, attemptOrdinal: 1 }],
        attemptOrdinal: 2,
        currentOriginalGroup: { score: 12, classification: 'TIED' },
        pendingScoreBatch: { current: entities[0], remaining: [entities[1]] }
      }
    })
  })

  it('projects an exact actor-order choice and rejects request drift', () => {
    const entities = [entity('ACTOR', actorA), entity('ACTOR', actorB)]
    const pending: PendingEncounterInitiativeLifecycle = {
      phase: 'ENTITY_ORDER',
      evidence: {
        primaryResults: entities.map(unavailableResult),
        tieAttempts: [],
        orderChoices: []
      },
      entityKind: 'ACTOR',
      orderResolution: {
        kind: 'PENDING',
        completedEntities: [],
        completedTieResults: [],
        completedChoices: [],
        currentSegment: {
          kind: 'ORDER_CHOICE_REQUIRED',
          score: 0,
          members: entities.map(({ kind, id }) => ({ kind, id }))
        },
        selectedFromCurrent: [],
        remainingCurrent: entities.map(({ kind, id }) => ({ kind, id })),
        continuation: continuation('initiative-order', 0, 1),
        laterSegments: []
      }
    }
    const pendingSnapshot = createEncounterInitiativePendingSnapshot({ root, pending })

    expect(
      projectEncounterInitiativePendingSummary({
        pendingSnapshot,
        occurrenceVersion: 3,
        encounterVersion: 3
      })
    ).toEqual({
      kind: 'INITIATIVE_ORDER',
      occurrenceId,
      occurrenceVersion: 3,
      encounterVersion: 3,
      requestId: 'initiative-order',
      entityKind: 'ACTOR',
      optionIds: [actorA, actorB],
      allowedResponses: ['INITIATIVE_ENTITY']
    })
    expect(restoreEncounterInitiativePending({ pendingSnapshot, entities }).pending).toMatchObject({
      phase: 'ENTITY_ORDER',
      orderResolution: { remainingCurrent: [{ id: actorA }, { id: actorB }] }
    })

    const drifted = {
      ...pendingSnapshot,
      request: { ...pendingSnapshot.request, max: 2 }
    }
    expect(() =>
      projectEncounterInitiativePendingSummary({
        pendingSnapshot: drifted,
        occurrenceVersion: 3,
        encounterVersion: 3
      })
    ).toThrow('exact remaining entity cohort')
  })

  it('keeps side order separate from the actor order it controls', () => {
    const sideEntities = [entity('SIDE', sideA), entity('SIDE', sideB)]
    const pending: PendingEncounterInitiativeLifecycle = {
      phase: 'SIDE_ACTOR_ORDER',
      evidence: {
        primaryResults: sideEntities.map(unavailableResult),
        tieAttempts: [],
        orderChoices: []
      },
      orderedSideIds: [sideA, sideB],
      orderResolution: {
        kind: 'PENDING',
        completedEntities: [],
        completedTieResults: [],
        completedChoices: [],
        currentSegment: {
          kind: 'ORDER_CHOICE_REQUIRED',
          score: 0,
          members: [
            { kind: 'ACTOR', id: actorA },
            { kind: 'ACTOR', id: actorB }
          ]
        },
        selectedFromCurrent: [],
        remainingCurrent: [
          { kind: 'ACTOR', id: actorA },
          { kind: 'ACTOR', id: actorB }
        ],
        continuation: continuation('side-actor-order', 0, 1),
        laterSegments: []
      }
    }
    const pendingSnapshot = createEncounterInitiativePendingSnapshot({ root, pending })

    expect(
      restoreEncounterInitiativePending({
        pendingSnapshot,
        entities: sideEntities,
        actorIds: [actorA, actorB]
      }).pending
    ).toMatchObject({ phase: 'SIDE_ACTOR_ORDER', orderedSideIds: [sideA, sideB] })
    expect(() =>
      restoreEncounterInitiativePending({ pendingSnapshot, entities: [sideEntities[0]!] })
    ).toThrow('exact side and actor kinds')
  })
})
