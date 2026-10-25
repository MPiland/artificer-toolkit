import { describe, expect, it } from 'vitest'
import {
  activeRuleEffectLifecycleDtoSchema,
  MAX_ACTIVE_EFFECT_STORED_TICKS,
  MAX_ACTIVE_EFFECT_TURNS
} from '../shared/activeRuleEffectLifecycle.js'
import { NO_DEATH_SAVES } from '../subjects/characterState.js'

import { MAX_CONCENTRATION_DAMAGE_APPLICATIONS } from '../shared/ruleExecutionConcentration.js'
import * as publicRulesRuntime from '../api/rulesRuntime.js'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { createCharacterResourceOwnerKey } from '@artificer-toolkit/shared/character'
import {
  activeRuleEffectStateDtoSchema,
  encounterMaintainedEffectDescriptorDtoSchema,
  MAX_MAINTENANCE_CLEANUP_CHARACTER_TRANSITIONS,
  MAX_MAINTENANCE_CLEANUP_REMOVED_EFFECTS,
  MAX_MAINTENANCE_CLEANUP_TERMINATED_STATES,
  serverPublishedRuleDefinitionDtoSchema,
  serverRuleExecutionCorrelationIdDtoSchema,
  serverRuleExecutionD20EvidenceDtoSchema,
  serverRuleExecutionApplicationOutputsDtoSchema,
  serverRuleExecutionPendingApplicationContextDtoSchema,
  serverRuleExecutionInputDtoSchema,
  serverRuleExecutionReceiptCommandMetadataDtoSchema,
  storedRuleExecutionResultDtoSchema,
  type StoredRuleExecutionResultDto
} from '../shared/rulesExecution.js'

const SYSTEM_ID = '11111111-1111-4111-8111-111111111111'
const SEEDED_SYSTEM_ID = '00000000-0000-0000-0000-000000000001'
const DEFINITION_ID = '22222222-2222-4222-8222-222222222222'
const { gameSystemRuleCapabilityDtoSchema, ruleGraphDefinitionDtoSchema } = publicRulesRuntime

const definition = {
  schemaVersion: 1,
  id: DEFINITION_ID,
  gameSystemId: SYSTEM_ID,
  definitionFamilyKey: 'test-resolution',
  nodes: [
    {
      id: 'threshold',
      operation: { key: 'number.compare-threshold', contractVersion: 1 },
      inputs: {
        value: { kind: 'FACT', factKey: 'actor.value' },
        threshold: { kind: 'LITERAL', value: 10 }
      }
    }
  ],
  outputs: {
    passed: { kind: 'NODE_OUTPUT', nodeId: 'threshold', port: 'passed' }
  }
} as const

const turnBatchIds = {
  occurrence: '00000000-0000-4000-8000-000000000201',
  encounter: '00000000-0000-4000-8000-000000000202',
  character: '00000000-0000-4000-8000-000000000203',
  actor: '00000000-0000-4000-8000-000000000204',
  effect: '00000000-0000-4000-8000-000000000205',
  condition: '00000000-0000-4000-8000-000000000206',
  source: '00000000-0000-4000-8000-000000000207',
  entry: '00000000-0000-4000-8000-000000000208'
}

/** The typed roll-mode source of a fixture contributor named by an authored definition. */
const authoredSource = (id: string) => ({ kind: 'AUTHORED', id, holderActorId: null }) as const

type TurnBatchResult = Extract<
  StoredRuleExecutionResultDto,
  { status: 'BATCH_COMPLETE'; batchKind: 'ENCOUNTER_TURN_ACTIVE_EFFECTS' }
>

function turnBatchResult(): TurnBatchResult {
  const before = {
    currentHitPoints: 10,
    temporaryHitPoints: 0,
    maximumHitPoints: 10,
    scalarValues: {},
    conditionIds: [],
    deathSaves: NO_DEATH_SAVES
  }
  const after = { ...before, conditionIds: [turnBatchIds.condition] }
  const application = {
    ordinal: 0,
    kind: 'CONDITION_APPLY' as const,
    conditionId: turnBatchIds.condition,
    beforePresent: false,
    afterPresent: true as const,
    applied: true,
    sourceNodeId: 'effect-node',
    sourceOperationKey: 'effect.apply',
    authoredPath: null,
    resolvedPath: 'START_OF_TURN'
  }
  return {
    status: 'BATCH_COMPLETE' as const,
    batchKind: 'ENCOUNTER_TURN_ACTIVE_EFFECTS' as const,
    schemaVersion: 1 as const,
    occurrenceId: turnBatchIds.occurrence,
    occurrenceVersion: 0,
    encounterId: turnBatchIds.encounter,
    commandType: 'START' as const,
    initiative: null,
    initiativeAdvance: null,
    rechargeExecutions: [],
    deathSaveExecutions: [],
    executions: [
      {
        ordinal: 0,
        boundaryOrdinal: 0,
        stage: 'START_OF_TURN' as const,
        targetActorId: turnBatchIds.actor,
        owner: { kind: 'CHARACTER', characterId: turnBatchIds.character },
        activeEffectId: turnBatchIds.effect,
        createdOrdinal: 1,
        beforeVersion: 1,
        definition: {
          authoredEffectId: turnBatchIds.source,
          compiledEntryId: turnBatchIds.entry,
          frozenGraphNodeId: 'effect-node',
          frozenSourceChecksum: 'a'.repeat(64),
          capabilityContractVersion: 1,
          definitionChecksum: 'b'.repeat(64)
        },
        execution: {
          status: 'COMPLETE' as const,
          outputs: {},
          movementInterruption: null,
          evidence: {
            source: {
              definitionId: turnBatchIds.source,
              gameSystemId: SYSTEM_ID,
              definitionFamilyKey: 'effect',
              checksum: 'a'.repeat(64)
            },
            capabilityContractVersion: 1,
            facts: {},
            sourceEntryBindings: [{ sourceEntryId: turnBatchIds.entry, nodeId: 'effect-node' }],
            trace: [
              {
                nodeId: 'effect-node',
                operation: { key: 'effect.apply', contractVersion: 1 },
                inputs: {},
                outputs: {
                  targetActorId: turnBatchIds.actor,
                  conditionId: turnBatchIds.condition,
                  resolvedPath: 'START_OF_TURN',
                  applicationCandidate: true,
                  authorized: true,
                  targetStateChecksum: 'c'.repeat(64)
                }
              }
            ],
            outputs: {}
          }
        },
        d20: null,
        targetTransition: { checksum: 'c'.repeat(64), before, after },
        applications: [application],
        lifecycle: {
          kind: 'EXPIRE' as const,
          expectedVersion: 1,
          beforeRemainingTicks: 1,
          afterRemainingTicks: 0 as const,
          beforeLifecycleChecksum: 'd'.repeat(64)
        }
      }
    ],
    encounterActorTransitions: [],
    characterTransitions: [
      {
        characterId: turnBatchIds.character,
        targetActorId: turnBatchIds.actor,
        beforeStreamVersion: 4,
        afterStreamVersion: 5,
        before,
        after
      }
    ]
  }
}

function recurringSaveBatchResult(outcome: 'ON_SAVE_FAIL' | 'ON_SAVE_SUCCESS'): TurnBatchResult {
  const result = structuredClone(turnBatchResult())
  const execution = result.executions[0]!
  const sourceTrace = execution.execution.evidence.trace[0]!
  const before = execution.targetTransition.before
  const contributors = [
    {
      sourceId: 'Z!',
      grantId: null,
      domainKey: 'domain:one',
      influence: 'ADVANTAGE' as const,
      source: authoredSource('Z!')
    },
    {
      sourceId: 'a',
      grantId: 'grant.two',
      domainKey: null,
      influence: 'DISADVANTAGE' as const,
      source: authoredSource('a')
    },
    {
      sourceId: 'a:source',
      grantId: 'grant:two',
      domainKey: '[]',
      influence: 'DISADVANTAGE' as const,
      source: authoredSource('a:source')
    },
    {
      sourceId: 'é',
      grantId: null,
      domainKey: null,
      influence: 'ADVANTAGE' as const,
      source: authoredSource('é')
    }
  ]
  const contributorChecksum = checksumRuleDocument(contributors)
  execution.d20 = {
    requestId: 'recurring-save-d20',
    rollMode: 'NORMAL',
    keep: 'FIRST',
    derivedRollMode: 'NORMAL',
    rawFaces: [12],
    selectedNatural: 12,
    contributors,
    contributorChecksum,
    modifier: 3,
    total: 15,
    defenseOrDc: 10,
    resultPath: outcome
  }
  execution.execution.outputs = {
    targetActorId: turnBatchIds.actor,
    naturalD20: 12,
    total: 15,
    resultPath: outcome,
    contributorChecksum
  }
  execution.execution.evidence.outputs = {
    targetActorId: turnBatchIds.actor,
    naturalD20: 12,
    total: 15,
    resultPath: outcome,
    contributorChecksum
  }
  sourceTrace.outputs = {
    targetActorId: turnBatchIds.actor,
    resolvedPath: outcome,
    applicationCandidate: true,
    authorized: outcome === 'ON_SAVE_FAIL',
    targetStateChecksum: execution.targetTransition.checksum,
    ...(outcome === 'ON_SAVE_FAIL' ? { conditionId: turnBatchIds.condition } : {})
  }
  execution.execution.evidence.trace.push(
    {
      nodeId: 'roll',
      operation: { key: 'evidence.integer-range', contractVersion: 1 },
      inputs: { min: 1, max: 20 },
      outputs: {},
      evidence: {
        kind: 'INTEGER_RANGE',
        requestId: 'recurring-save-d20',
        value: 12
      }
    },
    {
      nodeId: 'save',
      operation: { key: 'dnd5e.saving-throw', contractVersion: 1 },
      inputs: {
        naturalD20: 12,
        modifier: 3,
        threshold: 10,
        contributorChecksum
      },
      outputs: {
        targetActorId: turnBatchIds.actor,
        contributorChecksum,
        total: 15,
        resultPath: outcome
      }
    }
  )
  if (outcome === 'ON_SAVE_FAIL') {
    execution.applications = [
      {
        ordinal: 0,
        kind: 'CONDITION_APPLY',
        conditionId: turnBatchIds.condition,
        beforePresent: false,
        afterPresent: true,
        applied: true,
        sourceNodeId: 'effect-node',
        sourceOperationKey: 'effect.apply',
        authoredPath: null,
        resolvedPath: outcome
      }
    ]
    execution.targetTransition.after = { ...before, conditionIds: [turnBatchIds.condition] }
    result.characterTransitions[0]!.after = execution.targetTransition.after
  } else {
    execution.applications = []
  }
  return result
}

function turnPendingContext() {
  const candidate = (ordinal: number, effectId: string) => ({
    ordinal,
    boundaryOrdinal: 0,
    stage: 'START_OF_TURN' as const,
    targetActorId: turnBatchIds.actor,
    owner: {
      kind: 'CHARACTER' as const,
      characterId: turnBatchIds.character,
      streamVersion: 4,
      projectionChecksum: 'a'.repeat(64),
      mechanicalContextChecksum: 'b'.repeat(64)
    },
    activeEffectId: effectId,
    createdOrdinal: ordinal + 1,
    effectVersion: 1,
    definitionChecksum: 'c'.repeat(64),
    lifecycleChecksum: 'd'.repeat(64),
    targetStateChecksum: 'e'.repeat(64),
    sourceActorId: null,
    d20Policy: null,
    diceStage: null
  })
  return {
    kind: 'ENCOUNTER_TURN_ACTIVE_EFFECTS' as const,
    schemaVersion: 1 as const,
    root: {
      rootCommandId: turnBatchIds.occurrence,
      commandFingerprint: 'f'.repeat(64),
      commandType: 'START' as const,
      initiatorUserId: turnBatchIds.character,
      requestedByUserId: turnBatchIds.character,
      correlationId: null,
      expectedEncounterVersion: 3,
      proposedTerminalTransition: {
        status: 'ACTIVE' as const,
        round: 1,
        currentActorId: turnBatchIds.actor
      },
      stagedLegendaryActionRefreshes: [
        {
          ordinal: 0,
          actorId: turnBatchIds.actor,
          actorCurrentnessChecksum: '2'.repeat(64),
          ownerFeatureId: turnBatchIds.source,
          chargeId: turnBatchIds.entry,
          lifecycleDefinitionId: DEFINITION_ID,
          lifecycleDefinitionVersion: 1,
          lifecycleDefinitionChecksum: '3'.repeat(64),
          beforeUsed: 2,
          afterUsed: 0
        }
      ],
      stagedActionEconomyRefreshes: [
        {
          ordinal: 0,
          actorId: turnBatchIds.actor,
          capabilityDefinitionId: DEFINITION_ID,
          definitionVersion: 1,
          definitionChecksum: '4'.repeat(64),
          beforeUsed: 1,
          afterUsed: 0
        }
      ]
    },
    selectionChecksum: '1'.repeat(64),
    currentCandidate: candidate(0, turnBatchIds.effect),
    completedExecutions: [],
    remainingCandidates: [] as ReturnType<typeof candidate>[]
  }
}

function maintainedCharacterReceipt() {
  type PriorState = {
    id: string
    version: number
    maintenanceDefinitionId: string
    descriptorChecksum: string
    sourceActorId: string
  }
  type RemovedDependentEffect = {
    kind: 'CHARACTER' | 'ENCOUNTER_ACTOR'
    characterId?: string
    targetActorId?: string
    activeEffectId: string
    createdOrdinal: number
    expectedVersion: number
    definitionChecksum: string
    lifecycleChecksum: string
  }
  type EndedCarriedGrant = Omit<RemovedDependentEffect, 'kind' | 'targetActorId'>
  const before = {
    currentHitPoints: 10,
    temporaryHitPoints: 0,
    maximumHitPoints: 10,
    scalarValues: {},
    conditionIds: [],
    deathSaves: NO_DEATH_SAVES
  }
  const activeEffectId = '00000000-0000-4000-8000-000000000301'
  const maintainedStateId = '00000000-0000-4000-8000-000000000302'
  const maintenanceDefinitionId = '00000000-0000-4000-8000-000000000303'
  return {
    kind: 'CHARACTER_MECHANICS_BATCH' as const,
    sourceApplications: [],
    actionEconomyTransition: null,
    schemaVersion: 1 as const,
    occurrenceId: turnBatchIds.occurrence,
    sourceActorId: turnBatchIds.actor,
    sourceCharacterId: turnBatchIds.character,
    targetActorId: turnBatchIds.actor,
    sourceCharacterStreamVersion: null,
    targetCharacterStreamVersion: 5,
    resourceConsumption: null,
    activeEffectTransitions: [
      {
        kind: 'CREATE' as const,
        activeEffectId,
        characterId: turnBatchIds.character,
        sourceEncounterId: turnBatchIds.encounter,
        createdOrdinal: 1,
        afterVersion: 1,
        authoredEffectId: turnBatchIds.source,
        compiledEntryId: turnBatchIds.entry,
        frozenGraphNodeId: 'effect-node',
        definitionChecksum: 'a'.repeat(64),
        lifecycleChecksum: 'b'.repeat(64),
        frozenSourceChecksum: 'c'.repeat(64),
        capabilityContractVersion: 1,
        recurrenceStage: 'START_OF_TURN' as const,
        remainingTicks: 2,
        maintainedEffectStateId: maintainedStateId as string | null
      }
    ],
    maintenanceTransition: {
      kind: 'REPLACE_SAME_DEFINITION' as const,
      priorState: null as PriorState | null,
      removedDependentEffects: [] as RemovedDependentEffect[],
      endedCarriedGrants: [] as EndedCarriedGrant[],
      createdState: {
        id: maintainedStateId,
        version: 1,
        maintenanceDefinitionId,
        descriptorChecksum: 'd'.repeat(64),
        definitionChecksum: 'e'.repeat(64),
        sourceActionId: 'action-id',
        sourceOccurrenceId: turnBatchIds.occurrence,
        sourceActorId: turnBatchIds.actor
      },
      characterOwnerTransitions: [] as Array<{
        characterId: string
        beforeStreamVersion: number
        afterStreamVersion: number
      }>,
      createdDependentEffectIds: [activeEffectId]
    },
    d20: null,
    targetTransition: { checksum: 'f'.repeat(64), before, after: before },
    applications: []
  }
}

function encounterActorActiveEffectReceipt() {
  const target = {
    currentHitPoints: 10,
    temporaryHitPoints: 0,
    maximumHitPoints: 10,
    scalarValues: {},
    conditionIds: [],
    deathSaves: NO_DEATH_SAVES
  }
  return {
    kind: 'ENCOUNTER_ACTOR_MECHANICS_BATCH' as const,
    sourceApplications: [],
    actionEconomyTransition: null,
    schemaVersion: 1 as const,
    occurrenceId: turnBatchIds.occurrence,
    sourceActorId: turnBatchIds.actor,
    targetActorId: turnBatchIds.effect,
    sourceCharacterStreamVersion: null,
    resourceConsumption: null,
    featureResourceConsumption: null,
    targetFeatureResourceConsumption: null,
    d20: null,
    activeEffectTransitions: [
      {
        kind: 'CREATE' as const,
        activeEffectId: '00000000-0000-4000-8000-000000000311',
        targetActorId: turnBatchIds.effect,
        createdOrdinal: 1,
        afterVersion: 1,
        authoredEffectId: turnBatchIds.source,
        compiledEntryId: turnBatchIds.entry,
        frozenGraphNodeId: 'effect-node',
        definitionChecksum: 'a'.repeat(64),
        lifecycleChecksum: 'b'.repeat(64),
        frozenSourceChecksum: 'c'.repeat(64),
        capabilityContractVersion: 1,
        recurrenceStage: 'START_OF_TURN' as const,
        remainingTicks: 2
      }
    ],
    targetTransition: { checksum: 'f'.repeat(64), before: target, after: target },
    applications: []
  }
}

describe('rules runtime contracts', () => {
  it('accepts only bounded canonical turn active-effect pending contexts', () => {
    const pending = turnPendingContext()
    expect(serverRuleExecutionPendingApplicationContextDtoSchema.parse(pending)).toMatchObject({
      kind: 'ENCOUNTER_TURN_ACTIVE_EFFECTS',
      root: {
        stagedLegendaryActionRefreshes: [{ afterUsed: 0 }],
        stagedActionEconomyRefreshes: [{ afterUsed: 0 }]
      }
    })
    const completed = turnBatchResult().executions[0]!
    const chained = {
      ...pending,
      currentCandidate: {
        ...pending.currentCandidate,
        ordinal: 1,
        activeEffectId: turnBatchIds.source,
        createdOrdinal: 2
      },
      completedExecutions: [completed],
      remainingCandidates: [
        {
          ...pending.currentCandidate,
          ordinal: 2,
          activeEffectId: turnBatchIds.entry,
          createdOrdinal: 3
        }
      ]
    }
    expect(serverRuleExecutionPendingApplicationContextDtoSchema.parse(chained)).toMatchObject({
      kind: 'ENCOUNTER_TURN_ACTIVE_EFFECTS'
    })
    for (const invalid of [
      { ...chained, currentCandidate: { ...chained.currentCandidate, ordinal: 3 } },
      { ...chained, remainingCandidates: [{ ...chained.remainingCandidates[0]!, ordinal: 1 }] },
      {
        ...chained,
        remainingCandidates: [
          {
            ...chained.remainingCandidates[0]!,
            activeEffectId: chained.currentCandidate.activeEffectId
          }
        ]
      },
      {
        ...pending,
        currentCandidate: {
          ...pending.currentCandidate,
          owner: { kind: 'CHARACTER', characterId: turnBatchIds.character }
        }
      },
      { ...pending, graph: { arbitrary: true } },
      {
        ...pending,
        remainingCandidates: Array.from({ length: 129 }, (_, ordinal) => ({
          ...pending.currentCandidate,
          ordinal: ordinal + 1,
          activeEffectId: `00000000-0000-4000-8000-${String(ordinal + 500).padStart(12, '0')}`
        }))
      }
    ]) {
      expect(() => serverRuleExecutionPendingApplicationContextDtoSchema.parse(invalid)).toThrow()
    }
  })

  it('requires a complete frozen actor-rule source identity when a turn batch retains one', () => {
    const pending = turnPendingContext()
    const frozen = {
      ...pending,
      root: {
        ...pending.root,
        frozenActorRuleRevisionId: turnBatchIds.source,
        frozenActorRuleRevisionChecksum: 'a'.repeat(64),
        frozenActorRuleSnapshotChecksum: 'b'.repeat(64)
      }
    }
    expect(serverRuleExecutionPendingApplicationContextDtoSchema.parse(frozen)).toMatchObject({
      root: { frozenActorRuleRevisionId: turnBatchIds.source }
    })
    for (const malformed of [
      { ...frozen, root: { ...frozen.root, frozenActorRuleRevisionChecksum: null } },
      { ...frozen, root: { ...frozen.root, frozenActorRuleSnapshotChecksum: null } },
      { ...frozen, root: { ...frozen.root, frozenActorRuleRevisionId: null } }
    ]) {
      expect(() => serverRuleExecutionPendingApplicationContextDtoSchema.parse(malformed)).toThrow()
    }
  })

  it('retains only canonical server d20 policy facts beside a paused turn candidate', () => {
    const pending = turnPendingContext()
    const policy = {
      requestNodeId: 'd20',
      rollMode: 'ADVANTAGE' as const,
      keep: 'HIGHER' as const,
      contributors: [
        {
          sourceId: 'grant:one',
          grantId: null,
          domainKey: null,
          influence: 'ADVANTAGE' as const,
          source: authoredSource('grant:one')
        }
      ],
      contributorChecksum: 'a'.repeat(64),
      modifier: 3,
      dc: 15
    }
    expect(
      serverRuleExecutionPendingApplicationContextDtoSchema.parse({
        ...pending,
        currentCandidate: { ...pending.currentCandidate, d20Policy: policy }
      })
    ).toMatchObject({ kind: 'ENCOUNTER_TURN_ACTIVE_EFFECTS' })
    expect(() =>
      serverRuleExecutionPendingApplicationContextDtoSchema.parse({
        ...pending,
        currentCandidate: {
          ...pending.currentCandidate,
          d20Policy: { ...policy, contributors: [...policy.contributors, policy.contributors[0]] }
        }
      })
    ).toThrow()
  })

  it('retains a bounded Character-to-Encounter-actor action pause without Character-target pins', () => {
    const pending = {
      kind: 'ENCOUNTER_ACTOR_RULE_ACTION' as const,
      schemaVersion: 1 as const,
      actionId: 'action:fire-bolt',
      sourceActorId: turnBatchIds.actor,
      targetActorId: '00000000-0000-4000-8000-000000000301',
      sourceCharacterId: turnBatchIds.character,
      sourceCharacterStreamVersion: 4,
      sourceProjectionChecksum: 'a'.repeat(64),
      sourceMechanicalContextChecksum: 'b'.repeat(64),
      targetCurrentnessChecksum: 'c'.repeat(64),
      publishedDefinitionId: DEFINITION_ID,
      publishedDefinitionChecksum: 'd'.repeat(64),
      phase: {
        kind: 'ACTION_EVIDENCE' as const,
        d20: {
          rollMode: 'NORMAL' as const,
          keep: 'FIRST' as const,
          contributors: [],
          contributorChecksum: 'e'.repeat(64),
          modifier: 5,
          defenseOrDc: 14
        }
      }
    }
    expect(serverRuleExecutionPendingApplicationContextDtoSchema.parse(pending)).toMatchObject({
      kind: 'ENCOUNTER_ACTOR_RULE_ACTION',
      targetActorId: pending.targetActorId,
      twoPhase: null
    })
    expect(
      serverRuleExecutionPendingApplicationContextDtoSchema.parse({
        ...pending,
        twoPhase: {
          phase: 'TEST',
          compilerSourceChecksum: 'f'.repeat(64),
          testTemplateChecksum: 'a'.repeat(64),
          boundFactsChecksum: 'b'.repeat(64)
        }
      })
    ).toMatchObject({
      kind: 'ENCOUNTER_ACTOR_RULE_ACTION',
      twoPhase: { phase: 'TEST' }
    })
    const testExecution = turnBatchResult().executions[0]!.execution
    const testExecutionChecksum = checksumRuleDocument(testExecution)
    expect(
      serverRuleExecutionPendingApplicationContextDtoSchema.parse({
        ...pending,
        twoPhase: {
          phase: 'OUTCOME',
          compilerSourceChecksum: 'f'.repeat(64),
          testTemplateChecksum: 'a'.repeat(64),
          outcomeTemplateChecksum: 'b'.repeat(64),
          boundFactsChecksum: 'c'.repeat(64),
          testExecution,
          testExecutionChecksum,
          testRollEvidence: {
            requestId: 'test-roll',
            rollMode: 'NORMAL',
            keep: 'FIRST',
            derivedRollMode: 'NORMAL',
            rawFaces: [12],
            selectedNatural: 12
          }
        }
      })
    ).toMatchObject({
      kind: 'ENCOUNTER_ACTOR_RULE_ACTION',
      twoPhase: { phase: 'OUTCOME', testExecutionChecksum }
    })
    const nestedContributors = [
      {
        sourceId: 'nested-save-test',
        grantId: null,
        domainKey: 'nested-save-test',
        influence: 'ADVANTAGE' as const,
        source: authoredSource('nested-save-test')
      }
    ]
    const nestedOutcomeD20 = {
      requestNodeId: 'nested-save-d20',
      rollMode: 'ADVANTAGE' as const,
      keep: 'HIGHER' as const,
      contributors: nestedContributors,
      contributorChecksum: checksumRuleDocument(nestedContributors),
      modifier: 2,
      dc: 13
    }
    const nestedOutcomeD20Evidence = {
      requestNodeId: nestedOutcomeD20.requestNodeId,
      requestId: 'nested-save-request',
      rollMode: nestedOutcomeD20.rollMode,
      keep: nestedOutcomeD20.keep,
      derivedRollMode: nestedOutcomeD20.rollMode,
      rawFaces: [3, 17],
      selectedNatural: 17,
      contributors: nestedContributors,
      contributorChecksum: nestedOutcomeD20.contributorChecksum,
      modifier: nestedOutcomeD20.modifier,
      total: 19,
      defenseOrDc: nestedOutcomeD20.dc,
      resultPath: 'ON_SAVE_SUCCESS'
    }
    const nestedPending = {
      ...pending,
      twoPhase: {
        phase: 'OUTCOME' as const,
        compilerSourceChecksum: 'f'.repeat(64),
        testTemplateChecksum: 'a'.repeat(64),
        outcomeTemplateChecksum: 'b'.repeat(64),
        boundFactsChecksum: 'c'.repeat(64),
        testExecution,
        testExecutionChecksum,
        testRollEvidence: {
          requestId: 'test-roll',
          rollMode: 'NORMAL' as const,
          keep: 'FIRST' as const,
          derivedRollMode: 'NORMAL' as const,
          rawFaces: [12],
          selectedNatural: 12
        },
        nestedOutcomeD20,
        nestedOutcomeD20Evidence
      }
    }
    expect(
      serverRuleExecutionPendingApplicationContextDtoSchema.parse(nestedPending)
    ).toMatchObject({
      twoPhase: { nestedOutcomeD20Evidence }
    })
    expect(() =>
      serverRuleExecutionPendingApplicationContextDtoSchema.parse({
        ...nestedPending,
        twoPhase: {
          ...nestedPending.twoPhase,
          nestedOutcomeD20Evidence: {
            ...nestedOutcomeD20Evidence,
            requestNodeId: 'different-nested-save-d20'
          }
        }
      })
    ).toThrow()
    expect(() =>
      serverRuleExecutionPendingApplicationContextDtoSchema.parse({
        ...nestedPending,
        twoPhase: { ...nestedPending.twoPhase, nestedOutcomeD20: null }
      })
    ).toThrow()
    expect(() =>
      serverRuleExecutionPendingApplicationContextDtoSchema.parse({
        ...pending,
        targetCurrentnessChecksum: 'not-a-checksum'
      })
    ).toThrow()
  })

  it('accepts only bounded canonical concentration pending and terminal receipt contexts', () => {
    const application = {
      ordinal: 0,
      sourceNodeId: 'damage',
      sourceOperationKey: 'dnd5e.damage-proposal',
      targetActorId: turnBatchIds.actor,
      appliedAmount: 12,
      damageTypeId: turnBatchIds.condition
    }
    const pending = {
      kind: 'ENCOUNTER_DAMAGE_SAVE_CHECK' as const,
      source: 'CONCENTRATION' as const,
      schemaVersion: 1 as const,
      parentOccurrenceId: turnBatchIds.occurrence,
      parentCommandFingerprint: 'a'.repeat(64),
      finalizedDamageEnvelopeChecksum: 'b'.repeat(64),
      application,
      sourceLabels: [],
      trigger: { sourceLabel: null, damageTypeLabel: null, dc: 10 },
      maintainedState: {
        id: '00000000-0000-4000-8000-000000000304',
        version: 1,
        maintenanceDefinitionId: '00000000-0000-4000-8000-000000000305',
        descriptorChecksum: 'c'.repeat(64)
      },
      concentrationDefinition: {
        id: '00000000-0000-4000-8000-0000000000c2',
        checksum: 'd'.repeat(64)
      },
      save: {
        savingThrowAbilityDefinitionId: '00000000-0000-0000-0011-000300000000',
        modifier: 3,
        rollMode: 'NORMAL',
        keep: 'FIRST',
        contributors: [],
        contributorChecksum: 'e'.repeat(64)
      },
      targetCharacter: {
        streamVersion: 4,
        baseProjectionChecksum: 'f'.repeat(64),
        campaignOverlayChecksum: '1'.repeat(64),
        mechanicalContextChecksum: '2'.repeat(64)
      },
      systemVocabularySnapshot: {
        id: '00000000-0000-4000-8000-000000000307',
        version: 2,
        checksum: '3'.repeat(64)
      },
      contextChecksum: '4'.repeat(64),
      remaining: []
    }
    expect(serverRuleExecutionPendingApplicationContextDtoSchema.parse(pending)).toMatchObject({
      kind: 'ENCOUNTER_DAMAGE_SAVE_CHECK'
    })
    const {
      maintainedState: _maintainedState,
      concentrationDefinition: _concentrationDefinition,
      save: _save,
      ...common
    } = pending
    const effectPending = {
      ...common,
      source: 'EFFECT_REPEAT_SAVE' as const,
      repeatSaveDamagerActorId: turnBatchIds.actor,
      activeEffect: {
        id: '00000000-0000-4000-8000-000000000308',
        version: 1,
        lifecycleChecksum: '5'.repeat(64)
      },
      rollInfluence: 'ADVANTAGE' as const,
      d20Policy: {
        requestNodeId: 'save',
        rollMode: 'NORMAL' as const,
        keep: 'FIRST' as const,
        contributors: [],
        contributorChecksum: 'e'.repeat(64),
        modifier: 0,
        dc: 13,
        savingThrowAbilityDefinitionId: '00000000-0000-0000-0011-000300000000'
      }
    }
    expect(
      serverRuleExecutionPendingApplicationContextDtoSchema.parse(effectPending)
    ).toMatchObject({
      kind: 'ENCOUNTER_DAMAGE_SAVE_CHECK',
      source: 'EFFECT_REPEAT_SAVE',
      rollInfluence: 'ADVANTAGE'
    })
    expect(() =>
      serverRuleExecutionPendingApplicationContextDtoSchema.parse({
        ...effectPending,
        maintainedState: pending.maintainedState
      })
    ).toThrow()
    const turnRemaining = [9999, 10000].map((ordinal) => ({
      ...application,
      ordinal,
      maintainedStateId: pending.maintainedState.id
    }))
    expect(
      serverRuleExecutionPendingApplicationContextDtoSchema.parse({
        ...pending,
        remaining: turnRemaining
      })
    ).toMatchObject({ remaining: turnRemaining })
    expect(() =>
      serverRuleExecutionPendingApplicationContextDtoSchema.parse({
        ...pending,
        remaining: [...turnRemaining].reverse()
      })
    ).toThrow('canonical application order')
    expect(
      serverRuleExecutionPendingApplicationContextDtoSchema.parse({
        ...pending,
        application: { ...application, ordinal: MAX_CONCENTRATION_DAMAGE_APPLICATIONS - 1 }
      })
    ).toMatchObject({ application: { ordinal: MAX_CONCENTRATION_DAMAGE_APPLICATIONS - 1 } })
    expect(() =>
      serverRuleExecutionPendingApplicationContextDtoSchema.parse({
        ...pending,
        application: { ...application, ordinal: MAX_CONCENTRATION_DAMAGE_APPLICATIONS }
      })
    ).toThrow()
    expect(
      serverRuleExecutionApplicationOutputsDtoSchema.parse({
        kind: 'DAMAGE_SAVE_CHECK',
        source: 'CONCENTRATION',
        schemaVersion: 1,
        occurrenceId: '00000000-0000-4000-8000-000000000306',
        parentOccurrenceId: turnBatchIds.occurrence,
        concentrationDefinition: pending.concentrationDefinition,
        savingThrowAbilityDefinitionId: pending.save.savingThrowAbilityDefinitionId,
        targetCharacter: pending.targetCharacter,
        systemVocabularySnapshot: pending.systemVocabularySnapshot,
        application: { ...application, maintainedStateId: pending.maintainedState.id },
        trigger: pending.trigger,
        outcome: 'SAVE_SUCCESS',
        d20: {
          requestId: 'concentration-d20',
          rollMode: 'NORMAL',
          keep: 'FIRST',
          derivedRollMode: 'NORMAL',
          rawFaces: [12],
          selectedNatural: 12,
          modifier: 3,
          total: 15,
          dc: 10,
          contributors: pending.save.contributors,
          contributorChecksum: pending.save.contributorChecksum
        },
        contextChecksum: pending.contextChecksum,
        cleanup: null,
        nextOccurrenceId: null,
        skipped: []
      })
    ).toMatchObject({ kind: 'DAMAGE_SAVE_CHECK', outcome: 'SAVE_SUCCESS' })
    const canonicalContributors = [
      {
        sourceId: 'Z!',
        grantId: null,
        domainKey: 'domain:one',
        influence: 'ADVANTAGE' as const,
        source: authoredSource('Z!')
      },
      {
        sourceId: 'a',
        grantId: 'grant.two',
        domainKey: null,
        influence: 'DISADVANTAGE' as const,
        source: authoredSource('a')
      },
      {
        sourceId: 'a:source',
        grantId: 'grant:two',
        domainKey: '[]',
        influence: 'DISADVANTAGE' as const,
        source: authoredSource('a:source')
      },
      {
        sourceId: 'é',
        grantId: null,
        domainKey: null,
        influence: 'ADVANTAGE' as const,
        source: authoredSource('é')
      }
    ]
    expect(
      serverRuleExecutionPendingApplicationContextDtoSchema.parse({
        ...pending,
        save: { ...pending.save, contributors: canonicalContributors }
      })
    ).toMatchObject({ kind: 'ENCOUNTER_DAMAGE_SAVE_CHECK' })
    expect(() =>
      serverRuleExecutionPendingApplicationContextDtoSchema.parse({
        ...pending,
        save: { ...pending.save, contributors: [...canonicalContributors].reverse() }
      })
    ).toThrow('canonical order')
    expect(() =>
      serverRuleExecutionPendingApplicationContextDtoSchema.parse({
        ...pending,
        save: {
          ...pending.save,
          contributors: [canonicalContributors[0], canonicalContributors[0]]
        }
      })
    ).toThrow('canonical order')
    expect(() =>
      serverRuleExecutionApplicationOutputsDtoSchema.parse({
        kind: 'DAMAGE_SAVE_CHECK',
        source: 'CONCENTRATION',
        schemaVersion: 1,
        occurrenceId: '00000000-0000-4000-8000-000000000306',
        parentOccurrenceId: turnBatchIds.occurrence,
        concentrationDefinition: pending.concentrationDefinition,
        savingThrowAbilityDefinitionId: pending.save.savingThrowAbilityDefinitionId,
        targetCharacter: pending.targetCharacter,
        systemVocabularySnapshot: pending.systemVocabularySnapshot,
        application: { ...application, maintainedStateId: pending.maintainedState.id },
        trigger: pending.trigger,
        outcome: 'SAVE_SUCCESS',
        d20: {
          requestId: 'concentration-d20',
          rollMode: 'NORMAL',
          keep: 'FIRST',
          derivedRollMode: 'NORMAL',
          rawFaces: [12],
          selectedNatural: 12,
          modifier: 3,
          total: 15,
          dc: 10,
          contributors: [],
          contributorChecksum: pending.save.contributorChecksum
        },
        contextChecksum: 'tampered',
        cleanup: null,
        nextOccurrenceId: null,
        skipped: []
      })
    ).toThrow()
    expect(() =>
      serverRuleExecutionApplicationOutputsDtoSchema.parse({
        kind: 'DAMAGE_SAVE_CHECK',
        source: 'CONCENTRATION',
        schemaVersion: 1,
        occurrenceId: '00000000-0000-4000-8000-000000000306',
        parentOccurrenceId: turnBatchIds.occurrence,
        concentrationDefinition: pending.concentrationDefinition,
        savingThrowAbilityDefinitionId: pending.save.savingThrowAbilityDefinitionId,
        targetCharacter: pending.targetCharacter,
        systemVocabularySnapshot: pending.systemVocabularySnapshot,
        application: { ...application, maintainedStateId: pending.maintainedState.id },
        outcome: 'SAVE_FAILURE',
        d20: {
          requestId: 'concentration-d20',
          rollMode: 'NORMAL',
          keep: 'FIRST',
          derivedRollMode: 'NORMAL',
          rawFaces: [2],
          selectedNatural: 2,
          modifier: 3,
          total: 5,
          dc: 10,
          contributors: pending.save.contributors,
          contributorChecksum: pending.save.contributorChecksum
        },
        contextChecksum: pending.contextChecksum,
        cleanup: null,
        nextOccurrenceId: null,
        skipped: []
      })
    ).toThrow()
  })
  it('accepts a Concentration end only when its cleanup targets the ended maintained state', () => {
    const ended = {
      kind: 'CONCENTRATION_END' as const,
      schemaVersion: 1 as const,
      occurrenceId: '00000000-0000-4000-8000-000000000021',
      parentOccurrenceId: '00000000-0000-4000-8000-000000000022',
      ownerActorId: '00000000-0000-4000-8000-000000000023',
      maintainedStateId: '00000000-0000-4000-8000-000000000024',
      reason: 'DEFEATED' as const,
      cleanup: {
        maintainedStateId: '00000000-0000-4000-8000-000000000024',
        removedDependentEffectIds: [],
        removedZoneIds: [],
        characterOwnerTransitions: []
      }
    }
    expect(serverRuleExecutionApplicationOutputsDtoSchema.parse(ended)).toMatchObject({
      kind: 'CONCENTRATION_END',
      reason: 'DEFEATED'
    })
    expect(() =>
      serverRuleExecutionApplicationOutputsDtoSchema.parse({
        ...ended,
        cleanup: { ...ended.cleanup, maintainedStateId: '00000000-0000-4000-8000-000000000025' }
      })
    ).toThrow()
    expect(() =>
      serverRuleExecutionApplicationOutputsDtoSchema.parse({ ...ended, reason: 'GRAPPLED' })
    ).toThrow()
    expect(
      serverRuleExecutionReceiptCommandMetadataDtoSchema.parse({
        schemaVersion: 1,
        transition: 'CONCENTRATION_END',
        expectedAggregateVersion: 3
      })
    ).toMatchObject({ transition: 'CONCENTRATION_END' })
  })
  it('requires immutable active-effect identity/configuration and matching mutable ticks', () => {
    const authoredEffectId = '00000000-0000-4000-8000-000000000011'
    const compiledEntryId = '00000000-0000-4000-8000-000000000012'
    const activeState = {
      definition: {
        schemaVersion: 2,
        linkedEffectId: null,
        originLevel: null,
        stateContributions: [],
        origin: {
          kind: 'CHARACTER',
          sourceAggregateId: '00000000-0000-4000-8000-000000000013',
          sourceOccurrenceId: '00000000-0000-4000-8000-000000000014',
          rootCommandId: '00000000-0000-4000-8000-000000000015'
        },
        authoredEffectId,
        compiledEntryId,
        frozenGraphNodeId: 'entry',
        frozenGraph: {
          schemaVersion: 1,
          source: {
            definitionId: authoredEffectId,
            gameSystemId: '00000000-0000-4000-8000-000000000016',
            definitionFamilyKey: 'effect',
            checksum: 'a'.repeat(64)
          },
          capabilityContractVersion: 1,
          factContracts: [],
          nodes: [
            {
              id: 'entry',
              operation: { key: 'comparison', contractVersion: 1 },
              inputs: {}
            }
          ],
          sourceEntryBindings: [{ sourceEntryId: compiledEntryId, nodeId: 'entry' }],
          outputs: { result: { kind: 'LITERAL', value: true } }
        },
        adapterFacts: { active: true },
        perceptionContributions: [],
        recurrence: {
          recurrenceStage: 'START_OF_TURN',
          anchor: 'HOLDER',
          consumeOnFirstEvents: [],
          endOnEvents: ['ON_ATTACK_ROLL'],
          endOnTriggers: [],
          endOnConditionIds: [],
          holderEnd: null,
          expiration: {
            kind: 'TICKS',
            initialRemaining: 2,
            decrementStage: 'END_OF_TURN'
          },
          lifetimeScope: 'OWNER'
        }
      },
      lifecycle: { schemaVersion: 1, remainingTicks: 2 }
    }
    expect(activeRuleEffectStateDtoSchema.parse(activeState)).toMatchObject(activeState)
    const foreignSenseDocument = {
      schemaVersion: 1 as const,
      kind: 'SENSE' as const,
      id: '00000000-0000-4000-8000-000000000017',
      gameSystemId: '00000000-0000-4000-8000-000000000018',
      capabilities: [
        {
          channel: 'VISUAL' as const,
          accessGrade: 'PRECISE' as const,
          satisfies: ['SEE' as const],
          illuminationAccess: 'BRIGHT_ONLY' as const,
          obscurementAccess: 'NONE' as const,
          perceivesInvisible: false,
          physicalConstraints: []
        }
      ]
    }
    expect(() =>
      activeRuleEffectStateDtoSchema.parse({
        ...activeState,
        definition: {
          ...activeState.definition,
          perceptionContributions: [
            {
              id: '00000000-0000-4000-8000-000000000019',
              order: 0,
              kind: 'SENSE_GRANT',
              senseDefinitionId: foreignSenseDocument.id,
              definitionVersion: 1,
              definitionContractVersion: 1,
              definitionChecksum: checksumRuleDocument(foreignSenseDocument),
              document: foreignSenseDocument,
              range: { rangeKind: 'UNLIMITED' }
            }
          ]
        }
      })
    ).toThrow('Game System')
    expect(compiledEntryId).not.toBe(authoredEffectId)
    expect(() =>
      activeRuleEffectStateDtoSchema.parse({
        ...activeState,
        definition: {
          ...activeState.definition,
          authoredEffectId: compiledEntryId
        }
      })
    ).toThrow()
    expect(() =>
      activeRuleEffectStateDtoSchema.parse({
        ...activeState,
        definition: {
          ...activeState.definition,
          frozenGraph: {
            ...activeState.definition.frozenGraph,
            sourceEntryBindings: [
              { sourceEntryId: compiledEntryId, nodeId: 'entry' },
              {
                sourceEntryId: '00000000-0000-4000-8000-000000000099',
                nodeId: 'entry'
              }
            ]
          }
        }
      })
    ).toThrow()
    expect(() =>
      activeRuleEffectStateDtoSchema.parse({
        ...activeState,
        definition: {
          ...activeState.definition,
          frozenGraph: {
            ...activeState.definition.frozenGraph,
            sourceEntryBindings: [{ sourceEntryId: compiledEntryId, nodeId: 'missing' }]
          }
        }
      })
    ).toThrow()
    expect(() =>
      activeRuleEffectStateDtoSchema.parse({
        ...activeState,
        definition: {
          ...activeState.definition,
          frozenGraphNodeId: 'missing'
        }
      })
    ).toThrow()
    expect(() =>
      activeRuleEffectStateDtoSchema.parse({
        ...activeState,
        lifecycle: { schemaVersion: 1, remainingTicks: null }
      })
    ).toThrow()
    expect(() =>
      activeRuleEffectStateDtoSchema.parse({
        ...activeState,
        definition: {
          ...activeState.definition,
          recurrence: {
            ...activeState.definition.recurrence,
            endOnEvents: ['ON_ATTACK_ROLL', 'ON_ATTACK_ROLL']
          }
        }
      })
    ).toThrow()
    const sourceAnchored = (origin: unknown) => ({
      ...activeState,
      definition: {
        ...activeState.definition,
        origin,
        recurrence: {
          ...activeState.definition.recurrence,
          anchor: 'SOURCE'
        }
      }
    })
    expect(() =>
      activeRuleEffectStateDtoSchema.parse(sourceAnchored(activeState.definition.origin))
    ).toThrow('A source-anchored effect requires an Encounter origin with a source actor.')
    expect(
      activeRuleEffectStateDtoSchema.parse(
        sourceAnchored({
          kind: 'ENCOUNTER',
          sourceAggregateId: '00000000-0000-4000-8000-000000000013',
          sourceOccurrenceId: '00000000-0000-4000-8000-000000000014',
          rootCommandId: '00000000-0000-4000-8000-000000000015',
          sourceActorId: '00000000-0000-4000-8000-000000000020'
        })
      ).definition.recurrence
    ).toMatchObject({ anchor: 'SOURCE', expiration: { kind: 'TICKS' } })

    const withTriggers = (
      endOnTriggers: unknown,
      origin: unknown = activeState.definition.origin
    ) => ({
      ...activeState,
      definition: {
        ...activeState.definition,
        origin,
        recurrence: { ...activeState.definition.recurrence, endOnTriggers }
      }
    })
    const encounterOrigin = {
      kind: 'ENCOUNTER',
      sourceAggregateId: '00000000-0000-4000-8000-000000000013',
      sourceOccurrenceId: '00000000-0000-4000-8000-000000000014',
      rootCommandId: '00000000-0000-4000-8000-000000000015',
      sourceActorId: '00000000-0000-4000-8000-000000000020'
    }
    const anyone = { event: 'DAMAGE_TAKEN', by: 'ANYONE', damageTypeIds: null }
    const sourceSide = {
      event: 'DAMAGE_TAKEN',
      by: 'SOURCE_SIDE',
      damageTypeIds: ['00000000-0000-4000-8000-000000000031']
    }
    expect(
      activeRuleEffectStateDtoSchema.parse(withTriggers([anyone, sourceSide], encounterOrigin))
        .definition.recurrence.endOnTriggers
    ).toEqual([anyone, sourceSide])
    const attacksEnemy = { event: 'ACTION_TRAIT', trait: 'ATTACK_ROLL', against: 'ENEMY' }
    const castsAtEnemy = { event: 'ACTION_TRAIT', trait: 'SPELL_CAST', against: 'ENEMY' }
    expect(
      activeRuleEffectStateDtoSchema.parse(withTriggers([attacksEnemy, castsAtEnemy, anyone]))
        .definition.recurrence.endOnTriggers
    ).toEqual([attacksEnemy, castsAtEnemy, anyone])
    expect(() =>
      activeRuleEffectStateDtoSchema.parse(withTriggers([castsAtEnemy, attacksEnemy]))
    ).toThrow('Active-effect end triggers must be sorted.')
    expect(() =>
      activeRuleEffectStateDtoSchema.parse(withTriggers([{ ...attacksEnemy, against: 'ALLY' }]))
    ).toThrow()
    expect(() =>
      activeRuleEffectStateDtoSchema.parse(
        withTriggers([{ event: 'ACTION_TRAIT', trait: 'ATTACK_ROLL' }])
      )
    ).toThrow()
    expect(() => activeRuleEffectStateDtoSchema.parse(withTriggers([anyone, anyone]))).toThrow(
      'Active-effect end triggers must be unique.'
    )
    expect(() =>
      activeRuleEffectStateDtoSchema.parse(withTriggers([sourceSide, anyone], encounterOrigin))
    ).toThrow('Active-effect end triggers must be sorted.')
    expect(() => activeRuleEffectStateDtoSchema.parse(withTriggers([sourceSide]))).toThrow(
      'A source-side end trigger requires an Encounter origin with a source actor.'
    )
    expect(() =>
      activeRuleEffectStateDtoSchema.parse(
        withTriggers([{ ...anyone, damageTypeIds: [] }], encounterOrigin)
      )
    ).toThrow()
  })
  it('accepts a bounded UUID-backed definition and System capability', () => {
    expect(
      gameSystemRuleCapabilityDtoSchema.parse({
        gameSystemId: SYSTEM_ID,
        contractVersion: 1,
        authoredRootKinds: ['action'],
        contentKinds: ['SPELL'],
        definitionFamilyKeys: ['test-resolution'],
        factContracts: [{ key: 'actor.value', valueKind: 'NUMBER' }],
        operationContracts: [{ key: 'number.compare-threshold', contractVersion: 1 }]
      })
    ).toMatchObject({ gameSystemId: SYSTEM_ID, contentKinds: ['SPELL'] })
    expect(() =>
      gameSystemRuleCapabilityDtoSchema.parse({
        gameSystemId: SYSTEM_ID,
        contractVersion: 1,
        authoredRootKinds: ['action'],
        contentKinds: ['SPELLS'],
        definitionFamilyKeys: ['test-resolution'],
        factContracts: [],
        operationContracts: [{ key: 'number.compare-threshold', contractVersion: 1 }]
      })
    ).toThrow()
    expect(ruleGraphDefinitionDtoSchema.parse(definition)).toEqual(definition)
    expect(() =>
      ruleGraphDefinitionDtoSchema.parse({
        ...definition,
        sourceEntryBindings: [
          {
            sourceEntryId: '00000000-0000-4000-8000-000000000098',
            nodeId: 'threshold'
          },
          {
            sourceEntryId: '00000000-0000-4000-8000-000000000099',
            nodeId: 'threshold'
          }
        ]
      })
    ).toThrow()
    expect(
      gameSystemRuleCapabilityDtoSchema.parse({
        gameSystemId: SEEDED_SYSTEM_ID,
        contractVersion: 1,
        authoredRootKinds: ['action'],
        contentKinds: [],
        definitionFamilyKeys: ['test-resolution'],
        factContracts: [],
        operationContracts: [{ key: 'number.compare-threshold', contractVersion: 1 }]
      }).gameSystemId
    ).toBe(SEEDED_SYSTEM_ID)
    expect(publicRulesRuntime).not.toHaveProperty('gameSystemCapabilityDtoSchema')
  })

  it('rejects invalid identities, arbitrary operation keys, and unbounded graph inputs', () => {
    expect(() =>
      ruleGraphDefinitionDtoSchema.parse({
        ...definition,
        id: 'threshold-rule',
        nodes: [
          {
            ...definition.nodes[0],
            operation: { key: 'user script', contractVersion: 1 },
            inputs: Object.fromEntries(
              Array.from({ length: 17 }, (_, index) => [
                `input${index}`,
                { kind: 'LITERAL', value: index }
              ])
            )
          }
        ]
      })
    ).toThrow()
  })

  it('accepts runtime facts separately from the published definition', () => {
    const parsed = serverRuleExecutionInputDtoSchema.parse({
      definitionId: DEFINITION_ID.toUpperCase(),
      occurrenceId: '44444444-4444-4444-8444-444444444444'.toUpperCase(),
      facts: { 'actor.value': 12 }
    })
    expect(parsed).toMatchObject({
      definitionId: DEFINITION_ID,
      occurrenceId: '44444444-4444-4444-8444-444444444444',
      facts: { 'actor.value': 12 }
    })
  })

  it('normalizes trusted correlation identity before it reaches a receipt', () => {
    expect(
      serverRuleExecutionCorrelationIdDtoSchema.parse('AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA')
    ).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    expect(serverRuleExecutionCorrelationIdDtoSchema.parse(null)).toBeNull()
    expect(() => serverRuleExecutionCorrelationIdDtoSchema.parse('not-a-uuid')).toThrow()
  })

  it('keeps the published source envelope distinct from a runtime invocation', () => {
    expect(
      serverPublishedRuleDefinitionDtoSchema.parse({
        id: DEFINITION_ID,
        gameSystemId: SYSTEM_ID,
        definitionFamilyKey: 'test-resolution',
        checksum: 'a'.repeat(64),
        definition
      })
    ).toMatchObject({ id: DEFINITION_ID, definition })
    expect(publicRulesRuntime).not.toHaveProperty('serverCompletedRuleExecutionDtoSchema')
  })

  it('retains only closed, non-executable receipt metadata and results', () => {
    expect(
      serverRuleExecutionReceiptCommandMetadataDtoSchema.parse({
        schemaVersion: 1,
        transition: 'START',
        definitionId: DEFINITION_ID,
        expectedAggregateVersion: 2,
        factsChecksum: 'a'.repeat(64)
      })
    ).toMatchObject({ transition: 'START' })
    expect(() =>
      serverRuleExecutionReceiptCommandMetadataDtoSchema.parse({
        schemaVersion: 1,
        transition: 'RESUME',
        expectedAggregateVersion: 2,
        expectedOccurrenceVersion: 1,
        response: { requestId: 'request-1', value: 14 },
        continuation: { graph: {} }
      })
    ).toThrow()
    expect(() =>
      storedRuleExecutionResultDtoSchema.parse({
        status: 'PAUSED',
        occurrenceId: '44444444-4444-4444-8444-444444444444',
        occurrenceVersion: 0,
        request: {
          requestId: 'request-1',
          kind: 'INTEGER_RANGE',
          nodeId: 'roll',
          ordinal: 0,
          min: 1,
          max: 20
        },
        continuation: { graph: {} }
      })
    ).toThrow()
  })

  it('rejects malformed ordinary d20 evidence', () => {
    const contributors = [
      {
        sourceId: 'ordinary-d20-test',
        grantId: null,
        domainKey: 'ordinary-d20-test',
        influence: 'ADVANTAGE' as const,
        source: authoredSource('ordinary-d20-test')
      }
    ]
    const evidence = {
      requestId: 'ordinary-d20-request',
      rollMode: 'ADVANTAGE' as const,
      keep: 'HIGHER' as const,
      derivedRollMode: 'ADVANTAGE' as const,
      rawFaces: [3, 17],
      selectedNatural: 17,
      contributors,
      contributorChecksum: checksumRuleDocument(contributors),
      modifier: 4,
      total: 21,
      defenseOrDc: 15,
      resultPath: 'ON_HIT'
    }
    expect(serverRuleExecutionD20EvidenceDtoSchema.parse(evidence)).toMatchObject(evidence)
    // The roller may override the derived mode; faces follow the chosen mode.
    expect(
      serverRuleExecutionD20EvidenceDtoSchema.parse({
        ...evidence,
        rollMode: 'NORMAL',
        keep: 'FIRST',
        rawFaces: [3],
        selectedNatural: 3,
        total: 7
      })
    ).toMatchObject({ rollMode: 'NORMAL', derivedRollMode: 'ADVANTAGE' })
    for (const invalid of [
      { ...evidence, derivedRollMode: undefined },
      { ...evidence, rawFaces: [17] },
      { ...evidence, selectedNatural: 3 },
      { ...evidence, total: 22 },
      { ...evidence, contributorChecksum: 'a'.repeat(64) }
    ])
      expect(() => serverRuleExecutionD20EvidenceDtoSchema.parse(invalid)).toThrow()
  })

  it('requires exact settlement or advancement evidence for initiative completion', () => {
    const base = {
      status: 'INITIATIVE_COMPLETE' as const,
      schemaVersion: 1 as const,
      occurrenceId: turnBatchIds.occurrence,
      occurrenceVersion: 0,
      encounterId: turnBatchIds.encounter,
      commandType: 'ADVANCE_TURN' as const,
      initiative: null
    }
    expect(
      storedRuleExecutionResultDtoSchema.parse({
        ...base,
        initiativeAdvance: {
          kind: 'SAME_ROUND',
          round: 1,
          stateChecksum: 'a'.repeat(64),
          currentActorId: turnBatchIds.actor,
          nextActorId: turnBatchIds.source
        }
      })
    ).toMatchObject({ status: 'INITIATIVE_COMPLETE', initiative: null })
    expect(() =>
      storedRuleExecutionResultDtoSchema.parse({ ...base, initiativeAdvance: null })
    ).toThrow('Initiative completion requires settlement or advancement evidence.')
  })

  it('accepts each-round reordering only when the sealed actor cohort is unchanged', () => {
    const initiativeAdvance = {
      kind: 'ROUND_WRAP' as const,
      round: 1,
      nextRound: 2,
      cadence: 'EACH_ROUND' as const,
      stateChecksum: 'a'.repeat(64),
      currentActorId: turnBatchIds.actor,
      firstActorId: null,
      orderedActorIds: [turnBatchIds.actor, turnBatchIds.source],
      orderedSideIds: []
    }
    const result = {
      status: 'TURN_LIFECYCLE_COMPLETE' as const,
      schemaVersion: 1 as const,
      occurrenceId: turnBatchIds.occurrence,
      occurrenceVersion: 1,
      encounterId: turnBatchIds.encounter,
      commandType: 'ADVANCE_TURN' as const,
      initiativeAdvance,
      initiative: {
        round: 2,
        procedure: 'ACTOR_SCORE' as const,
        cadence: 'EACH_ROUND' as const,
        policySnapshotChecksum: 'b'.repeat(64),
        orderedActorIds: [turnBatchIds.source, turnBatchIds.actor],
        orderedSideIds: [],
        evidence: {
          primaryResults: [
            {
              entity: { kind: 'ACTOR' as const, id: turnBatchIds.actor },
              result: { kind: 'FACTS_UNAVAILABLE' as const }
            },
            {
              entity: { kind: 'ACTOR' as const, id: turnBatchIds.source },
              result: { kind: 'FACTS_UNAVAILABLE' as const }
            }
          ],
          tieAttempts: [],
          orderChoices: []
        }
      },
      outgoingTurn: { kind: 'NONE' as const, selectionChecksum: null },
      incomingTurn: { kind: 'NONE' as const, selectionChecksum: null }
    }

    expect(storedRuleExecutionResultDtoSchema.parse(result)).toMatchObject({
      status: 'TURN_LIFECYCLE_COMPLETE',
      initiative: { orderedActorIds: [turnBatchIds.source, turnBatchIds.actor] },
      legendaryActions: []
    })
    expect(
      storedRuleExecutionResultDtoSchema.parse({
        ...result,
        terminatedMaintainedStates: [
          {
            id: turnBatchIds.effect,
            ownerActorId: turnBatchIds.actor,
            maintenanceDefinitionId: turnBatchIds.source,
            expectedVersion: 1,
            descriptorChecksum: 'a'.repeat(64)
          }
        ]
      })
    ).toMatchObject({ terminatedMaintainedStates: [{ id: turnBatchIds.effect }] })
    expect(() =>
      storedRuleExecutionResultDtoSchema.parse({
        ...result,
        initiative: {
          ...result.initiative,
          orderedActorIds: [turnBatchIds.actor, turnBatchIds.effect]
        }
      })
    ).toThrow('Turn initiative settlement must match its sealed advancement.')
  })

  it('validates ordered actor-removal maintenance cleanup receipts', () => {
    const result = {
      status: 'MAINTENANCE_COMPLETE' as const,
      schemaVersion: 1 as const,
      occurrenceId: turnBatchIds.occurrence,
      occurrenceVersion: 0,
      encounterId: turnBatchIds.encounter,
      removedActorId: turnBatchIds.actor,
      reason: 'ACTOR_REMOVED' as const,
      terminatedStates: [
        {
          id: turnBatchIds.effect,
          ownerActorId: turnBatchIds.actor,
          maintenanceDefinitionId: turnBatchIds.source,
          expectedVersion: 1,
          descriptorChecksum: 'a'.repeat(64)
        }
      ],
      removedEffects: [
        {
          kind: 'CHARACTER' as const,
          ownerId: turnBatchIds.character,
          activeEffectId: turnBatchIds.effect,
          createdOrdinal: 1,
          expectedVersion: 1,
          definitionChecksum: 'b'.repeat(64),
          lifecycleChecksum: 'c'.repeat(64)
        }
      ],
      characterOwnerTransitions: [
        {
          characterId: turnBatchIds.character,
          beforeStreamVersion: 1,
          afterStreamVersion: 2
        }
      ]
    }
    expect(storedRuleExecutionResultDtoSchema.parse(result)).toMatchObject({
      status: 'MAINTENANCE_COMPLETE'
    })
    expect(() =>
      storedRuleExecutionResultDtoSchema.parse({
        ...result,
        characterOwnerTransitions: [
          { ...result.characterOwnerTransitions[0], afterStreamVersion: 3 }
        ]
      })
    ).toThrow()
  })

  it('accepts exact maintenance cleanup bounds and rejects one additional row', () => {
    const id = (ordinal: number) =>
      `00000000-0000-4000-8000-${ordinal.toString().padStart(12, '0')}`
    const result = {
      status: 'MAINTENANCE_COMPLETE' as const,
      schemaVersion: 1 as const,
      occurrenceId: turnBatchIds.occurrence,
      occurrenceVersion: 0,
      encounterId: turnBatchIds.encounter,
      removedActorId: turnBatchIds.actor,
      reason: 'ACTOR_REMOVED' as const,
      terminatedStates: Array.from(
        { length: MAX_MAINTENANCE_CLEANUP_TERMINATED_STATES },
        (_, index) => ({
          id: id(index + 1),
          ownerActorId: turnBatchIds.actor,
          maintenanceDefinitionId: turnBatchIds.source,
          expectedVersion: 1,
          descriptorChecksum: 'a'.repeat(64)
        })
      ),
      removedEffects: Array.from(
        { length: MAX_MAINTENANCE_CLEANUP_REMOVED_EFFECTS },
        (_, index) => ({
          kind: 'CHARACTER' as const,
          ownerId: turnBatchIds.character,
          activeEffectId: id(index + 200),
          createdOrdinal: index + 1,
          expectedVersion: 1,
          definitionChecksum: 'b'.repeat(64),
          lifecycleChecksum: 'c'.repeat(64)
        })
      ),
      characterOwnerTransitions: Array.from(
        { length: MAX_MAINTENANCE_CLEANUP_CHARACTER_TRANSITIONS },
        (_, index) => ({
          characterId: id(index + 400),
          beforeStreamVersion: 1,
          afterStreamVersion: 2
        })
      )
    }
    expect(storedRuleExecutionResultDtoSchema.parse(result)).toMatchObject({
      status: 'MAINTENANCE_COMPLETE'
    })
    expect(() =>
      storedRuleExecutionResultDtoSchema.parse({
        ...result,
        removedEffects: [
          ...result.removedEffects,
          {
            ...result.removedEffects.at(-1)!,
            activeEffectId: id(999),
            createdOrdinal: MAX_MAINTENANCE_CLEANUP_REMOVED_EFFECTS + 1
          }
        ]
      })
    ).toThrow()
  })

  it('validates complete turn-effect receipts and rejects malformed batch evidence', () => {
    expect(storedRuleExecutionResultDtoSchema.parse(turnBatchResult())).toMatchObject({
      status: 'BATCH_COMPLETE'
    })
    const terminatedMaintainedStates = [
      {
        id: '00000000-0000-4000-8000-000000000321',
        ownerActorId: turnBatchIds.actor,
        maintenanceDefinitionId: turnBatchIds.source,
        expectedVersion: 1,
        descriptorChecksum: 'a'.repeat(64)
      },
      {
        id: '00000000-0000-4000-8000-000000000322',
        ownerActorId: turnBatchIds.actor,
        maintenanceDefinitionId: turnBatchIds.source,
        expectedVersion: 1,
        descriptorChecksum: 'b'.repeat(64)
      }
    ]
    expect(
      storedRuleExecutionResultDtoSchema.parse({
        ...turnBatchResult(),
        terminatedMaintainedStates
      })
    ).toMatchObject({ terminatedMaintainedStates })
    expect(() =>
      storedRuleExecutionResultDtoSchema.parse({
        ...turnBatchResult(),
        terminatedMaintainedStates: [terminatedMaintainedStates[1], terminatedMaintainedStates[0]]
      })
    ).toThrow('unique and use canonical owner order')
    const invalid = (mutate: (result: ReturnType<typeof turnBatchResult>) => void) => {
      const result = structuredClone(turnBatchResult())
      mutate(result)
      expect(() => storedRuleExecutionResultDtoSchema.parse(result)).toThrow()
    }
    invalid((result) => {
      Reflect.set(result, 'commandType', 'ADVANCE_TURN')
    })
    invalid((result) => {
      result.executions[0]!.ordinal = 1
    })
    invalid((result) => {
      result.executions[0]!.lifecycle = {
        ...result.executions[0]!.lifecycle,
        beforeRemainingTicks: 0
      }
    })
    invalid((result) => {
      result.executions[0]!.execution.evidence.sourceEntryBindings = []
    })
    invalid((result) => {
      Reflect.set(result.executions[0]!.execution.evidence.trace[0]!.outputs, 'authorized', false)
    })
    invalid((result) => {
      result.executions[0]!.execution.evidence.trace.push(
        structuredClone(result.executions[0]!.execution.evidence.trace[0]!)
      )
    })
    invalid((result) => {
      Reflect.set(
        result.executions[0]!.execution.evidence.trace[0]!.outputs,
        'targetStateChecksum',
        'd'.repeat(64)
      )
    })
    invalid((result) => {
      Reflect.set(result.executions[0]!.execution, 'outputs', { result: true })
    })
    invalid((result) => {
      Reflect.set(result.executions[0]!, 'applications', [])
    })
    invalid((result) => {
      const extra = structuredClone(result.executions[0]!.execution.evidence.trace[0]!)
      Reflect.set(extra, 'nodeId', 'unbound-candidate-node')
      Reflect.set(extra.outputs, 'targetStateChecksum', 'd'.repeat(64))
      result.executions[0]!.execution.evidence.trace.push(extra)
    })
    invalid((result) => {
      result.executions[0]!.applications[0]!.sourceNodeId = 'other-node'
    })
    invalid((result) => {
      const application = result.executions[0]!.applications[0]!
      if (application.kind !== 'CONDITION_APPLY') throw new Error('Expected condition fixture.')
      application.applied = false
    })
    invalid((result) => {
      result.characterTransitions[0]!.targetActorId = turnBatchIds.effect
    })
    for (const mutate of [
      (result: ReturnType<typeof turnBatchResult>) =>
        Reflect.set(result.executions[0]!, 'd20', {
          requestId: 'turn-effect-d20',
          rollMode: 'NORMAL',
          keep: 'FIRST',
          derivedRollMode: 'NORMAL',
          rawFaces: [14],
          selectedNatural: 14,
          contributors: [],
          contributorChecksum: 'a'.repeat(64),
          modifier: 2,
          total: 16,
          defenseOrDc: 12,
          resultPath: 'ON_SAVE_SUCCESS'
        }),
      (result: ReturnType<typeof turnBatchResult>) =>
        Reflect.set(result.executions[0]!, 'd20', {
          requestId: 'turn-effect-d20',
          rollMode: 'ADVANTAGE',
          keep: 'HIGHER',
          derivedRollMode: 'ADVANTAGE',
          rawFaces: [14],
          selectedNatural: 14,
          contributors: [],
          contributorChecksum: 'a'.repeat(64),
          modifier: 2,
          total: 16,
          defenseOrDc: 12,
          resultPath: 'ON_SAVE_SUCCESS'
        }),
      (result: ReturnType<typeof turnBatchResult>) =>
        Reflect.set(result.executions[0]!, 'd20', {
          requestId: 'turn-effect-d20',
          rollMode: 'NORMAL',
          keep: 'FIRST',
          derivedRollMode: 'NORMAL',
          rawFaces: [14],
          selectedNatural: 13,
          contributors: [],
          contributorChecksum: 'a'.repeat(64),
          modifier: 2,
          total: 15,
          defenseOrDc: 12,
          resultPath: 'ON_SAVE_SUCCESS'
        }),
      (result: ReturnType<typeof turnBatchResult>) =>
        Reflect.set(result.executions[0]!, 'd20', {
          requestId: 'wrong-request',
          rollMode: 'NORMAL',
          keep: 'FIRST',
          derivedRollMode: 'NORMAL',
          rawFaces: [14],
          selectedNatural: 14,
          contributors: [],
          contributorChecksum: 'a'.repeat(64),
          modifier: 2,
          total: 16,
          defenseOrDc: 12,
          resultPath: 'ON_SAVE_SUCCESS'
        })
    ])
      invalid(mutate)

    const suppressed = () => {
      const result = structuredClone(turnBatchResult())
      Reflect.set(result.executions[0]!, 'applications', [])
      Reflect.set(result.executions[0]!.execution.evidence.trace[0]!.outputs, 'authorized', false)
      return result
    }
    expect(storedRuleExecutionResultDtoSchema.parse(suppressed())).toMatchObject({
      status: 'BATCH_COMPLETE'
    })
    for (const mutate of [
      (result: ReturnType<typeof suppressed>) =>
        Reflect.set(
          result.executions[0]!.execution.evidence.trace[0]!.outputs,
          'conditionId',
          'not-a-uuid'
        ),
      (result: ReturnType<typeof suppressed>) =>
        Reflect.deleteProperty(
          result.executions[0]!.execution.evidence.trace[0]!.outputs,
          'conditionId'
        ),
      (result: ReturnType<typeof suppressed>) =>
        Reflect.set(
          result.executions[0]!.execution.evidence.trace[0]!.outputs,
          'targetActorId',
          turnBatchIds.effect
        ),
      (result: ReturnType<typeof suppressed>) =>
        Reflect.set(
          result.executions[0]!.execution.evidence.trace[0]!.outputs,
          'targetStateChecksum',
          'd'.repeat(64)
        ),
      (result: ReturnType<typeof suppressed>) => {
        const extra = structuredClone(result.executions[0]!.execution.evidence.trace[0]!)
        Reflect.set(extra.outputs, 'authorized', true)
        result.executions[0]!.execution.evidence.trace.push(extra)
      }
    ]) {
      const result = suppressed()
      mutate(result)
      expect(() => storedRuleExecutionResultDtoSchema.parse(result)).toThrow()
    }
  })

  it('accepts recurring-save terminal failures and successes with canonical d20 evidence', () => {
    expect(
      storedRuleExecutionResultDtoSchema.parse(recurringSaveBatchResult('ON_SAVE_FAIL'))
    ).toMatchObject({
      status: 'BATCH_COMPLETE',
      executions: [{ applications: [expect.any(Object)], d20: { selectedNatural: 12 } }]
    })
    expect(
      storedRuleExecutionResultDtoSchema.parse(recurringSaveBatchResult('ON_SAVE_SUCCESS'))
    ).toMatchObject({
      status: 'BATCH_COMPLETE',
      executions: [{ applications: [], d20: { selectedNatural: 12 } }]
    })

    const invalid = (mutate: (result: ReturnType<typeof recurringSaveBatchResult>) => void) => {
      const result = structuredClone(recurringSaveBatchResult('ON_SAVE_SUCCESS'))
      mutate(result)
      expect(() => storedRuleExecutionResultDtoSchema.parse(result)).toThrow()
    }
    invalid((result) => {
      result.executions[0]!.execution.evidence.trace[0]!.outputs.targetActorId = turnBatchIds.effect
    })
    invalid((result) => {
      result.executions[0]!.d20!.selectedNatural = 11
    })
    invalid((result) => {
      result.executions[0]!.d20!.total = 14
    })
    invalid((result) => {
      result.executions[0]!.d20!.resultPath = 'ON_SAVE_FAIL'
    })
    invalid((result) => {
      result.executions[0]!.d20!.contributorChecksum = 'b'.repeat(64)
    })
    invalid((result) => {
      result.executions[0]!.execution.evidence.trace[0]!.outputs.resolvedPath = 'ON_SAVE_FAIL'
    })
    const tamperedOutputs = {
      targetActorId: turnBatchIds.effect,
      naturalD20: 11,
      total: 14,
      resultPath: 'ON_SAVE_FAIL',
      contributorChecksum: 'b'.repeat(64)
    } as const
    for (const field of Object.keys(tamperedOutputs) as (keyof typeof tamperedOutputs)[]) {
      invalid((result) => {
        delete result.executions[0]!.execution.outputs[field]
        delete result.executions[0]!.execution.evidence.outputs[field]
      })
      invalid((result) => {
        result.executions[0]!.execution.outputs[field] = tamperedOutputs[field]
        result.executions[0]!.execution.evidence.outputs[field] = tamperedOutputs[field]
      })
    }
  })

  it('rejects under-applied persisted Character mechanics outcomes', () => {
    const before = {
      currentHitPoints: 8,
      temporaryHitPoints: 2,
      maximumHitPoints: 10,
      scalarValues: {},
      conditionIds: [],
      deathSaves: NO_DEATH_SAVES
    }
    const envelope = (application: Record<string, unknown>, after: typeof before) => ({
      kind: 'CHARACTER_MECHANICS_BATCH' as const,
      sourceApplications: [],
      actionEconomyTransition: null,
      schemaVersion: 1 as const,
      occurrenceId: turnBatchIds.occurrence,
      sourceActorId: turnBatchIds.actor,
      targetActorId: turnBatchIds.actor,
      sourceCharacterStreamVersion: null,
      targetCharacterStreamVersion: 1,
      resourceConsumption: null,
      activeEffectTransitions: [],
      d20: null,
      targetTransition: { checksum: 'a'.repeat(64), before, after },
      applications: [{ ordinal: 0, ...application }]
    })
    expect(() =>
      serverRuleExecutionApplicationOutputsDtoSchema.parse(
        envelope(
          {
            kind: 'HEAL',
            requestedAmount: 3,
            resolvedAmount: 3,
            appliedAmount: 1,
            beforeCurrentHitPoints: 8,
            afterCurrentHitPoints: 9,
            beforeTemporaryHitPoints: 2,
            afterTemporaryHitPoints: 2,
            maximumHitPoints: 10,
            sourceNodeId: 'effect-node',
            sourceOperationKey: 'effect.apply',
            authoredPath: null,
            resolvedPath: null
          },
          { ...before, currentHitPoints: 9 }
        )
      )
    ).toThrow()
    expect(() =>
      serverRuleExecutionApplicationOutputsDtoSchema.parse(
        envelope(
          {
            kind: 'DAMAGE',
            requestedAmount: 4,
            resolvedAmount: 4,
            appliedAmount: 4,
            beforeCurrentHitPoints: 8,
            afterCurrentHitPoints: 4,
            beforeTemporaryHitPoints: 2,
            afterTemporaryHitPoints: 2,
            maximumHitPoints: 10,
            damageTypeId: turnBatchIds.condition,
            damageDisposition: 'NORMAL',
            sourceNodeId: 'effect-node',
            sourceOperationKey: 'effect.apply',
            authoredPath: null,
            resolvedPath: null
          },
          { ...before, currentHitPoints: 4 }
        )
      )
    ).toThrow()
    expect(() =>
      serverRuleExecutionApplicationOutputsDtoSchema.parse(
        envelope(
          {
            kind: 'TEMPORARY_HIT_POINTS',
            requestedAmount: 5,
            resolvedAmount: 5,
            appliedAmount: 5,
            beforeCurrentHitPoints: 8,
            afterCurrentHitPoints: 8,
            beforeTemporaryHitPoints: 2,
            afterTemporaryHitPoints: 7,
            maximumHitPoints: 10,
            sourceNodeId: 'effect-node',
            sourceOperationKey: 'effect.apply',
            authoredPath: null,
            resolvedPath: null
          },
          { ...before, temporaryHitPoints: 7 }
        )
      )
    ).toThrow()
  })

  it('replays a stabilize receipt only against a dying Character (D96)', () => {
    const dyingBefore = {
      currentHitPoints: 0,
      temporaryHitPoints: 0,
      maximumHitPoints: 10,
      scalarValues: {},
      conditionIds: [],
      deathSaves: { successes: 1, failures: 2, stable: false }
    }
    const stableAfter = { ...dyingBefore, deathSaves: { successes: 0, failures: 0, stable: true } }
    const envelope = (applied: boolean, before: typeof dyingBefore, after: typeof dyingBefore) => ({
      kind: 'CHARACTER_MECHANICS_BATCH' as const,
      sourceApplications: [],
      actionEconomyTransition: null,
      schemaVersion: 1 as const,
      occurrenceId: turnBatchIds.occurrence,
      sourceActorId: turnBatchIds.actor,
      sourceCharacterId: turnBatchIds.character,
      targetActorId: turnBatchIds.actor,
      sourceCharacterStreamVersion: null,
      targetCharacterStreamVersion: JSON.stringify(before) === JSON.stringify(after) ? null : 1,
      resourceConsumption: null,
      activeEffectTransitions: [],
      d20: null,
      targetTransition: { checksum: 'a'.repeat(64), before, after },
      applications: [
        {
          ordinal: 0,
          kind: 'STABILIZE' as const,
          applied,
          sourceNodeId: 'effect-node',
          sourceOperationKey: 'effect.apply',
          authoredPath: null,
          resolvedPath: null
        }
      ]
    })
    const parse = (value: ReturnType<typeof envelope>) =>
      serverRuleExecutionApplicationOutputsDtoSchema.parse(value)
    const STABILIZE_ISSUE = 'Stabilize receipt must apply to a dying Character only.'
    expect(() => parse(envelope(true, dyingBefore, stableAfter))).not.toThrow()
    // The saves must end stable with the counts reset.
    expect(() => parse(envelope(true, dyingBefore, dyingBefore))).toThrow()
    // A target that is not dying (above 0, already stable) cannot record an applied stabilize.
    const conscious = { ...dyingBefore, currentHitPoints: 4, deathSaves: NO_DEATH_SAVES }
    expect(() => parse(envelope(true, conscious, conscious))).toThrow(STABILIZE_ISSUE)
    expect(() => parse(envelope(true, stableAfter, stableAfter))).toThrow(STABILIZE_ISSUE)
    // A not-applied stabilize changes nothing.
    expect(() => parse(envelope(false, conscious, conscious))).not.toThrow()
    expect(() => parse(envelope(false, dyingBefore, stableAfter))).toThrow(STABILIZE_ISSUE)
  })

  it('replays a kill receipt as current and temporary hit points at 0 and the saves dead (SPELLS-4.T2i)', () => {
    const before = {
      currentHitPoints: 6,
      temporaryHitPoints: 2,
      maximumHitPoints: 10,
      scalarValues: {},
      conditionIds: [],
      deathSaves: NO_DEATH_SAVES
    }
    const dead = { successes: 0, failures: 3, stable: false }
    const killed = { ...before, currentHitPoints: 0, temporaryHitPoints: 0, deathSaves: dead }
    const envelope = (
      after: typeof before,
      receipt: { beforeCurrentHitPoints: number; afterCurrentHitPoints: number }
    ) => ({
      kind: 'CHARACTER_MECHANICS_BATCH' as const,
      sourceApplications: [],
      actionEconomyTransition: null,
      schemaVersion: 1 as const,
      occurrenceId: turnBatchIds.occurrence,
      sourceActorId: turnBatchIds.actor,
      sourceCharacterId: turnBatchIds.character,
      targetActorId: turnBatchIds.actor,
      sourceCharacterStreamVersion: null,
      targetCharacterStreamVersion: 1,
      resourceConsumption: null,
      activeEffectTransitions: [],
      d20: null,
      targetTransition: { checksum: 'a'.repeat(64), before, after },
      applications: [
        {
          ordinal: 0,
          kind: 'KILL' as const,
          beforeTemporaryHitPoints: 2,
          afterTemporaryHitPoints: 0,
          sourceNodeId: 'effect-node',
          sourceOperationKey: 'effect.apply',
          authoredPath: null,
          resolvedPath: null,
          ...receipt
        }
      ]
    })
    const parse = (value: ReturnType<typeof envelope>) =>
      serverRuleExecutionApplicationOutputsDtoSchema.parse(value)
    expect(() =>
      parse(envelope(killed, { beforeCurrentHitPoints: 6, afterCurrentHitPoints: 0 }))
    ).not.toThrow()
    // The receipt must start from the target's real hit points.
    expect(() =>
      parse(envelope(killed, { beforeCurrentHitPoints: 5, afterCurrentHitPoints: 0 }))
    ).toThrow()
    // The target must end dead, not merely at 0.
    expect(() =>
      parse(
        envelope(
          { ...killed, deathSaves: NO_DEATH_SAVES },
          { beforeCurrentHitPoints: 6, afterCurrentHitPoints: 0 }
        )
      )
    ).toThrow()
  })

  // SPELLS-4.T2s2: a hit on a Character's form changes the form's hit points, not the Sheet's (D130).
  it('takes a Character form hit without a Sheet version and keeps every other change versioned', () => {
    const before = {
      currentHitPoints: 8,
      temporaryHitPoints: 0,
      maximumHitPoints: 10,
      scalarValues: {},
      conditionIds: [] as string[],
      deathSaves: NO_DEATH_SAVES
    }
    const hit = { ...before, currentHitPoints: 4 }
    const envelope = (input: {
      inForm: boolean
      after: typeof before
      targetCharacterStreamVersion: number | null
    }) => ({
      kind: 'CHARACTER_MECHANICS_BATCH' as const,
      sourceApplications: [],
      actionEconomyTransition: null,
      schemaVersion: 1 as const,
      occurrenceId: turnBatchIds.occurrence,
      sourceActorId: turnBatchIds.actor,
      sourceCharacterId: turnBatchIds.character,
      targetActorId: turnBatchIds.actor,
      sourceCharacterStreamVersion: null,
      targetCharacterStreamVersion: input.targetCharacterStreamVersion,
      resourceConsumption: null,
      activeEffectTransitions: [],
      d20: null,
      targetTransition: {
        checksum: 'a'.repeat(64),
        before,
        after: input.after,
        ...(input.inForm && { inForm: true as const })
      },
      applications: [
        {
          ordinal: 0,
          kind: 'DAMAGE' as const,
          requestedAmount: 4,
          resolvedAmount: 4,
          appliedAmount: 4,
          beforeCurrentHitPoints: 8,
          afterCurrentHitPoints: 4,
          beforeTemporaryHitPoints: 0,
          afterTemporaryHitPoints: 0,
          maximumHitPoints: 10,
          damageTypeId: turnBatchIds.condition,
          damageDisposition: 'NORMAL' as const,
          critical: false,
          sourceNodeId: 'effect-node',
          sourceOperationKey: 'effect.apply',
          authoredPath: null,
          resolvedPath: null
        }
      ]
    })
    const parse = (input: Parameters<typeof envelope>[0]) => () =>
      serverRuleExecutionApplicationOutputsDtoSchema.parse(envelope(input))
    const PRESENCE_ISSUE = 'Target stream version presence is invalid.'
    expect(parse({ inForm: true, after: hit, targetCharacterStreamVersion: null })).not.toThrow()
    // A form that ends onto the Sheet writes it.
    expect(parse({ inForm: true, after: hit, targetCharacterStreamVersion: 3 })).not.toThrow()
    // The Sheet's own hit points still need its version.
    expect(parse({ inForm: false, after: hit, targetCharacterStreamVersion: null })).toThrow(
      PRESENCE_ISSUE
    )
    // Conditions stay the Character's own in a form.
    expect(
      parse({
        inForm: true,
        after: { ...hit, conditionIds: [turnBatchIds.condition] },
        targetCharacterStreamVersion: null
      })
    ).toThrow(PRESENCE_ISSUE)
  })

  it('rejects malformed maintained Character receipt replacement invariants', () => {
    expect(
      serverRuleExecutionApplicationOutputsDtoSchema.parse(maintainedCharacterReceipt())
    ).toMatchObject({ kind: 'CHARACTER_MECHANICS_BATCH' })
    const invalid = (mutate: (receipt: ReturnType<typeof maintainedCharacterReceipt>) => void) => {
      const receipt = structuredClone(maintainedCharacterReceipt())
      mutate(receipt)
      expect(() => serverRuleExecutionApplicationOutputsDtoSchema.parse(receipt)).toThrow()
    }
    invalid((receipt) => {
      receipt.maintenanceTransition.removedDependentEffects.push({
        kind: 'CHARACTER',
        characterId: turnBatchIds.character,
        activeEffectId: turnBatchIds.effect,
        createdOrdinal: 1,
        expectedVersion: 1,
        definitionChecksum: 'a'.repeat(64),
        lifecycleChecksum: 'b'.repeat(64)
      })
    })
    invalid((receipt) => {
      receipt.maintenanceTransition.priorState = {
        id: turnBatchIds.effect,
        version: 1,
        maintenanceDefinitionId: turnBatchIds.effect,
        descriptorChecksum: 'a'.repeat(64),
        sourceActorId: turnBatchIds.effect
      }
      receipt.maintenanceTransition.removedDependentEffects.push({
        kind: 'CHARACTER',
        characterId: turnBatchIds.character,
        activeEffectId: turnBatchIds.effect,
        createdOrdinal: 1,
        expectedVersion: 1,
        definitionChecksum: 'a'.repeat(64),
        lifecycleChecksum: 'b'.repeat(64)
      })
      receipt.maintenanceTransition.characterOwnerTransitions.push({
        characterId: turnBatchIds.character,
        beforeStreamVersion: 3,
        afterStreamVersion: 4
      })
    })
    invalid((receipt) => {
      const removed = receipt.maintenanceTransition.removedDependentEffects
      removed.push(
        {
          kind: 'CHARACTER',
          characterId: turnBatchIds.character,
          activeEffectId: turnBatchIds.effect,
          createdOrdinal: 2,
          expectedVersion: 1,
          definitionChecksum: 'a'.repeat(64),
          lifecycleChecksum: 'b'.repeat(64)
        },
        {
          kind: 'CHARACTER',
          characterId: turnBatchIds.character,
          activeEffectId: turnBatchIds.source,
          createdOrdinal: 1,
          expectedVersion: 1,
          definitionChecksum: 'a'.repeat(64),
          lifecycleChecksum: 'b'.repeat(64)
        }
      )
      receipt.maintenanceTransition.priorState = {
        id: turnBatchIds.entry,
        version: 1,
        maintenanceDefinitionId: receipt.maintenanceTransition.createdState.maintenanceDefinitionId,
        descriptorChecksum: 'a'.repeat(64),
        sourceActorId: turnBatchIds.actor
      }
      receipt.maintenanceTransition.characterOwnerTransitions.push(
        { characterId: turnBatchIds.character, beforeStreamVersion: 3, afterStreamVersion: 4 },
        { characterId: turnBatchIds.character, beforeStreamVersion: 3, afterStreamVersion: 4 }
      )
    })
    invalid((receipt) => {
      receipt.maintenanceTransition.priorState = {
        id: turnBatchIds.entry,
        version: 1,
        maintenanceDefinitionId: receipt.maintenanceTransition.createdState.maintenanceDefinitionId,
        descriptorChecksum: 'a'.repeat(64),
        sourceActorId: turnBatchIds.actor
      }
      receipt.maintenanceTransition.removedDependentEffects.push({
        kind: 'CHARACTER',
        characterId: turnBatchIds.character,
        activeEffectId: turnBatchIds.effect,
        createdOrdinal: 1,
        expectedVersion: 1,
        definitionChecksum: 'a'.repeat(64),
        lifecycleChecksum: 'b'.repeat(64)
      })
    })
    invalid((receipt) => {
      receipt.activeEffectTransitions[0]!.maintainedEffectStateId = turnBatchIds.effect
    })
  })

  it('requires a Character owner transition for each ended carried grant', () => {
    const ended = {
      characterId: turnBatchIds.character,
      activeEffectId: turnBatchIds.effect,
      createdOrdinal: 1,
      expectedVersion: 1,
      definitionChecksum: 'a'.repeat(64),
      lifecycleChecksum: 'b'.repeat(64)
    }
    const withEnded = structuredClone(maintainedCharacterReceipt())
    withEnded.maintenanceTransition.endedCarriedGrants.push(ended)
    withEnded.maintenanceTransition.characterOwnerTransitions.push({
      characterId: turnBatchIds.character,
      beforeStreamVersion: 3,
      afterStreamVersion: 4
    })
    expect(serverRuleExecutionApplicationOutputsDtoSchema.parse(withEnded)).toMatchObject({
      maintenanceTransition: { endedCarriedGrants: [ended] }
    })

    const withoutTransition = structuredClone(maintainedCharacterReceipt())
    withoutTransition.maintenanceTransition.endedCarriedGrants.push(ended)
    expect(() => serverRuleExecutionApplicationOutputsDtoSchema.parse(withoutTransition)).toThrow()

    const duplicated = structuredClone(withEnded)
    duplicated.maintenanceTransition.endedCarriedGrants.push(ended)
    expect(() => serverRuleExecutionApplicationOutputsDtoSchema.parse(duplicated)).toThrow()
  })

  it('allows replacement of a retained maintained state with no dependents', () => {
    const receipt = structuredClone(maintainedCharacterReceipt())
    receipt.maintenanceTransition.priorState = {
      id: '00000000-0000-4000-8000-000000000304',
      version: 1,
      maintenanceDefinitionId: receipt.maintenanceTransition.createdState.maintenanceDefinitionId,
      descriptorChecksum: 'a'.repeat(64),
      sourceActorId: turnBatchIds.actor
    }

    expect(serverRuleExecutionApplicationOutputsDtoSchema.parse(receipt)).toMatchObject({
      maintenanceTransition: { removedDependentEffects: [], characterOwnerTransitions: [] }
    })

    receipt.maintenanceTransition.priorState = null
    receipt.maintenanceTransition.removedDependentEffects.push({
      kind: 'ENCOUNTER_ACTOR',
      targetActorId: turnBatchIds.effect,
      activeEffectId: turnBatchIds.source,
      createdOrdinal: 1,
      expectedVersion: 1,
      definitionChecksum: 'a'.repeat(64),
      lifecycleChecksum: 'b'.repeat(64)
    })
    expect(() => serverRuleExecutionApplicationOutputsDtoSchema.parse(receipt)).toThrow(
      'prior state and removals are inconsistent'
    )
  })

  it('retains composite source action identity in maintained descriptors', () => {
    const descriptor = {
      schemaVersion: 2 as const,
      maintenanceDefinitionId: turnBatchIds.effect,
      definitionChecksum: 'a'.repeat(64),
      provenance: {
        kind: 'ACTION' as const,
        sourceActionId: `RESOLVE_ACTION:${turnBatchIds.actor}:feature:action`,
        sourceOccurrenceId: turnBatchIds.occurrence
      },
      sourceActorId: turnBatchIds.actor,
      replacementPolicy: 'REPLACE_SAME_DEFINITION' as const,
      emptyDependentPolicy: 'RETAIN_UNTIL_TERMINAL' as const
    }
    expect(encounterMaintainedEffectDescriptorDtoSchema.parse(descriptor)).toMatchObject(descriptor)
    expect(() =>
      encounterMaintainedEffectDescriptorDtoSchema.parse({
        ...descriptor,
        provenance: { ...descriptor.provenance, sourceActionId: 'x'.repeat(241) }
      })
    ).toThrow()
    const versionOne = Object.fromEntries(
      Object.entries({ ...descriptor, schemaVersion: 1 }).filter(
        ([key]) => key !== 'emptyDependentPolicy'
      )
    )
    expect(encounterMaintainedEffectDescriptorDtoSchema.safeParse(versionOne).success).toBe(false)
  })

  it('binds maintained Character owner transitions to the immutable source Character', () => {
    const ownerReplacement = (characterId: string) => {
      const receipt = structuredClone(maintainedCharacterReceipt())
      receipt.targetActorId = turnBatchIds.effect
      receipt.maintenanceTransition.priorState = {
        id: '00000000-0000-4000-8000-000000000304',
        version: 1,
        maintenanceDefinitionId: receipt.maintenanceTransition.createdState.maintenanceDefinitionId,
        descriptorChecksum: 'a'.repeat(64),
        sourceActorId: turnBatchIds.actor
      }
      receipt.maintenanceTransition.removedDependentEffects.push({
        kind: 'CHARACTER',
        characterId,
        activeEffectId: turnBatchIds.effect,
        createdOrdinal: 1,
        expectedVersion: 1,
        definitionChecksum: 'a'.repeat(64),
        lifecycleChecksum: 'b'.repeat(64)
      })
      receipt.maintenanceTransition.characterOwnerTransitions.push({
        characterId,
        beforeStreamVersion: 3,
        afterStreamVersion: 4
      })
      return receipt
    }

    expect(
      serverRuleExecutionApplicationOutputsDtoSchema.parse({
        ...ownerReplacement(turnBatchIds.character),
        sourceCharacterId: null
      })
    ).toMatchObject({ sourceCharacterStreamVersion: null })
    expect(
      serverRuleExecutionApplicationOutputsDtoSchema.parse({
        ...ownerReplacement(turnBatchIds.condition),
        sourceCharacterId: turnBatchIds.character
      })
    ).toMatchObject({ sourceCharacterStreamVersion: null })
    expect(() =>
      serverRuleExecutionApplicationOutputsDtoSchema.parse(ownerReplacement(turnBatchIds.character))
    ).toThrow('Source stream version presence is invalid')
    expect(
      serverRuleExecutionApplicationOutputsDtoSchema.parse({
        ...ownerReplacement(turnBatchIds.character),
        sourceCharacterStreamVersion: 4
      })
    ).toMatchObject({ sourceCharacterStreamVersion: 4 })
  })

  describe('conditions an action’s ended effects released from its source (SPELLS-27.T2)', () => {
    const release = (ordinal: number, applied = true) => ({
      ordinal,
      kind: 'CONDITION_REMOVE' as const,
      conditionId: turnBatchIds.condition,
      sourceActiveEffectId: turnBatchIds.effect,
      beforePresent: true,
      afterPresent: !applied,
      applied,
      sourceNodeId: 'effect-node',
      sourceOperationKey: 'active-effect.ended',
      authoredPath: null,
      resolvedPath: null
    })
    const releasing = (
      sourceApplications: unknown[],
      sourceCharacterStreamVersion: number | null
    ) => ({
      ...encounterActorActiveEffectReceipt(),
      sourceCharacterId: turnBatchIds.character,
      sourceApplications,
      sourceCharacterStreamVersion
    })

    it('requires the field on both batch kinds, empty when nothing was released', () => {
      const { sourceApplications: _omitted, ...missing } = encounterActorActiveEffectReceipt()
      expect(serverRuleExecutionApplicationOutputsDtoSchema.safeParse(missing).success).toBe(false)
      const { sourceApplications: _omittedCharacter, ...missingCharacter } =
        maintainedCharacterReceipt()
      expect(
        serverRuleExecutionApplicationOutputsDtoSchema.safeParse(missingCharacter).success
      ).toBe(false)
    })

    it('moves the source Character stream version exactly when a release applied', () => {
      expect(
        serverRuleExecutionApplicationOutputsDtoSchema.parse(releasing([release(0)], 4))
      ).toMatchObject({ sourceApplications: [{ kind: 'CONDITION_REMOVE', applied: true }] })
      expect(
        serverRuleExecutionApplicationOutputsDtoSchema.safeParse(releasing([release(0)], null))
          .success
      ).toBe(false)
      // A release that changed nothing leaves the stream where it was.
      expect(
        serverRuleExecutionApplicationOutputsDtoSchema.parse(releasing([release(0, false)], null))
      ).toMatchObject({ sourceCharacterStreamVersion: null })
      expect(
        serverRuleExecutionApplicationOutputsDtoSchema.safeParse(releasing([release(0, false)], 4))
          .success
      ).toBe(false)
    })

    it('leaves a Creature source’s stream version null, which has no Character stream', () => {
      const creatureReleasing = (sourceCharacterStreamVersion: number | null) => ({
        ...releasing([release(0)], sourceCharacterStreamVersion),
        sourceCharacterId: null
      })
      expect(
        serverRuleExecutionApplicationOutputsDtoSchema.parse(creatureReleasing(null))
      ).toMatchObject({ sourceCharacterStreamVersion: null })
      expect(
        serverRuleExecutionApplicationOutputsDtoSchema.safeParse(creatureReleasing(4)).success
      ).toBe(false)
    })

    it('holds only contiguous condition releases', () => {
      expect(
        serverRuleExecutionApplicationOutputsDtoSchema.safeParse(releasing([release(1)], 4)).success
      ).toBe(false)
      expect(
        serverRuleExecutionApplicationOutputsDtoSchema.safeParse(
          releasing(
            [
              {
                ordinal: 0,
                kind: 'STABILIZE',
                applied: true,
                sourceNodeId: 'effect-node',
                sourceOperationKey: 'active-effect.ended',
                authoredPath: null,
                resolvedPath: null
              }
            ],
            4
          )
        ).success
      ).toBe(false)
    })
  })

  it('records one action allowance use, including an overridden use past its maximum', () => {
    const transition = {
      definitionId: turnBatchIds.source,
      definitionVersion: 1,
      definitionChecksum: 'a'.repeat(64),
      maximum: 1,
      beforeUsed: 1,
      afterUsed: 2
    }
    expect(
      serverRuleExecutionApplicationOutputsDtoSchema.parse({
        ...encounterActorActiveEffectReceipt(),
        actionEconomyTransition: transition
      })
    ).toMatchObject({ actionEconomyTransition: transition })
    expect(
      serverRuleExecutionApplicationOutputsDtoSchema.safeParse({
        ...encounterActorActiveEffectReceipt(),
        actionEconomyTransition: { ...transition, afterUsed: 3 }
      }).success
    ).toBe(false)
    const { actionEconomyTransition: _omitted, ...missing } = encounterActorActiveEffectReceipt()
    expect(serverRuleExecutionApplicationOutputsDtoSchema.safeParse(missing).success).toBe(false)
  })

  it('binds maintained Encounter actor effect creation and preserves legacy receipt shapes', () => {
    const legacy = serverRuleExecutionApplicationOutputsDtoSchema.parse(
      encounterActorActiveEffectReceipt()
    )
    if (legacy.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH')
      throw new Error('Expected Encounter actor mechanics receipt.')
    expect(legacy).not.toHaveProperty('maintenanceTransition')
    expect(legacy.activeEffectTransitions[0]).not.toHaveProperty('maintainedEffectStateId')
    expect(() =>
      serverRuleExecutionApplicationOutputsDtoSchema.parse({
        ...encounterActorActiveEffectReceipt(),
        activeEffectTransitions: [
          {
            ...encounterActorActiveEffectReceipt().activeEffectTransitions[0]!,
            maintainedEffectStateId: turnBatchIds.source
          }
        ]
      })
    ).toThrow('Unbound maintained active effects are invalid')

    const maintainedStateId = '00000000-0000-4000-8000-000000000312'
    const receipt = {
      ...encounterActorActiveEffectReceipt(),
      sourceCharacterId: null,
      activeEffectTransitions: [
        {
          ...encounterActorActiveEffectReceipt().activeEffectTransitions[0]!,
          maintainedEffectStateId: maintainedStateId
        }
      ],
      maintenanceTransition: {
        kind: 'REPLACE_SAME_DEFINITION' as const,
        priorState: null,
        removedDependentEffects: [],
        endedCarriedGrants: [],
        createdState: {
          id: maintainedStateId,
          version: 1,
          maintenanceDefinitionId: '00000000-0000-4000-8000-000000000313',
          descriptorChecksum: 'd'.repeat(64),
          definitionChecksum: 'e'.repeat(64),
          sourceActionId: 'action-id',
          sourceOccurrenceId: turnBatchIds.occurrence,
          sourceActorId: turnBatchIds.actor
        },
        characterOwnerTransitions: [],
        createdDependentEffectIds: ['00000000-0000-4000-8000-000000000311']
      }
    }
    expect(serverRuleExecutionApplicationOutputsDtoSchema.parse(receipt)).toMatchObject({
      maintenanceTransition: { createdState: { id: maintainedStateId } }
    })

    expect(() =>
      serverRuleExecutionApplicationOutputsDtoSchema.parse({
        ...receipt,
        activeEffectTransitions: [
          { ...receipt.activeEffectTransitions[0]!, maintainedEffectStateId: turnBatchIds.source }
        ]
      })
    ).toThrow('created dependencies are invalid')

    const withRemovedCharacterOwner = (characterId: string, sourceCharacterId: string | null) => ({
      ...receipt,
      sourceCharacterId,
      maintenanceTransition: {
        ...receipt.maintenanceTransition,
        priorState: {
          id: '00000000-0000-4000-8000-000000000314',
          version: 1,
          maintenanceDefinitionId:
            receipt.maintenanceTransition.createdState.maintenanceDefinitionId,
          descriptorChecksum: 'f'.repeat(64),
          sourceActorId: turnBatchIds.actor
        },
        removedDependentEffects: [
          {
            kind: 'CHARACTER' as const,
            characterId,
            activeEffectId: turnBatchIds.effect,
            createdOrdinal: 1,
            expectedVersion: 1,
            definitionChecksum: 'a'.repeat(64),
            lifecycleChecksum: 'b'.repeat(64)
          }
        ],
        endedCarriedGrants: [],
        characterOwnerTransitions: [{ characterId, beforeStreamVersion: 3, afterStreamVersion: 4 }]
      }
    })
    expect(
      serverRuleExecutionApplicationOutputsDtoSchema.parse(
        withRemovedCharacterOwner(turnBatchIds.character, null)
      )
    ).toMatchObject({ sourceCharacterStreamVersion: null })
    expect(
      serverRuleExecutionApplicationOutputsDtoSchema.parse(
        withRemovedCharacterOwner(turnBatchIds.condition, turnBatchIds.character)
      )
    ).toMatchObject({ sourceCharacterStreamVersion: null })
    expect(() =>
      serverRuleExecutionApplicationOutputsDtoSchema.parse(
        withRemovedCharacterOwner(turnBatchIds.character, turnBatchIds.character)
      )
    ).toThrow('Source Character stream version presence is invalid')
    expect(
      serverRuleExecutionApplicationOutputsDtoSchema.parse({
        ...withRemovedCharacterOwner(turnBatchIds.character, turnBatchIds.character),
        sourceCharacterStreamVersion: 4
      })
    ).toMatchObject({ sourceCharacterStreamVersion: 4 })
  })

  it('retains one Character owner transition for multiple removed maintained dependents', () => {
    const receipt = structuredClone(maintainedCharacterReceipt())
    receipt.maintenanceTransition.priorState = {
      id: '00000000-0000-4000-8000-000000000304',
      version: 1,
      maintenanceDefinitionId: receipt.maintenanceTransition.createdState.maintenanceDefinitionId,
      descriptorChecksum: 'a'.repeat(64),
      sourceActorId: turnBatchIds.actor
    }
    receipt.maintenanceTransition.removedDependentEffects.push(
      {
        kind: 'CHARACTER',
        characterId: turnBatchIds.character,
        activeEffectId: '00000000-0000-4000-8000-000000000305',
        createdOrdinal: 1,
        expectedVersion: 1,
        definitionChecksum: 'a'.repeat(64),
        lifecycleChecksum: 'b'.repeat(64)
      },
      {
        kind: 'CHARACTER',
        characterId: turnBatchIds.character,
        activeEffectId: '00000000-0000-4000-8000-000000000306',
        createdOrdinal: 2,
        expectedVersion: 1,
        definitionChecksum: 'a'.repeat(64),
        lifecycleChecksum: 'b'.repeat(64)
      }
    )
    receipt.maintenanceTransition.characterOwnerTransitions.push({
      characterId: turnBatchIds.character,
      beforeStreamVersion: 3,
      afterStreamVersion: 4
    })

    expect(serverRuleExecutionApplicationOutputsDtoSchema.parse(receipt)).toMatchObject({
      kind: 'CHARACTER_MECHANICS_BATCH',
      sourceApplications: [],
      actionEconomyTransition: null,
      maintenanceTransition: {
        characterOwnerTransitions: [
          {
            characterId: turnBatchIds.character,
            beforeStreamVersion: 3,
            afterStreamVersion: 4
          }
        ]
      }
    })
  })

  it('retains composite UUID resource pool identity in persisted mechanics receipts', () => {
    const sourceInstanceId = `SUBCLASS:${SYSTEM_ID}:${SYSTEM_ID}:${SYSTEM_ID}:${SYSTEM_ID}`
    const poolId = createCharacterResourceOwnerKey({
      kind: 'SPELL_SOURCE',
      resourceGrantId: `${sourceInstanceId}:${SYSTEM_ID}`,
      spellId: SYSTEM_ID,
      sourceKind: 'FEATURE',
      sourceInstanceId
    })
    expect(poolId).toHaveLength(426)
    const receipt = {
      ...maintainedCharacterReceipt(),
      resourceConsumption: {
        poolId,
        chargeId: SYSTEM_ID,
        cost: 1,
        beforeUsed: 0,
        afterUsed: 1,
        beforeRemaining: 2,
        afterRemaining: 1
      }
    }
    expect(serverRuleExecutionApplicationOutputsDtoSchema.parse(receipt)).toMatchObject({
      resourceConsumption: receipt.resourceConsumption
    })
    for (const resourceConsumption of [
      { ...receipt.resourceConsumption, poolId: 'x'.repeat(1_001) },
      { ...receipt.resourceConsumption, chargeId: 'x'.repeat(241) }
    ]) {
      expect(
        serverRuleExecutionApplicationOutputsDtoSchema.safeParse({
          ...receipt,
          resourceConsumption
        }).success
      ).toBe(false)
    }
  })

  it('records only exact, non-overlapping Encounter Feature resource consumption', () => {
    const receipt = {
      kind: 'ENCOUNTER_ACTOR_MECHANICS_BATCH' as const,
      sourceApplications: [],
      actionEconomyTransition: null,
      schemaVersion: 1 as const,
      occurrenceId: turnBatchIds.occurrence,
      sourceActorId: turnBatchIds.actor,
      targetActorId: turnBatchIds.effect,
      sourceCharacterStreamVersion: null,
      resourceConsumption: null,
      featureResourceConsumption: {
        ownerActorId: turnBatchIds.actor,
        ownerFeatureId: 'feature-id',
        chargeId: 'feature-charge',
        cost: 1,
        beforeUsed: 0,
        afterUsed: 1,
        beforeRemaining: 2,
        afterRemaining: 1
      },
      d20: null,
      targetTransition: {
        checksum: 'a'.repeat(64),
        before: {
          currentHitPoints: 10,
          temporaryHitPoints: 0,
          maximumHitPoints: 10,
          conditionIds: [],
          deathSaves: NO_DEATH_SAVES
        },
        after: {
          currentHitPoints: 10,
          temporaryHitPoints: 0,
          maximumHitPoints: 10,
          conditionIds: [],
          deathSaves: NO_DEATH_SAVES
        }
      },
      applications: []
    }
    expect(serverRuleExecutionApplicationOutputsDtoSchema.parse(receipt)).toMatchObject({
      featureResourceConsumption: { ownerFeatureId: 'feature-id', afterUsed: 1 }
    })
    expect(() =>
      serverRuleExecutionApplicationOutputsDtoSchema.parse({
        ...receipt,
        featureResourceConsumption: {
          ...receipt.featureResourceConsumption,
          ownerActorId: turnBatchIds.effect
        }
      })
    ).toThrow('feature resource receipt')
    expect(() =>
      serverRuleExecutionApplicationOutputsDtoSchema.parse({
        ...receipt,
        featureResourceConsumption: {
          ...receipt.featureResourceConsumption,
          afterRemaining: 2
        }
      })
    ).toThrow('feature resource receipt')
    expect(() =>
      serverRuleExecutionApplicationOutputsDtoSchema.parse({
        ...receipt,
        resourceConsumption: {
          poolId: 'pool',
          chargeId: 'charge',
          cost: 1,
          beforeUsed: 0,
          afterUsed: 1,
          beforeRemaining: 1,
          afterRemaining: 0
        }
      })
    ).toThrow('mutually exclusive')
  })

  it('binds Legendary Resistance choice evidence to one exact target Feature charge', () => {
    const execution = structuredClone(
      recurringSaveBatchResult('ON_SAVE_FAIL').executions[0]!.execution
    )
    const originalD20 = structuredClone(
      recurringSaveBatchResult('ON_SAVE_FAIL').executions[0]!.d20!
    )
    const originalExecutionChecksum = checksumRuleDocument(execution)
    const choiceExecution = structuredClone(execution)
    choiceExecution.outputs = { use: true }
    choiceExecution.evidence.outputs = { use: true }
    choiceExecution.evidence.source = {
      ...choiceExecution.evidence.source,
      definitionId: turnBatchIds.actor,
      checksum: 'b'.repeat(64)
    }
    const receipt = {
      kind: 'ENCOUNTER_ACTOR_MECHANICS_BATCH' as const,
      sourceApplications: [],
      actionEconomyTransition: null,
      schemaVersion: 1 as const,
      occurrenceId: turnBatchIds.occurrence,
      sourceActorId: turnBatchIds.actor,
      targetActorId: turnBatchIds.effect,
      sourceCharacterStreamVersion: null,
      resourceConsumption: null,
      featureResourceConsumption: null,
      targetFeatureResourceConsumption: {
        ownerActorId: turnBatchIds.effect,
        ownerFeatureId: 'feature:legendary-resistance',
        chargeId: 'charge:legendary-resistance',
        cost: 1,
        beforeUsed: 2,
        afterUsed: 3,
        beforeRemaining: 3,
        afterRemaining: 2
      },
      legendaryResistance: {
        selectedIndex: 1 as const,
        use: true,
        ownerFeatureId: 'feature:legendary-resistance',
        chargeId: 'charge:legendary-resistance',
        featureCost: 1,
        lifecycle: {
          definitionId: turnBatchIds.effect,
          definitionVersion: 1,
          definitionChecksum: 'a'.repeat(64),
          choiceGraphDefinitionId: turnBatchIds.actor,
          choiceGraphDefinitionVersion: 1,
          choiceGraphDefinitionChecksum: 'b'.repeat(64),
          useOutput: 'use',
          interruptedStage: 'AFTER_FAILED_SAVE_BEFORE_OUTCOME' as const,
          replacement: 'SAVE_SUCCESS' as const
        },
        execution: choiceExecution,
        originalExecution: execution,
        originalExecutionChecksum,
        originalD20
      },
      d20: originalD20,
      targetTransition: {
        checksum: 'c'.repeat(64),
        before: {
          currentHitPoints: 10,
          temporaryHitPoints: 0,
          maximumHitPoints: 10,
          conditionIds: [],
          deathSaves: NO_DEATH_SAVES
        },
        after: {
          currentHitPoints: 10,
          temporaryHitPoints: 0,
          maximumHitPoints: 10,
          conditionIds: [],
          deathSaves: NO_DEATH_SAVES
        }
      },
      applications: []
    }
    expect(serverRuleExecutionApplicationOutputsDtoSchema.parse(receipt)).toMatchObject({
      legendaryResistance: { selectedIndex: 1, use: true }
    })
    expect(() =>
      serverRuleExecutionApplicationOutputsDtoSchema.parse({
        ...receipt,
        legendaryResistance: { ...receipt.legendaryResistance, selectedIndex: 0 }
      })
    ).toThrow('Legendary Resistance')
    const terminal = {
      status: 'COMPLETE' as const,
      occurrenceId: turnBatchIds.occurrence,
      occurrenceVersion: 0,
      outputs: execution.outputs,
      evidence: execution.evidence,
      applicationOutputs: receipt
    }
    expect(storedRuleExecutionResultDtoSchema.parse(terminal)).toMatchObject({
      status: 'COMPLETE',
      applicationOutputs: { legendaryResistance: { use: true } }
    })
    expect(() =>
      storedRuleExecutionResultDtoSchema.parse({
        ...terminal,
        outputs: choiceExecution.outputs,
        evidence: choiceExecution.evidence
      })
    ).toThrow('terminal action binding')
    for (const d20 of [
      { ...originalD20, modifier: 4, total: 16 },
      { ...originalD20, defenseOrDc: 11 },
      { ...originalD20, contributorChecksum: 'e'.repeat(64) },
      { ...originalD20, total: 16 }
    ])
      expect(() =>
        storedRuleExecutionResultDtoSchema.parse({
          ...terminal,
          applicationOutputs: {
            ...receipt,
            d20,
            legendaryResistance: { ...receipt.legendaryResistance, originalD20: d20 }
          }
        })
      ).toThrow('terminal action binding')
    expect(() =>
      storedRuleExecutionResultDtoSchema.parse({
        ...terminal,
        applicationOutputs: {
          ...receipt,
          d20: { ...originalD20, selectedNatural: 13, rawFaces: [13] }
        }
      })
    ).toThrow('terminal action binding')
    expect(() =>
      storedRuleExecutionResultDtoSchema.parse({
        ...terminal,
        applicationOutputs: {
          ...receipt,
          legendaryResistance: {
            ...receipt.legendaryResistance,
            execution: {
              ...choiceExecution,
              evidence: {
                ...choiceExecution.evidence,
                source: { ...choiceExecution.evidence.source, checksum: 'f'.repeat(64) }
              }
            }
          }
        }
      })
    ).toThrow('terminal action binding')
    expect(() =>
      serverRuleExecutionApplicationOutputsDtoSchema.parse({
        ...receipt,
        targetFeatureResourceConsumption: null
      })
    ).toThrow('Legendary Resistance')
    expect(() =>
      serverRuleExecutionApplicationOutputsDtoSchema.parse({
        ...receipt,
        targetFeatureResourceConsumption: {
          ...receipt.targetFeatureResourceConsumption,
          chargeId: 'other-charge'
        }
      })
    ).toThrow('Legendary Resistance')
  })
})

describe('the active-effect tick bound (SPELLS-4.T2a3, D156)', () => {
  it('stores one tick past 24 hours of turns, for a grant made on its anchor’s own turn, and no more', () => {
    expect(MAX_ACTIVE_EFFECT_TURNS).toBe(14_400)
    expect(MAX_ACTIVE_EFFECT_STORED_TICKS).toBe(14_401)
    const lifecycle = (remainingTicks: number) =>
      activeRuleEffectLifecycleDtoSchema.safeParse({ schemaVersion: 1, remainingTicks }).success
    expect(lifecycle(14_401)).toBe(true)
    expect(lifecycle(14_402)).toBe(false)
  })
})
