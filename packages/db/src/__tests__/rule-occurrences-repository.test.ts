import { beforeEach, describe, expect, it, vi } from 'vitest'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import {
  serverAggregateChoicePendingSnapshotDtoSchema,
  serverKernelRuleExecutionPendingSnapshotDtoSchema,
  serverRuleExecutionPendingSnapshotDtoSchema,
  type ServerAggregateChoicePendingSnapshotDto,
  type ServerKernelRuleExecutionPendingSnapshotDto,
  type ServerRuleExecutionPendingSnapshotDto
} from '@artificer-toolkit/schema/shared/rulesExecution'

import type { DBLike } from '../types/index.js'
import { checksumCanonicalJson } from '../utils/canonicalJson.js'

const sqlState = vi.hoisted(() => ({
  rows: [] as Array<Array<Record<string, unknown>>>,
  queries: [] as string[]
}))

vi.mock('kysely', () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    text: strings
      .map((piece, index) => `${piece}${index < values.length ? String(values[index]) : ''}`)
      .join(''),
    execute: async () => {
      sqlState.queries.push(
        strings
          .map((piece, index) => `${piece}${index < values.length ? String(values[index]) : ''}`)
          .join('')
      )
      return { rows: sqlState.rows.shift() ?? [] }
    }
  })
}))

import {
  createRuleOccurrenceRepository,
  validateRuleOccurrenceReceiptEnvelope,
  type RuleOccurrenceReceipt
} from '../repositories/ruleOccurrences.js'

const ids = {
  aggregate: '00000000-0000-4000-8000-000000000001',
  command: '00000000-0000-4000-8000-000000000002',
  occurrence: '00000000-0000-4000-8000-000000000003',
  actor: '00000000-0000-4000-8000-000000000004'
}
const timestamp = '2026-08-25T00:00:00.000Z'

function pendingSnapshot(requestId = 'pending-roll'): ServerKernelRuleExecutionPendingSnapshotDto {
  return {
    snapshotKind: 'KERNEL_EVIDENCE',
    schemaVersion: 1 as const,
    occurrenceId: ids.occurrence,
    graph: {
      schemaVersion: 1,
      source: {
        definitionId: ids.aggregate,
        gameSystemId: ids.actor,
        definitionFamilyKey: 'test-resolution',
        checksum: 'a'.repeat(64)
      },
      capabilityContractVersion: 1,
      factContracts: [],
      nodes: [{ id: 'roll', operation: { key: 'test.roll', contractVersion: 1 }, inputs: {} }],
      outputs: { result: { kind: 'NODE_OUTPUT', nodeId: 'roll', port: 'value' } }
    },
    facts: {},
    nextNodeIndex: 0,
    nodeOutputs: {},
    trace: [],
    request: {
      requestId,
      kind: 'INTEGER_RANGE' as const,
      nodeId: 'roll',
      ordinal: 0,
      min: 1,
      max: 20
    },
    authority: 'APPLICATION_SERVICE' as const,
    redaction: 'SERVER_ONLY' as const,
    seal: 'a'.repeat(64),
    applicationContext: { kind: 'NONE' as const }
  }
}

function turnPendingSnapshot(): ServerKernelRuleExecutionPendingSnapshotDto {
  return serverKernelRuleExecutionPendingSnapshotDtoSchema.parse({
    ...pendingSnapshot(),
    applicationContext: {
      kind: 'ENCOUNTER_TURN_ACTIVE_EFFECTS',
      schemaVersion: 1,
      root: {
        rootCommandId: ids.command,
        commandFingerprint: 'a'.repeat(64),
        commandType: 'START',
        initiatorUserId: ids.actor,
        correlationId: null,
        expectedEncounterVersion: 1,
        startSystemId: null,
        frozenActorRuleRevisionId: ids.actor,
        frozenActorRuleRevisionChecksum: 'b'.repeat(64),
        frozenActorRuleSnapshotChecksum: 'c'.repeat(64),
        proposedTerminalTransition: { status: 'ACTIVE', round: 1, currentActorId: ids.actor },
        resolutionCommands: []
      },
      selectionChecksum: 'd'.repeat(64),
      currentCandidate: {
        ordinal: 0,
        boundaryOrdinal: 0,
        stage: 'START_OF_TURN',
        targetActorId: ids.actor,
        owner: { kind: 'ENCOUNTER_ACTOR' },
        activeEffectId: ids.occurrence,
        createdOrdinal: 1,
        effectVersion: 1,
        definitionChecksum: 'e'.repeat(64),
        lifecycleChecksum: 'f'.repeat(64),
        targetStateChecksum: '1'.repeat(64),
        d20Policy: null
      },
      completedExecutions: [],
      remainingCandidates: []
    }
  })
}

function legendaryChoicePendingSnapshot(): ServerAggregateChoicePendingSnapshotDto {
  const kernel = turnPendingSnapshot()
  if (kernel.applicationContext.kind !== 'ENCOUNTER_TURN_ACTIVE_EFFECTS') {
    throw new Error('Expected the fixture to retain kernel turn evidence.')
  }
  return serverAggregateChoicePendingSnapshotDtoSchema.parse({
    snapshotKind: 'AGGREGATE_CHOICE',
    schemaVersion: 1,
    occurrenceId: ids.occurrence,
    applicationContext: {
      kind: 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE',
      schemaVersion: 1,
      root: {
        ...kernel.applicationContext.root,
        commandType: 'ADVANCE_TURN',
        outgoingTurn: { kind: 'NONE' }
      },
      choice: {
        ownerActorId: ids.actor,
        options: [
          {
            optionId: '3'.repeat(64),
            ownerActorId: ids.actor,
            ownerFeatureId: ids.aggregate,
            actionId: 'legendary:self-action',
            targetActorId: ids.actor,
            actionSourceChecksum: '4'.repeat(64),
            chargeId: ids.command,
            featureCost: 1,
            poolBefore: 3,
            poolRemaining: 2,
            lifecycle: {
              definitionId: ids.aggregate,
              definitionVersion: 1,
              definitionChecksum: '5'.repeat(64),
              eligibilityGraphDefinitionId: ids.actor,
              eligibilityGraphDefinitionVersion: 1,
              eligibilityGraphDefinitionChecksum: '6'.repeat(64),
              eligibleOutput: 'eligible'
            },
            eligibilityEvidenceChecksum: '7'.repeat(64)
          }
        ]
      },
      selectionChecksum: checksumCanonicalJson({
        ownerActorId: ids.actor,
        options: [
          {
            optionId: '3'.repeat(64),
            ownerActorId: ids.actor,
            ownerFeatureId: ids.aggregate,
            actionId: 'legendary:self-action',
            targetActorId: ids.actor,
            actionSourceChecksum: '4'.repeat(64),
            chargeId: ids.command,
            featureCost: 1,
            poolBefore: 3,
            poolRemaining: 2,
            lifecycle: {
              definitionId: ids.aggregate,
              definitionVersion: 1,
              definitionChecksum: '5'.repeat(64),
              eligibilityGraphDefinitionId: ids.actor,
              eligibilityGraphDefinitionVersion: 1,
              eligibilityGraphDefinitionChecksum: '6'.repeat(64),
              eligibleOutput: 'eligible'
            },
            eligibilityEvidenceChecksum: '7'.repeat(64)
          }
        ]
      })
    }
  })
}

function pendingOccurrenceRow(
  snapshot: ServerRuleExecutionPendingSnapshotDto = pendingSnapshot(),
  version = 0
) {
  return {
    id: ids.occurrence,
    character_id: ids.aggregate,
    root_command_id: ids.command,
    state: 'PENDING',
    version,
    expected_stream_version: 1,
    pending_snapshot: snapshot,
    pending_snapshot_checksum: checksumCanonicalJson(snapshot),
    completed_at: null,
    created_at: timestamp,
    updated_at: timestamp
  }
}

function encounterPendingOccurrenceRow(
  snapshot: ServerRuleExecutionPendingSnapshotDto,
  version = 0
) {
  return {
    id: ids.occurrence,
    encounter_id: ids.aggregate,
    root_command_id: ids.command,
    state: 'PENDING',
    version,
    expected_encounter_version: 1,
    pending_snapshot: snapshot,
    pending_snapshot_checksum: checksumCanonicalJson(snapshot),
    completed_at: null,
    created_at: timestamp,
    updated_at: timestamp
  }
}

function encounterDb(optionalCombatSnapshotChecksum: string | null): DBLike {
  return {
    selectFrom: () => ({
      selectAll: () => ({
        where: () => ({
          executeTakeFirst: async () => ({
            optional_combat_snapshot_checksum: optionalCombatSnapshotChecksum
          })
        })
      })
    })
  } as unknown as DBLike
}

function initiativeSettlement() {
  return {
    round: 1,
    procedure: 'ACTOR_SCORE' as const,
    cadence: 'ENCOUNTER_START' as const,
    policySnapshotChecksum: 'd'.repeat(64),
    orderedActorIds: [ids.actor],
    orderedSideIds: [],
    evidence: {
      primaryResults: [
        {
          entity: { kind: 'ACTOR' as const, id: ids.actor },
          result: { kind: 'FACTS_UNAVAILABLE' as const }
        }
      ],
      tieAttempts: [],
      orderChoices: []
    }
  }
}

function batchReceipt(): RuleOccurrenceReceipt {
  const before = {
    currentHitPoints: 10,
    temporaryHitPoints: 0,
    maximumHitPoints: 10,
    scalarValues: {},
    conditionIds: []
  }
  const conditionId = '00000000-0000-4000-8000-000000000005'
  const after = { ...before, conditionIds: [conditionId] }
  const targetChecksum = checksumCanonicalJson({ targetActorId: ids.actor, ...before })
  const beforeLifecycleChecksum = checksumCanonicalJson({ schemaVersion: 1, remainingTicks: 2 })
  const afterLifecycleChecksum = checksumCanonicalJson({ schemaVersion: 1, remainingTicks: 1 })
  return {
    aggregateKind: 'ENCOUNTER',
    aggregateId: ids.aggregate,
    commandId: ids.command,
    commandFingerprint: 'a'.repeat(64),
    occurrenceId: ids.occurrence,
    aggregateVersion: 2,
    commandMetadata: {
      schemaVersion: 1,
      transition: 'TURN_EFFECTS',
      commandType: 'START',
      expectedAggregateVersion: 1,
      selectionChecksum: 'a'.repeat(64),
      initiativeChecksum: null,
      initiativeAdvanceChecksum: null,
      terminalOccurrenceVersion: 0,
      resolutionCommands: []
    },
    resultPayload: {
      status: 'BATCH_COMPLETE',
      batchKind: 'ENCOUNTER_TURN_ACTIVE_EFFECTS',
      schemaVersion: 1,
      occurrenceId: ids.occurrence,
      occurrenceVersion: 0,
      encounterId: ids.aggregate,
      commandType: 'START',
      initiative: null,
      initiativeAdvance: null,
      rechargeExecutions: [],
      executions: [
        {
          ordinal: 0,
          boundaryOrdinal: 0,
          stage: 'START_OF_TURN',
          targetActorId: ids.actor,
          owner: { kind: 'CHARACTER', characterId: ids.aggregate },
          activeEffectId: '00000000-0000-4000-8000-000000000006',
          createdOrdinal: 1,
          beforeVersion: 1,
          definition: {
            authoredEffectId: ids.actor,
            compiledEntryId: '00000000-0000-4000-8000-000000000007',
            frozenGraphNodeId: 'effect-node',
            frozenSourceChecksum: 'a'.repeat(64),
            capabilityContractVersion: 1,
            definitionChecksum: 'b'.repeat(64)
          },
          execution: {
            status: 'COMPLETE',
            outputs: {},
            movementInterruption: null,
            evidence: {
              source: {
                definitionId: ids.actor,
                gameSystemId: ids.aggregate,
                definitionFamilyKey: 'effect',
                checksum: 'a'.repeat(64)
              },
              capabilityContractVersion: 1,
              facts: {},
              sourceEntryBindings: [
                {
                  sourceEntryId: '00000000-0000-4000-8000-000000000007',
                  nodeId: 'effect-node'
                }
              ],
              trace: [
                {
                  nodeId: 'effect-node',
                  operation: { key: 'effect.apply', contractVersion: 1 },
                  inputs: {},
                  outputs: {
                    targetActorId: ids.actor,
                    conditionId,
                    resolvedPath: 'START_OF_TURN',
                    applicationCandidate: true,
                    authorized: true,
                    targetStateChecksum: targetChecksum
                  }
                }
              ],
              outputs: {}
            }
          },
          d20: null,
          targetTransition: { checksum: targetChecksum, before, after },
          applications: [
            {
              ordinal: 0,
              kind: 'CONDITION_APPLY',
              conditionId,
              beforePresent: false,
              afterPresent: true,
              applied: true,
              sourceNodeId: 'effect-node',
              sourceOperationKey: 'effect.apply',
              authoredPath: null,
              resolvedPath: 'START_OF_TURN'
            }
          ],
          lifecycle: {
            kind: 'UPDATE',
            expectedVersion: 1,
            afterVersion: 2,
            beforeRemainingTicks: 2,
            afterRemainingTicks: 1,
            beforeLifecycleChecksum,
            afterLifecycleChecksum
          }
        }
      ],
      characterTransitions: [
        {
          characterId: ids.aggregate,
          targetActorId: ids.actor,
          beforeStreamVersion: 1,
          afterStreamVersion: 2,
          before,
          after
        }
      ],
      encounterActorTransitions: []
    },
    actorUserId: ids.actor,
    correlationId: null,
    commandType: 'START'
  }
}

function spatialBatchReceipt(): RuleOccurrenceReceipt {
  const targetState = {
    currentHitPoints: 10,
    temporaryHitPoints: 0,
    maximumHitPoints: 10,
    scalarValues: {},
    conditionIds: []
  }
  const sceneId = '00000000-0000-4000-8000-000000000008'
  const tokenId = '00000000-0000-4000-8000-000000000009'
  const effectId = '00000000-0000-4000-8000-000000000010'
  const sourceId = '00000000-0000-4000-8000-000000000011'
  const entryId = '00000000-0000-4000-8000-000000000012'
  const targetActorId = '00000000-0000-4000-8000-000000000013'
  const characterId = '00000000-0000-4000-8000-000000000014'
  const targetChecksum = '2'.repeat(64)
  return {
    aggregateKind: 'ENCOUNTER',
    aggregateId: ids.aggregate,
    commandId: ids.command,
    commandFingerprint: '3'.repeat(64),
    occurrenceId: ids.occurrence,
    aggregateVersion: 8,
    commandMetadata: {
      schemaVersion: 1,
      transition: 'SPATIAL_MOVEMENT',
      commandType: 'MOVE_SCENE_TOKEN',
      rootCommandId: ids.command,
      rootCommandFingerprint: '3'.repeat(64),
      rootInitiatorUserId: ids.actor,
      rootCorrelationId: null,
      encounterId: ids.aggregate,
      sceneId,
      tokenId,
      movementKind: 'VOLUNTARY',
      expectedEncounterVersion: 7,
      expectedSceneVersion: 3,
      rootExpectedEncounterVersion: 7,
      rootExpectedSceneVersion: 3,
      encounterVersionTransition: 'ADVANCED',
      sceneVersionTransition: 'ADVANCED',
      currentnessChecksum: '4'.repeat(64),
      selectionChecksum: '5'.repeat(64),
      occurrenceVersion: 0,
      changedAggregates: [
        {
          aggregateKind: 'ENCOUNTER',
          aggregateId: ids.aggregate,
          beforeVersion: 7,
          version: 8
        },
        { aggregateKind: 'SCENE', aggregateId: sceneId, beforeVersion: 3, version: 4 }
      ],
      resolutionCommands: []
    },
    resultPayload: {
      status: 'BATCH_COMPLETE',
      batchKind: 'ENCOUNTER_SPATIAL_MOVEMENT',
      schemaVersion: 1,
      occurrenceId: ids.occurrence,
      occurrenceVersion: 0,
      encounterId: ids.aggregate,
      encounterVersion: 8,
      sceneId,
      sceneVersion: 4,
      tokenId,
      movementKind: 'VOLUNTARY',
      reactionExecutions: [],
      terminalPosition: { x: 10, y: 0 },
      executions: [
        {
          ordinal: 0,
          candidate: {
            ordinal: 0,
            candidate: {
              contact: { x: 5, y: 0 },
              effectId,
              pathDistance: 5,
              sourceActorId: sourceId,
              sourceMoved: false,
              targetActorId,
              trigger: 'ENTER'
            },
            effect: {
              effectId,
              version: 2,
              definitionChecksum: 'a'.repeat(64),
              lifecycleChecksum: 'b'.repeat(64),
              placementChecksum: 'c'.repeat(64),
              spatialStateChecksum: 'd'.repeat(64),
              authoredEffectId: sourceId,
              compiledEntryId: entryId,
              frozenGraphNodeId: 'effect',
              frozenSourceChecksum: 'e'.repeat(64),
              capabilityContractVersion: 1,
              activation: 'REPEATABLE',
              revealed: false,
              revealOnTrigger: true
            },
            target: {
              kind: 'CHARACTER',
              characterId,
              streamVersion: 4,
              projectionChecksum: 'f'.repeat(64),
              mechanicalContextChecksum: '1'.repeat(64),
              targetStateChecksum: targetChecksum
            },
            d20Policy: null
          },
          execution: {
            status: 'COMPLETE',
            outputs: {},
            movementInterruption: null,
            evidence: {
              source: {
                definitionId: sourceId,
                gameSystemId: ids.aggregate,
                definitionFamilyKey: 'effect',
                checksum: 'e'.repeat(64)
              },
              capabilityContractVersion: 1,
              facts: {},
              sourceEntryBindings: [{ sourceEntryId: entryId, nodeId: 'effect' }],
              trace: [
                {
                  nodeId: 'effect',
                  operation: { key: 'effect.apply', contractVersion: 1 },
                  inputs: {},
                  outputs: {}
                }
              ],
              outputs: {}
            }
          },
          d20: null,
          targetTransition: { checksum: targetChecksum, before: targetState, after: targetState },
          applications: []
        }
      ],
      spatialEffectTransitions: [
        {
          effectId,
          transition: {
            kind: 'UPDATE',
            expectedVersion: 2,
            afterVersion: 3,
            definitionChecksum: 'a'.repeat(64),
            lifecycleChecksum: 'b'.repeat(64),
            placementChecksum: 'c'.repeat(64),
            beforeSpatialStateChecksum: 'd'.repeat(64),
            afterSpatialStateChecksum: checksumRuleDocument({ schemaVersion: 1, revealed: true }),
            beforeRevealed: false,
            afterRevealed: true
          }
        }
      ],
      characterTransitions: [],
      encounterActorTransitions: []
    },
    actorUserId: ids.actor,
    correlationId: null,
    commandType: 'MOVE_SCENE_TOKEN'
  }
}

describe('rule occurrence repository schema boundary', () => {
  beforeEach(() => {
    sqlState.rows = []
    sqlState.queries = []
  })

  it('rejects malformed pending continuations before write serialization', async () => {
    const repository = createRuleOccurrenceRepository({} as DBLike)
    await expect(
      repository.createPending({
        aggregateKind: 'CHARACTER',
        aggregateId: ids.aggregate,
        occurrenceId: ids.occurrence,
        rootCommandId: ids.command,
        expectedAggregateVersion: 1,
        pendingSnapshot: { occurrenceId: ids.occurrence } as never
      })
    ).rejects.toThrow()
  })

  it('round-trips both pending snapshot arms and rejects cross-arm payloads', async () => {
    const repository = createRuleOccurrenceRepository({} as DBLike)
    const aggregateChoice = legendaryChoicePendingSnapshot()
    sqlState.rows = [[pendingOccurrenceRow(aggregateChoice)]]
    const created = await repository.createPending({
      aggregateKind: 'CHARACTER',
      aggregateId: ids.aggregate,
      occurrenceId: ids.occurrence,
      rootCommandId: ids.command,
      expectedAggregateVersion: 1,
      pendingSnapshot: aggregateChoice
    })
    expect(created.pendingSnapshot).toEqual(aggregateChoice)
    expect(created.pendingSnapshotChecksum).toBe(checksumCanonicalJson(aggregateChoice))

    const kernel = pendingSnapshot()
    const aggregateChoiceContext = aggregateChoice.applicationContext
    if (aggregateChoiceContext.kind !== 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE') {
      throw new Error('Expected Legendary Action aggregate choice fixture.')
    }
    expect(() =>
      serverRuleExecutionPendingSnapshotDtoSchema.parse({
        ...aggregateChoice,
        graph: kernel.graph
      })
    ).toThrow()
    expect(() =>
      serverRuleExecutionPendingSnapshotDtoSchema.parse({
        ...kernel,
        choice: aggregateChoiceContext.choice
      })
    ).toThrow()
  })

  it('writes a canonical pending snapshot checksum on create and advance, then clears it on completion', async () => {
    const repository = createRuleOccurrenceRepository({} as DBLike)
    const initial = pendingSnapshot()
    const advanced = pendingSnapshot('pending-roll-2')
    sqlState.rows = [
      [pendingOccurrenceRow(initial)],
      [pendingOccurrenceRow(advanced, 1)],
      [
        {
          ...pendingOccurrenceRow(advanced, 2),
          state: 'COMPLETED',
          pending_snapshot: null,
          pending_snapshot_checksum: null,
          completed_at: timestamp
        }
      ]
    ]

    const created = await repository.createPending({
      aggregateKind: 'CHARACTER',
      aggregateId: ids.aggregate,
      occurrenceId: ids.occurrence,
      rootCommandId: ids.command,
      expectedAggregateVersion: 1,
      pendingSnapshot: initial
    })
    expect(created.pendingSnapshotChecksum).toBe(checksumCanonicalJson(initial))
    expect(sqlState.queries[0]).toContain('pending_snapshot_checksum')
    expect(sqlState.queries[0]).toContain(checksumCanonicalJson(initial))

    const paused = await repository.advancePending({
      aggregateKind: 'CHARACTER',
      aggregateId: ids.aggregate,
      occurrenceId: ids.occurrence,
      expectedOccurrenceVersion: 0,
      expectedAggregateVersion: 1,
      nextAggregateVersion: 1,
      pendingSnapshot: advanced
    })
    expect(paused.pendingSnapshotChecksum).toBe(checksumCanonicalJson(advanced))
    expect(sqlState.queries[1]).toContain(
      `pending_snapshot_checksum = ${checksumCanonicalJson(advanced)}`
    )

    const completed = await repository.complete({
      aggregateKind: 'CHARACTER',
      aggregateId: ids.aggregate,
      occurrenceId: ids.occurrence,
      expectedOccurrenceVersion: 1,
      expectedAggregateVersion: 1,
      nextAggregateVersion: 2
    })
    expect(completed.pendingSnapshotChecksum).toBeNull()
    expect(sqlState.queries[2]).toContain('pending_snapshot_checksum = NULL')
  })

  it('pins Encounter pending continuations and receipts to the locked optional combat snapshot', async () => {
    const optionalCombatSnapshotChecksum = 'c'.repeat(64)
    const snapshot = {
      ...pendingSnapshot(),
      optionalCombatSnapshotChecksum
    }
    sqlState.rows = [[encounterPendingOccurrenceRow(snapshot)]]
    const repository = createRuleOccurrenceRepository(encounterDb(optionalCombatSnapshotChecksum))

    const pending = await repository.createPending({
      aggregateKind: 'ENCOUNTER',
      aggregateId: ids.aggregate,
      campaignId: ids.actor,
      occurrenceId: ids.occurrence,
      rootCommandId: ids.command,
      expectedAggregateVersion: 1,
      pendingSnapshot: pendingSnapshot()
    })
    expect(pending.pendingSnapshot).toMatchObject({ optionalCombatSnapshotChecksum })

    const receipt = batchReceipt()
    await repository.appendReceipt(receipt)
    expect(sqlState.queries.at(-1)).toContain(optionalCombatSnapshotChecksum)
  })

  it('rejects an Encounter pending continuation when its optional combat snapshot pin is stale', async () => {
    const snapshot = {
      ...pendingSnapshot(),
      optionalCombatSnapshotChecksum: 'a'.repeat(64)
    }
    sqlState.rows = [[encounterPendingOccurrenceRow(snapshot)]]
    const repository = createRuleOccurrenceRepository(encounterDb('b'.repeat(64)))

    await expect(
      repository.lockOccurrence('ENCOUNTER', ids.aggregate, ids.occurrence)
    ).rejects.toThrow('optional combat policy changed')
  })

  it('retains a completed Encounter receipt pin after a later optional combat override', async () => {
    const beforeOverrideChecksum = 'a'.repeat(64)
    const afterOverrideChecksum = 'b'.repeat(64)
    const receipt = {
      ...batchReceipt(),
      commandMetadata: {
        ...batchReceipt().commandMetadata,
        optionalCombatSnapshotChecksum: beforeOverrideChecksum
      }
    }
    sqlState.rows = [
      [
        {
          encounter_id: receipt.aggregateId,
          command_id: receipt.commandId,
          command_type: receipt.commandType,
          command_fingerprint: receipt.commandFingerprint,
          occurrence_id: receipt.occurrenceId,
          encounter_version: receipt.aggregateVersion,
          command_metadata: receipt.commandMetadata,
          result_payload: receipt.resultPayload,
          actor_user_id: receipt.actorUserId,
          correlation_id: receipt.correlationId
        }
      ]
    ]
    const repository = createRuleOccurrenceRepository(encounterDb(afterOverrideChecksum))

    const replay = await repository.findReceipt('ENCOUNTER', receipt.aggregateId, receipt.commandId)

    expect(replay?.commandMetadata).toMatchObject({
      optionalCombatSnapshotChecksum: beforeOverrideChecksum
    })
  })

  it('rejects a readable pending snapshot whose stored checksum does not bind its canonical payload', async () => {
    const repository = createRuleOccurrenceRepository({} as DBLike)
    sqlState.rows = [[{ ...pendingOccurrenceRow(), pending_snapshot_checksum: 'b'.repeat(64) }]]
    await expect(
      repository.lockOccurrence('CHARACTER', ids.aggregate, ids.occurrence)
    ).rejects.toThrow('pending snapshot checksum')
  })

  it('rejects malformed receipt metadata and stored results before insert', async () => {
    const repository = createRuleOccurrenceRepository({} as DBLike)
    const base = {
      aggregateKind: 'CHARACTER' as const,
      aggregateId: ids.aggregate,
      commandId: ids.command,
      commandFingerprint: 'a'.repeat(64),
      occurrenceId: ids.occurrence,
      aggregateVersion: 1,
      actorUserId: ids.actor,
      correlationId: null,
      commandType: 'RULE_EXECUTION_START'
    }
    await expect(
      repository.appendReceipt({
        ...base,
        commandMetadata: { transition: 'START' } as never,
        resultPayload: { status: 'PAUSED' } as never
      })
    ).rejects.toThrow()
    await expect(
      repository.appendReceipt({
        ...base,
        commandMetadata: {
          schemaVersion: 1,
          transition: 'START',
          definitionId: ids.aggregate,
          expectedAggregateVersion: 0,
          factsChecksum: 'a'.repeat(64)
        },
        resultPayload: { status: 'PAUSED' } as never
      })
    ).rejects.toThrow()
  })

  it('rejects malformed continuation, metadata, and result JSON when reading', async () => {
    const repository = createRuleOccurrenceRepository({} as DBLike)
    sqlState.rows = [
      [
        {
          id: ids.occurrence,
          character_id: ids.aggregate,
          root_command_id: ids.command,
          state: 'PENDING',
          version: 0,
          expected_stream_version: 1,
          pending_snapshot: { occurrenceId: ids.occurrence },
          completed_at: null,
          created_at: timestamp,
          updated_at: timestamp
        }
      ],
      [
        {
          character_id: ids.aggregate,
          command_id: ids.command,
          command_fingerprint: 'a'.repeat(64),
          rule_occurrence_id: ids.occurrence,
          stream_version: 1,
          event_data: { transition: 'START' },
          result_payload: { status: 'PAUSED' },
          actor_id: ids.actor,
          correlation_id: null
        }
      ]
    ]
    await expect(
      repository.lockOccurrence('CHARACTER', ids.aggregate, ids.occurrence)
    ).rejects.toThrow()
    await expect(repository.findReceipt('CHARACTER', ids.aggregate, ids.command)).rejects.toThrow()
  })

  it('rejects malformed or checksum-mismatched frozen actor-rule sources before a turn occurrence can resume', async () => {
    const repository = createRuleOccurrenceRepository({} as DBLike)
    const valid = turnPendingSnapshot()
    const malformed = {
      ...valid,
      applicationContext: {
        ...valid.applicationContext,
        root: {
          ...(valid.applicationContext.kind === 'ENCOUNTER_TURN_ACTIVE_EFFECTS'
            ? valid.applicationContext.root
            : {}),
          frozenActorRuleRevisionChecksum: null
        }
      }
    }
    sqlState.rows = [[pendingOccurrenceRow(malformed as ServerRuleExecutionPendingSnapshotDto)]]
    await expect(
      repository.lockOccurrence('CHARACTER', ids.aggregate, ids.occurrence)
    ).rejects.toThrow()

    const mismatched = {
      ...valid,
      applicationContext: {
        ...valid.applicationContext,
        root: {
          ...(valid.applicationContext.kind === 'ENCOUNTER_TURN_ACTIVE_EFFECTS'
            ? valid.applicationContext.root
            : {}),
          frozenActorRuleSnapshotChecksum: '2'.repeat(64)
        }
      }
    } as ServerRuleExecutionPendingSnapshotDto
    sqlState.rows = [
      [
        {
          ...pendingOccurrenceRow(mismatched),
          pending_snapshot_checksum: checksumCanonicalJson(valid)
        }
      ]
    ]
    await expect(
      repository.lockOccurrence('CHARACTER', ids.aggregate, ids.occurrence)
    ).rejects.toThrow('checksum')
  })

  it('rejects invalid TURN_EFFECTS manual and nonterminal envelopes', () => {
    const base: Omit<RuleOccurrenceReceipt, 'resultPayload'> = {
      aggregateKind: 'ENCOUNTER',
      aggregateId: ids.aggregate,
      commandId: ids.command,
      commandFingerprint: 'a'.repeat(64),
      occurrenceId: ids.occurrence,
      aggregateVersion: 2,
      commandMetadata: {
        schemaVersion: 1,
        transition: 'TURN_EFFECTS',
        commandType: 'START',
        expectedAggregateVersion: 1,
        selectionChecksum: 'a'.repeat(64),
        initiativeChecksum: null,
        initiativeAdvanceChecksum: null,
        terminalOccurrenceVersion: 0,
        resolutionCommands: []
      },
      actorUserId: ids.actor,
      correlationId: null,
      commandType: 'START'
    }
    expect(() =>
      validateRuleOccurrenceReceiptEnvelope({
        ...base,
        resultPayload: {
          status: 'MANUAL',
          occurrenceId: ids.command,
          occurrenceVersion: 0,
          reminder: { kind: 'MANUAL_RULE_REVIEW' },
          initiative: null,
          initiativeAdvance: null
        }
      })
    ).toThrow()
    expect(() =>
      validateRuleOccurrenceReceiptEnvelope({
        ...base,
        resultPayload: {
          status: 'MANUAL',
          occurrenceId: ids.occurrence,
          occurrenceVersion: 1,
          reminder: { kind: 'MANUAL_RULE_REVIEW' },
          initiative: null,
          initiativeAdvance: null
        }
      })
    ).toThrow()
    expect(() =>
      validateRuleOccurrenceReceiptEnvelope({
        ...base,
        resultPayload: {
          status: 'PAUSED',
          occurrenceId: ids.occurrence,
          occurrenceVersion: 0,
          request: {
            requestId: 'request-1',
            kind: 'INTEGER_RANGE',
            nodeId: 'roll',
            ordinal: 0,
            min: 1,
            max: 20
          }
        }
      })
    ).toThrow()
    expect(() =>
      validateRuleOccurrenceReceiptEnvelope({
        ...base,
        resultPayload: {
          status: 'COMPLETE',
          occurrenceId: ids.occurrence,
          occurrenceVersion: 0,
          outputs: {},
          evidence: {
            source: {
              definitionId: ids.aggregate,
              gameSystemId: ids.aggregate,
              definitionFamilyKey: 'effect',
              checksum: 'a'.repeat(64)
            },
            capabilityContractVersion: 1,
            facts: {},
            trace: [],
            outputs: {}
          },
          applicationOutputs: { kind: 'NONE' }
        }
      })
    ).toThrow()
  })

  it('validates initiative-only turn lifecycle receipts and exact evidence checksums', () => {
    const initiative = initiativeSettlement()
    const receipt: RuleOccurrenceReceipt = {
      aggregateKind: 'ENCOUNTER',
      aggregateId: ids.aggregate,
      commandId: ids.command,
      commandFingerprint: 'a'.repeat(64),
      occurrenceId: ids.occurrence,
      aggregateVersion: 2,
      commandMetadata: {
        schemaVersion: 1,
        transition: 'TURN_EFFECTS',
        commandType: 'START',
        expectedAggregateVersion: 1,
        selectionChecksum: null,
        initiativeChecksum: checksumCanonicalJson(initiative),
        initiativeAdvanceChecksum: null,
        terminalOccurrenceVersion: 0,
        resolutionCommands: []
      },
      resultPayload: {
        status: 'INITIATIVE_COMPLETE',
        schemaVersion: 1,
        occurrenceId: ids.occurrence,
        occurrenceVersion: 0,
        encounterId: ids.aggregate,
        commandType: 'START',
        initiative,
        initiativeAdvance: null
      },
      actorUserId: ids.actor,
      correlationId: null,
      commandType: 'START'
    }

    expect(validateRuleOccurrenceReceiptEnvelope(receipt)).toBe(receipt)
    const metadata = receipt.commandMetadata
    if (metadata.transition !== 'TURN_EFFECTS') throw new Error('Expected turn-effect metadata.')
    expect(() =>
      validateRuleOccurrenceReceiptEnvelope({
        ...receipt,
        commandMetadata: {
          ...metadata,
          initiativeChecksum: 'e'.repeat(64)
        }
      })
    ).toThrow('initiative evidence')
  })

  it('validates initiative advancement receipts without requiring a turn-effect batch', () => {
    const initiativeAdvance = {
      kind: 'SAME_ROUND' as const,
      round: 1,
      stateChecksum: 'b'.repeat(64),
      currentActorId: ids.actor,
      nextActorId: ids.command
    }
    const receipt: RuleOccurrenceReceipt = {
      aggregateKind: 'ENCOUNTER',
      aggregateId: ids.aggregate,
      commandId: ids.command,
      commandFingerprint: 'a'.repeat(64),
      occurrenceId: ids.occurrence,
      aggregateVersion: 2,
      commandMetadata: {
        schemaVersion: 1,
        transition: 'TURN_EFFECTS',
        commandType: 'ADVANCE_TURN',
        expectedAggregateVersion: 1,
        selectionChecksum: null,
        initiativeChecksum: null,
        initiativeAdvanceChecksum: checksumCanonicalJson(initiativeAdvance),
        terminalOccurrenceVersion: 0,
        resolutionCommands: []
      },
      resultPayload: {
        status: 'INITIATIVE_COMPLETE',
        schemaVersion: 1,
        occurrenceId: ids.occurrence,
        occurrenceVersion: 0,
        encounterId: ids.aggregate,
        commandType: 'ADVANCE_TURN',
        initiative: null,
        initiativeAdvance
      },
      actorUserId: ids.actor,
      correlationId: null,
      commandType: 'ADVANCE_TURN'
    }

    expect(validateRuleOccurrenceReceiptEnvelope(receipt)).toBe(receipt)
    const metadata = receipt.commandMetadata
    if (metadata.transition !== 'TURN_EFFECTS') throw new Error('Expected turn-effect metadata.')
    expect(() =>
      validateRuleOccurrenceReceiptEnvelope({
        ...receipt,
        commandMetadata: {
          ...metadata,
          initiativeAdvanceChecksum: 'e'.repeat(64)
        }
      })
    ).toThrow('initiative advancement evidence')
  })

  it('validates a pending Recharge turn-control receipt without retaining execution context', () => {
    const receipt: RuleOccurrenceReceipt = {
      aggregateKind: 'ENCOUNTER',
      aggregateId: ids.aggregate,
      commandId: ids.command,
      commandFingerprint: 'a'.repeat(64),
      occurrenceId: ids.occurrence,
      aggregateVersion: 1,
      commandMetadata: {
        schemaVersion: 1,
        transition: 'TURN_EFFECTS_PENDING',
        commandType: 'RESOLVE_RULE_OCCURRENCE',
        rootCommandId: '00000000-0000-4000-8000-000000000010',
        rootCommandFingerprint: 'b'.repeat(64),
        rootInitiatorUserId: ids.actor,
        rootCorrelationId: null,
        expectedAggregateVersion: 1,
        occurrenceVersion: 1,
        resolutionCommand: {
          commandId: ids.command,
          commandFingerprint: 'a'.repeat(64),
          actorUserId: ids.actor,
          correlationId: null,
          expectedOccurrenceVersion: 0,
          requestId: 'recharge-d6',
          kind: 'ENTER_INTEGER'
        }
      },
      resultPayload: {
        status: 'ENCOUNTER_OCCURRENCE_PENDING',
        schemaVersion: 1,
        occurrenceId: ids.occurrence,
        occurrenceVersion: 1,
        encounterId: ids.aggregate,
        encounterVersion: 1,
        characterTransitions: [],
        occurrence: {
          occurrenceId: ids.occurrence,
          occurrenceVersion: 1,
          status: 'PENDING',
          outcome: null,
          pending: {
            kind: 'RECHARGE_EVIDENCE',
            occurrenceId: ids.occurrence,
            occurrenceVersion: 1,
            encounterVersion: 1,
            request: { requestId: 'recharge-d6', min: 1, max: 6 },
            allowedResponses: ['ENTER_INTEGER', 'SYSTEM_ROLL']
          }
        }
      },
      actorUserId: ids.actor,
      correlationId: null,
      commandType: 'RESOLVE_RULE_OCCURRENCE'
    }

    expect(validateRuleOccurrenceReceiptEnvelope(receipt)).toBe(receipt)

    const malformed = structuredClone(receipt)
    if (malformed.commandMetadata.transition === 'TURN_EFFECTS_PENDING')
      malformed.commandMetadata.resolutionCommand.expectedOccurrenceVersion = 1
    expect(() => validateRuleOccurrenceReceiptEnvelope(malformed)).toThrow(
      'Pending turn-effect rule receipt'
    )
  })

  it('validates composite each-round lifecycle receipts and their exact phase checksum', () => {
    const initiativeAdvance = {
      kind: 'ROUND_WRAP' as const,
      round: 1,
      nextRound: 2,
      cadence: 'EACH_ROUND' as const,
      stateChecksum: 'b'.repeat(64),
      currentActorId: ids.actor,
      firstActorId: null,
      orderedActorIds: [ids.actor],
      orderedSideIds: []
    }
    const initiative = {
      ...initiativeSettlement(),
      round: 2,
      cadence: 'EACH_ROUND' as const
    }
    const result = {
      status: 'TURN_LIFECYCLE_COMPLETE' as const,
      schemaVersion: 1 as const,
      occurrenceId: ids.occurrence,
      occurrenceVersion: 1,
      encounterId: ids.aggregate,
      commandType: 'ADVANCE_TURN' as const,
      initiativeAdvance,
      initiative,
      rechargeExecutions: [],
      legendaryActionRefreshes: [],
      outgoingTurn: { kind: 'NONE' as const, selectionChecksum: null },
      legendaryActions: [],
      incomingTurn: { kind: 'NONE' as const, selectionChecksum: null }
    }
    const receipt: RuleOccurrenceReceipt = {
      aggregateKind: 'ENCOUNTER',
      aggregateId: ids.aggregate,
      commandId: ids.command,
      commandFingerprint: 'a'.repeat(64),
      occurrenceId: ids.occurrence,
      aggregateVersion: 2,
      commandMetadata: {
        schemaVersion: 1,
        transition: 'TURN_EFFECTS',
        commandType: 'ADVANCE_TURN',
        expectedAggregateVersion: 1,
        selectionChecksum: checksumCanonicalJson({ outgoing: null, incoming: null }),
        initiativeChecksum: checksumCanonicalJson(initiative),
        initiativeAdvanceChecksum: checksumCanonicalJson(initiativeAdvance),
        terminalOccurrenceVersion: 1,
        resolutionCommands: []
      },
      resultPayload: result,
      actorUserId: ids.actor,
      correlationId: null,
      commandType: 'ADVANCE_TURN'
    }

    expect(validateRuleOccurrenceReceiptEnvelope(receipt)).toBe(receipt)
    const metadata = receipt.commandMetadata
    if (metadata.transition !== 'TURN_EFFECTS') throw new Error('Expected turn-effect metadata.')
    expect(() =>
      validateRuleOccurrenceReceiptEnvelope({
        ...receipt,
        commandMetadata: {
          ...metadata,
          selectionChecksum: 'e'.repeat(64)
        }
      })
    ).toThrow('Turn lifecycle receipt')
  })

  it('round-trips valid batch receipts and rejects envelope/checksum mutations', async () => {
    const receipt = batchReceipt()
    expect(validateRuleOccurrenceReceiptEnvelope(receipt)).toEqual(receipt)
    const repository = createRuleOccurrenceRepository(encounterDb(null))
    await expect(repository.appendReceipt(receipt)).resolves.toBeUndefined()
    sqlState.rows = [
      [
        {
          encounter_id: receipt.aggregateId,
          command_id: receipt.commandId,
          command_type: receipt.commandType,
          command_fingerprint: receipt.commandFingerprint,
          occurrence_id: receipt.occurrenceId,
          encounter_version: receipt.aggregateVersion,
          command_metadata: receipt.commandMetadata,
          result_payload: receipt.resultPayload,
          actor_user_id: receipt.actorUserId,
          correlation_id: receipt.correlationId
        }
      ]
    ]
    await expect(
      repository.findReceipt('ENCOUNTER', receipt.aggregateId, receipt.commandId)
    ).resolves.toEqual(receipt)
    const invalid = (mutate: (value: RuleOccurrenceReceipt) => void) => {
      const value = structuredClone(receipt)
      mutate(value)
      expect(() => validateRuleOccurrenceReceiptEnvelope(value)).toThrow()
    }
    invalid((value) => {
      value.aggregateId = ids.command
    })
    invalid((value) => {
      if (
        value.resultPayload.status === 'BATCH_COMPLETE' &&
        value.resultPayload.batchKind === 'ENCOUNTER_TURN_ACTIVE_EFFECTS'
      )
        value.resultPayload.occurrenceId = ids.command
    })
    invalid((value) => {
      value.commandType = 'ADVANCE_TURN'
    })
    invalid((value) => {
      value.aggregateVersion = 3
    })
    invalid((value) => {
      if (
        value.resultPayload.status === 'BATCH_COMPLETE' &&
        value.resultPayload.batchKind === 'ENCOUNTER_TURN_ACTIVE_EFFECTS'
      )
        value.resultPayload.executions[0]!.lifecycle.beforeLifecycleChecksum = 'c'.repeat(64)
    })
    invalid((value) => {
      if (
        value.resultPayload.status === 'BATCH_COMPLETE' &&
        value.resultPayload.batchKind === 'ENCOUNTER_TURN_ACTIVE_EFFECTS' &&
        value.resultPayload.executions[0]!.lifecycle.kind === 'UPDATE'
      )
        value.resultPayload.executions[0]!.lifecycle.afterLifecycleChecksum = 'c'.repeat(64)
    })
    const expiry = structuredClone(receipt)
    if (
      expiry.resultPayload.status === 'BATCH_COMPLETE' &&
      expiry.resultPayload.batchKind === 'ENCOUNTER_TURN_ACTIVE_EFFECTS'
    ) {
      expiry.resultPayload.executions[0]!.lifecycle = {
        kind: 'EXPIRE',
        expectedVersion: 1,
        beforeRemainingTicks: 1,
        afterRemainingTicks: 0,
        beforeLifecycleChecksum: checksumCanonicalJson({ schemaVersion: 1, remainingTicks: 1 })
      }
    }
    expect(validateRuleOccurrenceReceiptEnvelope(expiry)).toEqual(expiry)
    if (
      expiry.resultPayload.status === 'BATCH_COMPLETE' &&
      expiry.resultPayload.batchKind === 'ENCOUNTER_TURN_ACTIVE_EFFECTS'
    )
      expiry.resultPayload.executions[0]!.lifecycle.beforeLifecycleChecksum = 'c'.repeat(64)
    expect(() => validateRuleOccurrenceReceiptEnvelope(expiry)).toThrow()
  })

  it('binds terminal Cleaving receipts to their choice response and occurrence', () => {
    const receipt: RuleOccurrenceReceipt = {
      aggregateKind: 'ENCOUNTER',
      aggregateId: ids.aggregate,
      commandId: ids.command,
      commandFingerprint: 'a'.repeat(64),
      occurrenceId: ids.occurrence,
      aggregateVersion: 2,
      commandType: 'RESOLVE_RULE_OCCURRENCE',
      actorUserId: ids.actor,
      correlationId: null,
      commandMetadata: {
        schemaVersion: 1,
        transition: 'OPTIONAL_COMBAT_CLEAVING',
        commandType: 'RESOLVE_RULE_OCCURRENCE',
        expectedAggregateVersion: 1,
        expectedOccurrenceVersion: 0,
        response: { kind: 'OPTION', optionId: 'b'.repeat(64) }
      },
      resultPayload: {
        status: 'AGGREGATE_CHOICE_COMPLETE',
        schemaVersion: 1,
        occurrenceId: ids.occurrence,
        occurrenceVersion: 1,
        applicationOutputs: {
          kind: 'CLEAVING_DAMAGE',
          schemaVersion: 1,
          occurrenceId: ids.occurrence,
          parentOccurrenceId: ids.actor,
          sourceActorId: ids.actor,
          targetActorId: ids.command,
          selectedOptionId: 'b'.repeat(64),
          sealedContextChecksum: 'c'.repeat(64),
          outcome: 'APPLIED',
          damage: {
            sourceNodeId: 'damage',
            sourceOperationKey: 'damage.apply',
            damageTypeId: ids.actor,
            requestedAmount: 5,
            resolvedAmount: 5,
            appliedAmount: 5
          },
          targetTransition: {
            checksum: 'd'.repeat(64),
            before: {
              currentHitPoints: 5,
              temporaryHitPoints: 0,
              maximumHitPoints: 5,
              scalarValues: {},
              conditionIds: []
            },
            after: {
              currentHitPoints: 0,
              temporaryHitPoints: 0,
              maximumHitPoints: 5,
              scalarValues: {},
              conditionIds: []
            }
          }
        }
      }
    }
    expect(validateRuleOccurrenceReceiptEnvelope(receipt)).toBe(receipt)
    const malformed = structuredClone(receipt)
    if (malformed.commandMetadata.transition === 'OPTIONAL_COMBAT_CLEAVING')
      malformed.commandMetadata.response = { kind: 'DECLINE' }
    expect(() => validateRuleOccurrenceReceiptEnvelope(malformed)).toThrow(
      'Optional-combat Cleaving rule receipt'
    )
  })

  it('round-trips spatial movement receipts and rejects mixed receipt envelopes', async () => {
    const receipt = spatialBatchReceipt()
    expect(validateRuleOccurrenceReceiptEnvelope(receipt)).toEqual(receipt)
    const multiTargetReceipt = structuredClone(receipt)
    if (
      multiTargetReceipt.resultPayload.status === 'BATCH_COMPLETE' &&
      multiTargetReceipt.resultPayload.batchKind === 'ENCOUNTER_SPATIAL_MOVEMENT'
    ) {
      const second = structuredClone(multiTargetReceipt.resultPayload.executions[0]!)
      second.ordinal = 1
      second.candidate.ordinal = 1
      second.candidate.candidate.pathDistance = 6
      second.candidate.candidate.contact = { x: 6, y: 0 }
      second.candidate.candidate.targetActorId = '00000000-0000-4000-8000-000000000016'
      if (second.candidate.target.kind === 'CHARACTER')
        second.candidate.target.characterId = '00000000-0000-4000-8000-000000000017'
      multiTargetReceipt.resultPayload.executions.push(second)
    }
    expect(validateRuleOccurrenceReceiptEnvelope(multiTargetReceipt)).toEqual(multiTargetReceipt)
    const resolutionReceipt = structuredClone(receipt)
    resolutionReceipt.commandId = '00000000-0000-4000-8000-000000000015'
    resolutionReceipt.commandFingerprint = '6'.repeat(64)
    resolutionReceipt.commandType = 'RESOLVE_RULE_OCCURRENCE'
    if (resolutionReceipt.commandMetadata.transition === 'SPATIAL_MOVEMENT') {
      resolutionReceipt.commandMetadata.commandType = 'RESOLVE_RULE_OCCURRENCE'
      resolutionReceipt.commandMetadata.occurrenceVersion = 2
      resolutionReceipt.commandMetadata.resolutionCommands = [
        {
          commandId: '00000000-0000-4000-8000-000000000016',
          commandFingerprint: '7'.repeat(64),
          actorUserId: resolutionReceipt.actorUserId,
          correlationId: null,
          expectedOccurrenceVersion: 0,
          requestId: 'pending-roll-one',
          kind: 'ENTER_DICE'
        },
        {
          commandId: resolutionReceipt.commandId,
          commandFingerprint: resolutionReceipt.commandFingerprint,
          actorUserId: resolutionReceipt.actorUserId,
          correlationId: resolutionReceipt.correlationId,
          expectedOccurrenceVersion: 1,
          requestId: 'pending-roll-two',
          kind: 'ENTER_DICE'
        }
      ]
    }
    if (
      resolutionReceipt.resultPayload.status === 'BATCH_COMPLETE' &&
      resolutionReceipt.resultPayload.batchKind === 'ENCOUNTER_SPATIAL_MOVEMENT'
    )
      resolutionReceipt.resultPayload.occurrenceVersion = 2
    expect(validateRuleOccurrenceReceiptEnvelope(resolutionReceipt)).toEqual(resolutionReceipt)
    const priorResolutionIdentity = structuredClone(resolutionReceipt)
    if (priorResolutionIdentity.commandMetadata.transition === 'SPATIAL_MOVEMENT') {
      const prior = priorResolutionIdentity.commandMetadata.resolutionCommands[0]!
      priorResolutionIdentity.commandId = prior.commandId
      priorResolutionIdentity.commandFingerprint = prior.commandFingerprint
      priorResolutionIdentity.actorUserId = prior.actorUserId
      priorResolutionIdentity.correlationId = prior.correlationId
    }
    expect(() => validateRuleOccurrenceReceiptEnvelope(priorResolutionIdentity)).toThrow(
      'resolution receipt identity'
    )
    const repository = createRuleOccurrenceRepository(encounterDb(null))
    await expect(repository.appendReceipt(receipt)).resolves.toBeUndefined()
    sqlState.rows = [
      [
        {
          encounter_id: receipt.aggregateId,
          command_id: receipt.commandId,
          command_type: receipt.commandType,
          command_fingerprint: receipt.commandFingerprint,
          occurrence_id: receipt.occurrenceId,
          encounter_version: receipt.aggregateVersion,
          command_metadata: receipt.commandMetadata,
          result_payload: receipt.resultPayload,
          actor_user_id: receipt.actorUserId,
          correlation_id: receipt.correlationId
        }
      ]
    ]
    await expect(
      repository.findReceipt('ENCOUNTER', receipt.aggregateId, receipt.commandId)
    ).resolves.toEqual(receipt)

    const invalid = (mutate: (value: RuleOccurrenceReceipt) => void) => {
      const value = structuredClone(receipt)
      mutate(value)
      expect(() => validateRuleOccurrenceReceiptEnvelope(value)).toThrow()
    }
    invalid((value) => {
      value.commandMetadata = {
        schemaVersion: 1,
        transition: 'TURN_EFFECTS',
        commandType: 'START',
        expectedAggregateVersion: 7,
        selectionChecksum: 'a'.repeat(64),
        initiativeChecksum: null,
        initiativeAdvanceChecksum: null,
        terminalOccurrenceVersion: 2,
        resolutionCommands: []
      }
    })
    invalid((value) => {
      value.aggregateId = ids.command
    })
    invalid((value) => {
      if (value.commandMetadata.transition === 'SPATIAL_MOVEMENT')
        value.commandMetadata.sceneId = ids.command
    })
    invalid((value) => {
      if (
        value.resultPayload.status === 'BATCH_COMPLETE' &&
        value.resultPayload.batchKind === 'ENCOUNTER_SPATIAL_MOVEMENT'
      )
        value.resultPayload.tokenId = ids.command
    })
    invalid((value) => {
      if (
        value.resultPayload.status === 'BATCH_COMPLETE' &&
        value.resultPayload.batchKind === 'ENCOUNTER_SPATIAL_MOVEMENT'
      )
        value.resultPayload.occurrenceId = ids.command
    })
    invalid((value) => {
      if (
        value.resultPayload.status === 'BATCH_COMPLETE' &&
        value.resultPayload.batchKind === 'ENCOUNTER_SPATIAL_MOVEMENT'
      )
        value.resultPayload.occurrenceVersion = 3
    })
    invalid((value) => {
      if (value.commandMetadata.transition === 'SPATIAL_MOVEMENT')
        value.commandMetadata.changedAggregates.unshift({
          aggregateKind: 'CHARACTER',
          aggregateId: '00000000-0000-4000-8000-000000000014',
          beforeVersion: 1,
          version: 2
        })
    })
    invalid((value) => {
      value.commandType = 'RESOLVE_RULE_OCCURRENCE'
    })
  })

  it('round-trips one closed actor-filtered receipt for every pending spatial resolution command', async () => {
    const root = spatialBatchReceipt()
    if (root.commandMetadata.transition !== 'SPATIAL_MOVEMENT')
      throw new Error('Spatial receipt fixture is invalid.')
    const rootMetadata = root.commandMetadata
    const commandId = '00000000-0000-4000-8000-000000000018'
    const commandFingerprint = '8'.repeat(64)
    const pendingReceipt: RuleOccurrenceReceipt = {
      ...root,
      commandId,
      commandFingerprint,
      commandType: 'RESOLVE_RULE_OCCURRENCE',
      aggregateVersion: 7,
      commandMetadata: {
        ...rootMetadata,
        commandType: 'RESOLVE_RULE_OCCURRENCE',
        expectedEncounterVersion: 7,
        expectedSceneVersion: 3,
        rootExpectedEncounterVersion: 7,
        rootExpectedSceneVersion: 3,
        encounterVersionTransition: 'UNCHANGED',
        sceneVersionTransition: 'UNCHANGED',
        currentnessChecksum: null,
        occurrenceVersion: 1,
        changedAggregates: [],
        resolutionCommands: [
          {
            commandId,
            commandFingerprint,
            actorUserId: root.actorUserId,
            correlationId: root.correlationId,
            expectedOccurrenceVersion: 0,
            kind: 'DECLINE'
          }
        ]
      },
      resultPayload: {
        status: 'ENCOUNTER_OCCURRENCE_PENDING',
        schemaVersion: 1,
        occurrenceId: root.occurrenceId,
        occurrenceVersion: 1,
        encounterId: root.aggregateId,
        encounterVersion: 7,
        characterTransitions: [],
        occurrence: {
          occurrenceId: root.occurrenceId,
          occurrenceVersion: 1,
          status: 'PENDING',
          outcome: null,
          pending: {
            kind: 'D20_EVIDENCE',
            occurrenceId: root.occurrenceId,
            occurrenceVersion: 1,
            encounterVersion: 7,
            request: {
              requestId: 'request-1',
              min: 1,
              max: 20,
              rollMode: 'NORMAL'
            },
            allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
          }
        }
      }
    }

    expect(validateRuleOccurrenceReceiptEnvelope(pendingReceipt)).toEqual(pendingReceipt)

    const rootPendingReceipt = structuredClone(pendingReceipt)
    rootPendingReceipt.commandId = rootMetadata.rootCommandId
    rootPendingReceipt.commandFingerprint = rootMetadata.rootCommandFingerprint
    rootPendingReceipt.commandType = 'MOVE_SCENE_TOKEN'
    rootPendingReceipt.actorUserId = rootMetadata.rootInitiatorUserId
    rootPendingReceipt.correlationId = rootMetadata.rootCorrelationId
    if (
      rootPendingReceipt.commandMetadata.transition === 'SPATIAL_MOVEMENT' &&
      rootPendingReceipt.resultPayload.status === 'ENCOUNTER_OCCURRENCE_PENDING'
    ) {
      rootPendingReceipt.commandMetadata.commandType = 'MOVE_SCENE_TOKEN'
      rootPendingReceipt.commandMetadata.occurrenceVersion = 0
      rootPendingReceipt.commandMetadata.resolutionCommands = []
      rootPendingReceipt.resultPayload.occurrenceVersion = 0
      rootPendingReceipt.resultPayload.occurrence.occurrenceVersion = 0
      if (rootPendingReceipt.resultPayload.occurrence.pending)
        rootPendingReceipt.resultPayload.occurrence.pending.occurrenceVersion = 0
    }
    expect(validateRuleOccurrenceReceiptEnvelope(rootPendingReceipt)).toEqual(rootPendingReceipt)

    const invalidRootPendingReceipt = structuredClone(rootPendingReceipt)
    if (invalidRootPendingReceipt.commandMetadata.transition === 'SPATIAL_MOVEMENT')
      invalidRootPendingReceipt.commandMetadata.resolutionCommands = [
        {
          commandId: ids.command,
          commandFingerprint: '8'.repeat(64),
          actorUserId: root.actorUserId,
          correlationId: root.correlationId,
          expectedOccurrenceVersion: 0,
          kind: 'DECLINE'
        }
      ]
    expect(() => validateRuleOccurrenceReceiptEnvelope(invalidRootPendingReceipt)).toThrow(
      'A root spatial movement receipt must be a fresh occurrence without resolutions'
    )

    const pendingWithCharacterChange = structuredClone(pendingReceipt)
    pendingWithCharacterChange.aggregateVersion = 8
    if (
      pendingWithCharacterChange.commandMetadata.transition === 'SPATIAL_MOVEMENT' &&
      pendingWithCharacterChange.resultPayload.status === 'ENCOUNTER_OCCURRENCE_PENDING'
    ) {
      pendingWithCharacterChange.commandMetadata.encounterVersionTransition = 'ADVANCED'
      pendingWithCharacterChange.commandMetadata.changedAggregates = [
        {
          aggregateKind: 'CHARACTER',
          aggregateId: '00000000-0000-4000-8000-000000000014',
          beforeVersion: 1,
          version: 2
        },
        {
          aggregateKind: 'ENCOUNTER',
          aggregateId: pendingWithCharacterChange.aggregateId,
          beforeVersion: 7,
          version: 8
        }
      ]
      pendingWithCharacterChange.resultPayload.encounterVersion = 8
      pendingWithCharacterChange.resultPayload.characterTransitions = [
        {
          characterId: '00000000-0000-4000-8000-000000000014',
          beforeStreamVersion: 1,
          afterStreamVersion: 2
        }
      ]
      if (pendingWithCharacterChange.resultPayload.occurrence.pending)
        pendingWithCharacterChange.resultPayload.occurrence.pending.encounterVersion = 8
    }
    expect(validateRuleOccurrenceReceiptEnvelope(pendingWithCharacterChange)).toEqual(
      pendingWithCharacterChange
    )

    const missingPendingCharacterChange = structuredClone(pendingWithCharacterChange)
    if (missingPendingCharacterChange.commandMetadata.transition === 'SPATIAL_MOVEMENT')
      missingPendingCharacterChange.commandMetadata.changedAggregates =
        missingPendingCharacterChange.commandMetadata.changedAggregates.filter(
          (aggregate) => aggregate.aggregateKind !== 'CHARACTER'
        )
    expect(() => validateRuleOccurrenceReceiptEnvelope(missingPendingCharacterChange)).toThrow(
      'Pending spatial Character changes'
    )

    const wrongPendingCharacterStart = structuredClone(pendingWithCharacterChange)
    if (wrongPendingCharacterStart.commandMetadata.transition === 'SPATIAL_MOVEMENT')
      wrongPendingCharacterStart.commandMetadata.changedAggregates[0]!.beforeVersion = 0
    expect(() => validateRuleOccurrenceReceiptEnvelope(wrongPendingCharacterStart)).toThrow(
      'Pending spatial Character changes'
    )

    const wrongPendingCharacterFinal = structuredClone(pendingWithCharacterChange)
    if (wrongPendingCharacterFinal.commandMetadata.transition === 'SPATIAL_MOVEMENT')
      wrongPendingCharacterFinal.commandMetadata.changedAggregates[0]!.version = 3
    expect(() => validateRuleOccurrenceReceiptEnvelope(wrongPendingCharacterFinal)).toThrow(
      'Pending spatial Character changes'
    )

    const extraPendingCharacterChange = structuredClone(pendingWithCharacterChange)
    if (extraPendingCharacterChange.resultPayload.status === 'ENCOUNTER_OCCURRENCE_PENDING')
      extraPendingCharacterChange.resultPayload.characterTransitions = []
    expect(() => validateRuleOccurrenceReceiptEnvelope(extraPendingCharacterChange)).toThrow(
      'Pending spatial Character changes'
    )

    const repository = createRuleOccurrenceRepository(encounterDb(null))
    await expect(repository.appendReceipt(pendingReceipt)).resolves.toBeUndefined()
    sqlState.rows = [
      [
        {
          encounter_id: pendingReceipt.aggregateId,
          command_id: pendingReceipt.commandId,
          command_type: pendingReceipt.commandType,
          command_fingerprint: pendingReceipt.commandFingerprint,
          occurrence_id: pendingReceipt.occurrenceId,
          encounter_version: pendingReceipt.aggregateVersion,
          command_metadata: pendingReceipt.commandMetadata,
          result_payload: pendingReceipt.resultPayload,
          actor_user_id: pendingReceipt.actorUserId,
          correlation_id: pendingReceipt.correlationId
        }
      ]
    ]
    await expect(
      repository.findReceipt('ENCOUNTER', pendingReceipt.aggregateId, pendingReceipt.commandId)
    ).resolves.toEqual(pendingReceipt)

    const wrongOccurrenceVersion = structuredClone(pendingReceipt)
    if (wrongOccurrenceVersion.resultPayload.status === 'ENCOUNTER_OCCURRENCE_PENDING')
      wrongOccurrenceVersion.resultPayload.occurrence.occurrenceVersion = 0
    expect(() => validateRuleOccurrenceReceiptEnvelope(wrongOccurrenceVersion)).toThrow(
      'pending occurrence summary'
    )

    const wrongEncounterTransition = structuredClone(pendingReceipt)
    if (wrongEncounterTransition.commandMetadata.transition === 'SPATIAL_MOVEMENT')
      wrongEncounterTransition.commandMetadata.encounterVersionTransition = 'ADVANCED'
    expect(() => validateRuleOccurrenceReceiptEnvelope(wrongEncounterTransition)).toThrow(
      'Spatial changed aggregates'
    )

    const priorToRootSceneVersion = structuredClone(pendingReceipt)
    if (priorToRootSceneVersion.commandMetadata.transition === 'SPATIAL_MOVEMENT')
      priorToRootSceneVersion.commandMetadata.expectedSceneVersion = 2
    expect(() => validateRuleOccurrenceReceiptEnvelope(priorToRootSceneVersion)).toThrow(
      'Spatial-movement rule receipt'
    )

    const wrongNestedEncounterVersion = structuredClone(pendingReceipt)
    if (
      wrongNestedEncounterVersion.resultPayload.status === 'ENCOUNTER_OCCURRENCE_PENDING' &&
      wrongNestedEncounterVersion.resultPayload.occurrence.pending !== null
    )
      wrongNestedEncounterVersion.resultPayload.occurrence.pending.encounterVersion = 6
    expect(() => validateRuleOccurrenceReceiptEnvelope(wrongNestedEncounterVersion)).toThrow(
      'Pending spatial-movement receipt result'
    )

    const invalidTerminalSceneVersion = spatialBatchReceipt()
    if (
      invalidTerminalSceneVersion.resultPayload.status === 'BATCH_COMPLETE' &&
      invalidTerminalSceneVersion.resultPayload.batchKind === 'ENCOUNTER_SPATIAL_MOVEMENT'
    )
      invalidTerminalSceneVersion.resultPayload.sceneVersion = 5
    expect(() => validateRuleOccurrenceReceiptEnvelope(invalidTerminalSceneVersion)).toThrow(
      'Terminal spatial-movement receipt result'
    )

    const executablePayload = structuredClone(pendingReceipt) as unknown as Record<string, unknown>
    const executableResult = executablePayload.resultPayload as Record<string, unknown>
    executableResult.continuation = {
      graph: {}
    }
    await expect(
      repository.appendReceipt(executablePayload as unknown as RuleOccurrenceReceipt)
    ).rejects.toThrow()
  })
})
