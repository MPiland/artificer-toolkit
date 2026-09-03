import { describe, expect, it, vi } from 'vitest'
import type { DBLike } from '@artificer-toolkit/db'

import type { RulesRuntimeService } from '../rules/rulesRuntimeService.js'

const ids = {
  action: '00000000-0000-4000-8000-000000000001',
  actor: '00000000-0000-4000-8000-000000000002',
  user: '00000000-0000-4000-8000-000000000003',
  command: '00000000-0000-4000-8000-000000000004',
  encounter: '00000000-0000-4000-8000-000000000005',
  character: '00000000-0000-4000-8000-000000000006',
  campaign: '00000000-0000-4000-8000-000000000007',
  definition: '00000000-0000-4000-8000-000000000008',
  creature: '00000000-0000-4000-8000-000000000009',
  custom: '00000000-0000-4000-8000-000000000010',
  occurrence: '00000000-0000-4000-8000-000000000011',
  request: '00000000-0000-4000-8000-000000000012',
  outcomeFail: '00000000-0000-4000-8000-000000000016',
  outcomeSuccess: '00000000-0000-4000-8000-000000000017'
}

const state = vi.hoisted(() => {
  const receipts = new Map<string, Record<string, unknown>>()
  const calls = {
    appendEvent: vi.fn(),
    compileProjection: vi.fn((value: unknown) => value),
    evaluateSnapshot: vi.fn(),
    lockContext: vi.fn(),
    lockMaintainedState: vi.fn(),
    lockDependentEffects: vi.fn(),
    lockTargets: vi.fn(),
    occurrenceFactory: vi.fn(),
    persistCleaving: vi.fn(),
    prepare: vi.fn(),
    discoverLegendaryResistance: vi.fn(),
    discoverFeatureActions: vi.fn(),
    vocabulary: vi.fn(),
    startLegendaryResistance: vi.fn(),
    publishProjection: vi.fn(),
    settle: vi.fn(),
    updateActor: vi.fn()
  }
  return {
    calls,
    receipts,
    currentEncounter: null as unknown,
    d20: null as null | { rollMode: 'NORMAL' | 'ADVANTAGE' | 'DISADVANTAGE' },
    executeMode: 'COMPLETE' as 'COMPLETE' | 'PAUSE' | 'BAD_PAUSE' | 'LR_PAUSE' | 'OUTCOME_PAUSE',
    legendaryResistanceUse: false,
    pendingApplicationContext: null as unknown,
    replay: null as unknown,
    twoPhase: false
  }
})

vi.mock('@artificer-toolkit/db', () => ({
  createActiveRuleEffectRepository: () => ({
    lockMaintainedState: state.calls.lockMaintainedState,
    lockDependentEffects: state.calls.lockDependentEffects
  }),
  createReusableDefinitionRepository: () => ({}),
  createSystemVocabularySnapshotRepository: () => ({ findActive: state.calls.vocabulary }),
  createEncounterRepository: () => ({
    appendEvent: state.calls.appendEvent,
    publishCurrentProjection: state.calls.publishProjection,
    updateActor: state.calls.updateActor
  }),
  createRuleOccurrenceRepository: () => ({
    findReceipt: async (_kind: string, aggregateId: string, commandId: string) =>
      state.receipts.get(`${aggregateId}:${commandId}`) ?? null,
    lockPendingEncounter: async () => null,
    createCompleted: async (input: Record<string, unknown>) => ({
      id: input.occurrenceId,
      version: 0
    }),
    appendReceipt: async (input: Record<string, unknown>) => {
      state.receipts.set(`${input.aggregateId}:${input.commandId}`, input)
    }
  }),
  withTransaction: async (db: DBLike, run: (transaction: DBLike) => Promise<unknown>) => run(db)
}))
vi.mock('../rules/encounterFeatureActionCapabilityDiscoveryRegistry.js', () => ({
  discoverEncounterFeatureActionCapabilities: state.calls.discoverFeatureActions
}))
vi.mock('./encounterRuleExecutionCommandContext.js', () => ({
  lockEncounterRuleExecutionCommandContext: state.calls.lockContext
}))
vi.mock('./encounterActorRuleEvaluation.js', () => ({
  evaluateEncounterActorRuleSnapshot: state.calls.evaluateSnapshot,
  refreshEncounterActorRuleSnapshot: (snapshot: unknown) => snapshot,
  findEncounterFeatureResource: (
    output: { actors: Array<{ actorId: string; featureResources: Array<{ featureId: string }> }> },
    actorId: string,
    featureId: string
  ) =>
    output.actors
      .find((actor) => actor.actorId === actorId)
      ?.featureResources.find((resource) => resource.featureId === featureId) ?? null
}))
vi.mock('./encounterActiveEffectTargetState.js', () => ({
  lockEncounterActiveEffectTargets: state.calls.lockTargets
}))
vi.mock('./encounterActionSettlementCore.js', () => ({
  prepareEncounterActionSettlementCore: state.calls.prepare,
  settleEncounterActionSettlementCore: state.calls.settle,
  withTargetEncounterFeatureResourceConsumption: ({
    prepared,
    consumption
  }: Record<string, unknown>) => ({
    ...(prepared as Record<string, unknown>),
    targetFeatureResourceConsumption: consumption
  })
}))
vi.mock('./encounterLegendaryResistanceDiscovery.js', () => ({
  discoverEncounterLegendaryResistanceCandidate: state.calls.discoverLegendaryResistance
}))
vi.mock('./encounterLegendaryResistanceChoice.js', () => ({
  startEncounterLegendaryResistanceChoice: state.calls.startLegendaryResistance
}))
vi.mock('./encounterProjection.js', () => ({
  compileEncounterCurrentProjection: state.calls.compileProjection,
  projectGm: (encounter: unknown) => encounter
}))
vi.mock('./encounterMovementReactionActionExecution.js', () => ({
  buildEncounterActionD20Evidence: () => ({
    requestId: ids.request,
    rollMode: 'NORMAL',
    rawFaces: [15],
    selectedNatural: 15,
    contributors: [],
    contributorChecksum: 'f'.repeat(64),
    modifier: 0,
    total: 15,
    defenseOrDc: 10,
    resultPath: 'ON_SAVE_FAIL'
  }),
  resolveEncounterActionD20Faces: () => [15],
  selectEncounterActionD20Natural: () => 15
}))
vi.mock('./encounterCleavingChoice.js', async (importOriginal) => ({
  ...(await importOriginal()),
  persistEncounterCleavingChoice: state.calls.persistCleaving
}))
vi.mock('@artificer-toolkit/schema/projections/encounter', () => ({
  encounterProjectionEventSchema: { parse: <T>(value: T) => value }
}))
vi.mock('../rules/ruleExecutionOccurrenceService.js', () => ({
  createRuleExecutionOccurrenceService: state.calls.occurrenceFactory
}))

import {
  executeEncounterActorDirectRuleAction,
  resumeEncounterActorDirectRuleAction
} from './encounterActorDirectRuleActionService.js'

const sourceActor = {
  id: ids.actor,
  kind: 'CHARACTER' as const,
  sourceId: ids.character,
  sourceRevision: 1,
  resources: {},
  conditions: []
}
const creatureActor: {
  id: string
  kind: 'CREATURE'
  sourceId: string | null
  sourceRevision: number
  resources: Record<string, never>
  conditions: never[]
} = {
  id: ids.creature,
  kind: 'CREATURE',
  sourceId: null,
  sourceRevision: 1 as number,
  resources: {},
  conditions: []
}
const creatureSourceActor = {
  ...creatureActor,
  id: ids.actor,
  sourceId: ids.creature,
  systemId: '00000000-0000-4000-8000-000000000013',
  snapshot: { payload: { abilityScores: { STRENGTH: 17 } } }
}
const customActor = { ...creatureActor, id: ids.custom, kind: 'CUSTOM' as const }
const characterActorWithoutSource = {
  ...creatureActor,
  kind: 'CHARACTER' as const,
  sourceId: null
}
type DirectActionTargetActor =
  | typeof creatureActor
  | typeof customActor
  | typeof sourceActor
  | typeof characterActorWithoutSource
const testDb = {} as DBLike
const testRuntime = {} as RulesRuntimeService

function encounter(
  target: DirectActionTargetActor = creatureActor,
  automationMode: 'AUTOMATIC' | 'ASSISTED' | 'MANUAL' = 'AUTOMATIC',
  source: typeof sourceActor | typeof creatureSourceActor = sourceActor
) {
  return {
    id: ids.encounter,
    campaignId: ids.campaign,
    version: 4,
    status: 'ACTIVE',
    currentActorId: source.id,
    automationMode,
    manualReminderMode: 'SUBTLE',
    actors: [source, target]
  }
}

function published() {
  return {
    id: ids.definition,
    checksum: 'a'.repeat(64),
    gameSystemId: '00000000-0000-4000-8000-000000000013',
    definitionFamilyKey: 'action',
    definition: {}
  }
}

function cloakerBiteCapability() {
  return {
    kind: 'ENCOUNTER_FEATURE' as const,
    actionId: ids.action,
    creatureSourceId: ids.creature,
    sourceRevision: 1,
    sourceVersionId: '00000000-0000-4000-8000-000000000014',
    sourceChecksum: '9'.repeat(64),
    ownerFeatureId: '00000000-0000-4000-8000-000000000015',
    featureOptionId: null,
    effectId: ids.definition,
    authoredEffectChecksum: '8'.repeat(64),
    compiledEffectChecksum: '7'.repeat(64),
    mechanicFacts: { kind: 'CLOAKER_BITE', damageExpression: '2d6+3' },
    compiledEffect: {
      invocation: {
        range: { rangeKind: 'UNLIMITED' },
        targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' },
        shape: null
      }
    }
  }
}

function legendaryResistanceCandidate() {
  return {
    targetActorId: ids.creature,
    ownerFeatureId: 'feature:legendary-resistance',
    chargeId: 'charge:legendary-resistance',
    featureCost: 1,
    poolBefore: 3,
    poolRemaining: 2,
    lifecycle: {
      definitionId: '00000000-0000-4000-8000-000000000014',
      definitionVersion: 1,
      definitionChecksum: '1'.repeat(64),
      choiceGraphDefinitionId: '00000000-0000-4000-8000-000000000015',
      choiceGraphDefinitionVersion: 1,
      choiceGraphDefinitionChecksum: '2'.repeat(64),
      useOutput: 'use',
      interruptedStage: 'AFTER_FAILED_SAVE_BEFORE_OUTCOME' as const,
      replacement: 'SAVE_SUCCESS' as const
    },
    choiceGraph: published()
  }
}

function setup(
  target: DirectActionTargetActor = creatureActor,
  automationMode: 'AUTOMATIC' | 'ASSISTED' | 'MANUAL' = 'AUTOMATIC',
  options: { characterActionRange?: boolean; twoPhase?: boolean; spellCast?: boolean } = {}
) {
  Object.values(state.calls).forEach((call) => call.mockReset())
  state.d20 = null
  state.executeMode = 'COMPLETE'
  state.legendaryResistanceUse = false
  state.pendingApplicationContext = null
  state.replay = null
  state.twoPhase = options.twoPhase ?? false
  const current = encounter(target, automationMode)
  state.currentEncounter = current
  const testPublished = published()
  const outcomePublished = (id: string, checksum: string) => ({
    ...published(),
    id,
    checksum
  })
  const failPublished = outcomePublished(ids.outcomeFail, '3'.repeat(64))
  const successPublished = outcomePublished(ids.outcomeSuccess, '4'.repeat(64))
  const entry = options.spellCast
    ? {
        actionId: ids.action,
        effectId: ids.definition,
        schemaVersion: 4,
        kind: 'CHARACTER_SPELL_CAST',
        spell: {
          spellId: ids.definition,
          versionId: ids.definition,
          version: 1,
          checksum: '9'.repeat(64),
          sourceKind: 'CLASS',
          sourceInstanceId: ids.action,
          castLevel: 1,
          castMode: 'SPELL_SLOT',
          slotKey: 'STANDARD:1',
          resourceOwnerKey: null
        },
        compilation: {
          kind: 'COMPILED',
          activeEffectPlan: null,
          executionPlan: { kind: 'SINGLE_GRAPH', published: published() }
        },
        targetPolicy: {
          range: { rangeKind: 'UNLIMITED' },
          targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' },
          shape: null,
          pathOverrides: []
        }
      }
    : state.twoPhase
      ? {
          actionId: ids.action,
          effectId: ids.definition,
          schemaVersion: 4,
          compilation: {
            kind: 'COMPILED',
            resourceBinding: null,
            activeEffectPlan: null,
            executionPlan: {
              kind: 'TEST_OUTCOME',
              compilerSource: {
                effectId: ids.definition,
                compilerSourceChecksum: '5'.repeat(64)
              },
              test: {
                published: testPublished,
                template: {
                  definitionId: testPublished.id,
                  gameSystemId: testPublished.gameSystemId,
                  definitionFamilyKey: testPublished.definitionFamilyKey,
                  checksum: testPublished.checksum
                }
              },
              outcomes: [
                {
                  pathCode: 'ON_SAVE_FAIL',
                  template: {
                    definitionId: failPublished.id,
                    gameSystemId: failPublished.gameSystemId,
                    definitionFamilyKey: failPublished.definitionFamilyKey,
                    checksum: failPublished.checksum
                  }
                },
                {
                  pathCode: 'ON_SAVE_SUCCESS',
                  template: {
                    definitionId: successPublished.id,
                    gameSystemId: successPublished.gameSystemId,
                    definitionFamilyKey: successPublished.definitionFamilyKey,
                    checksum: successPublished.checksum
                  }
                }
              ]
            }
          },
          targetPolicy: {
            range: { rangeKind: 'UNLIMITED' },
            targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' },
            shape: null,
            pathOverrides: []
          }
        }
      : {
          actionId: ids.action,
          effectId: ids.definition,
          schemaVersion: 1,
          compilation: { kind: 'COMPILED', published: published() },
          targetPolicy: {
            range: { rangeKind: 'UNLIMITED' },
            targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' },
            shape: null,
            pathOverrides: []
          }
        }
  const character = {
    id: ids.character,
    actor: sourceActor,
    streamVersion: 1,
    mechanics: {
      characterStreamVersion: 1,
      projectionChecksum: 'b'.repeat(64),
      compiledActionEntryPoints: [entry],
      rulePolicyInput: {
        actionCandidates: options.spellCast
          ? []
          : [
              {
                actionId: ids.action,
                effectId: ids.definition,
                ...(options.characterActionRange
                  ? {
                      mechanicFacts: {
                        invocation: {
                          range: {
                            id: 'range-id',
                            rangeKind: 'DISTANCE',
                            amount: 5,
                            unit: 'FEET'
                          }
                        }
                      }
                    }
                  : {})
              }
            ],
        spellCastCandidates: options.spellCast
          ? [
              {
                candidateId: ids.action,
                spellId: ids.definition,
                source: {
                  spellId: ids.definition,
                  sourceKind: 'CLASS',
                  sourceInstanceId: ids.action
                },
                castLevel: 1,
                castMode: 'SPELL_SLOT',
                resourceOwnerKey: null
              }
            ]
          : []
      },
      rulePolicyOutput: {
        spellCastDecisions: options.spellCast
          ? [{ candidateId: ids.action, status: 'AVAILABLE', slotKey: 'STANDARD:1' }]
          : [],
        spellCastMechanics: options.spellCast
          ? [
              {
                candidateId: ids.action,
                spellId: ids.definition,
                mechanics: [{ effectId: ids.definition }]
              }
            ]
          : []
      }
    },
    overlay: { mechanicalContextChecksum: 'c'.repeat(64) }
  }
  const targets = {
    lockedCharacters: new Map([[ids.character, character]]),
    encounterActorRules: {
      actors: [
        {
          actorId: target.id,
          featureResources: [
            {
              featureId: 'feature:legendary-resistance',
              used: 2,
              remaining: 3,
              maximum: 5
            }
          ]
        }
      ]
    }
  }
  state.calls.lockContext.mockImplementation(async () => ({
    context: {
      encounterId: ids.encounter,
      campaignId: ids.campaign,
      actorUserId: ids.user,
      currentVersion: 4,
      role: 'OWNER',
      assignedCharacterId: ids.character,
      attunementSlotOverride: null,
      advanceVersion: async () => 5
    },
    encounter: state.currentEncounter
  }))
  state.calls.evaluateSnapshot.mockImplementation(
    async ({ encounter: evaluatedEncounter }: { encounter: ReturnType<typeof encounter> }) => ({
      snapshot: { revisionId: 'revision', output: {} },
      reconciledEncounter: evaluatedEncounter,
      actorUpdates: []
    })
  )
  state.calls.lockTargets.mockImplementation(
    async ({ encounter: lockedEncounter }: { encounter: ReturnType<typeof encounter> }) => {
      const sourceVersion =
        lockedEncounter.actors.find((actor) => actor.id === ids.actor)?.sourceRevision ?? 1
      return {
        ...targets,
        lockedCharacters: new Map([
          [
            ids.character,
            {
              ...character,
              streamVersion: sourceVersion,
              mechanics: {
                ...character.mechanics,
                characterStreamVersion: sourceVersion
              }
            }
          ]
        ])
      }
    }
  )
  state.calls.lockMaintainedState.mockResolvedValue(null)
  state.calls.lockDependentEffects.mockResolvedValue([])
  state.calls.persistCleaving.mockResolvedValue(null)
  state.calls.discoverLegendaryResistance.mockResolvedValue(legendaryResistanceCandidate())
  state.calls.vocabulary.mockResolvedValue({
    document: { schemaVersion: 2, conditionTypes: [], abilities: [] }
  })
  state.calls.discoverFeatureActions.mockReturnValue([])
  state.calls.startLegendaryResistance.mockResolvedValue({
    request: { requestId: ids.request, kind: 'INTEGER_RANGE', min: 0, max: 1, nodeId: 'choice' }
  })
  state.calls.prepare.mockImplementation(async (input: Record<string, unknown>) => ({
    ...input,
    sourceActor:
      (input.encounter as { actors: (typeof sourceActor)[] }).actors.find(
        (actor) => actor.id === (input.actionSource as { actorId?: string }).actorId
      ) ?? sourceActor,
    targetActor:
      (input.encounter as { actors: (typeof creatureActor)[] }).actors.find(
        (actor) => actor.id === input.targetActorId
      ) ?? target,
    targets,
    actionSource: input.actionSource,
    executionPlan:
      state.twoPhase && (input.actionSource as { kind?: string }).kind === 'ENCOUNTER_FEATURE'
        ? (entry as { compilation: { executionPlan: unknown } }).compilation.executionPlan
        : undefined,
    resourceConsumption: { resourceId: 'resource', before: 1, after: 2 },
    action: {
      published: published(),
      actionMechanic: {},
      sourceDerivedFacts: {},
      target: {
        actorId:
          (input.encounter as { actors: (typeof creatureActor)[] }).actors.find(
            (actor) => actor.id === input.targetActorId
          )?.id ?? target.id,
        derivedFacts: {},
        conditionIds: [],
        currentHitPoints: 8,
        temporaryHitPoints: 0,
        maximumHitPoints: 8,
        defenses: [],
        conditionImmunityIds: []
      },
      adapter: {
        bindFacts: () =>
          state.d20
            ? {
                facts: {},
                d20RollMode: state.d20.rollMode,
                d20Audit: {
                  contributors: [],
                  contributorChecksum: 'f'.repeat(64),
                  modifier: 0,
                  defenseOrDc: 10
                }
              }
            : { facts: {} },
        interpret: () => [],
        interpretSaveSuccessReplacement: () => [],
        specializeOutcomeTemplate: state.twoPhase
          ? ({ selectedPath }: { selectedPath: string }) => {
              const selected = selectedPath === 'ON_SAVE_SUCCESS' ? successPublished : failPublished
              return {
                published: selected,
                templateChecksum: selected.checksum
              }
            }
          : undefined
      }
    }
  }))
  Object.assign(testRuntime, {
    executeResolvedWithGraph: vi.fn(
      async ({ published: selected }: { published: ReturnType<typeof published> }) => ({
        result:
          state.executeMode === 'OUTCOME_PAUSE' && selected.id === ids.outcomeFail
            ? {
                status: 'PAUSED' as const,
                continuation: {
                  request: {
                    requestId: `${ids.request}-outcome`,
                    kind: 'INTEGER_RANGE' as const,
                    min: 1,
                    max: 6,
                    nodeId: 'outcome-d6'
                  }
                }
              }
            : {
                status: 'COMPLETE' as const,
                outputs: { outcomeDefinitionId: selected.id },
                evidence: {
                  source: {
                    definitionId: selected.id,
                    gameSystemId: selected.gameSystemId,
                    definitionFamilyKey: selected.definitionFamilyKey,
                    checksum: selected.checksum
                  },
                  capabilityContractVersion: 1,
                  facts: {},
                  trace: [],
                  outputs: { outcomeDefinitionId: selected.id }
                }
              },
        graph: {}
      })
    )
  })
  state.calls.settle.mockImplementation(
    async (input: {
      prepared: { actionSource: { kind: string }; targetActor: { kind: string } }
    }) => ({
      application: {
        kind:
          input.prepared.targetActor.kind === 'CHARACTER'
            ? 'CHARACTER_MECHANICS_BATCH'
            : 'ENCOUNTER_ACTOR_MECHANICS_BATCH',
        schemaVersion: 1,
        occurrenceId: ids.occurrence,
        sourceActorId: ids.actor,
        targetActorId: target.id,
        sourceCharacterStreamVersion: null,
        resourceConsumption: null,
        spellCastConsumption:
          input.prepared.actionSource.kind === 'CHARACTER_SPELL_CAST'
            ? {
                spellId: ids.definition,
                spellVersionId: ids.definition,
                spellVersion: 1,
                spellChecksum: '9'.repeat(64),
                candidateId: ids.action,
                slotKey: 'STANDARD:1',
                beforeUsed: 0,
                afterUsed: 1
              }
            : null,
        featureResourceConsumption: null,
        targetFeatureResourceConsumption: null,
        d20: null,
        targetTransition: {
          before: {
            currentHitPoints: 8,
            temporaryHitPoints: 0,
            maximumHitPoints: 8,
            conditionIds: []
          },
          after: {
            currentHitPoints: 8,
            temporaryHitPoints: 0,
            maximumHitPoints: 8,
            conditionIds: []
          },
          checksum: 'd'.repeat(64)
        },
        applications: []
      },
      sourceActor: { ...sourceActor, sourceRevision: 2 },
      targetActor: target,
      characterTransitions: []
    })
  )
}

function command(targetActorId = ids.creature) {
  return {
    actionId: ids.action,
    actorId: ids.actor,
    actorUserId: ids.user,
    commandId: ids.command,
    correlationId: null,
    encounterId: ids.encounter,
    expectedEncounterVersion: 4,
    targetActorId
  }
}

function completeResult(application: unknown) {
  return {
    status: 'COMPLETE' as const,
    occurrenceId: ids.occurrence,
    occurrenceVersion: 1,
    outputs: {},
    evidence: { trace: [], outputs: {} },
    applicationOutputs: application
  }
}

function failedSaveExecution() {
  return {
    status: 'COMPLETE' as const,
    outputs: { resultPath: 'ON_SAVE_FAIL' },
    evidence: {
      source: {},
      trace: [
        {
          nodeId: 'roll',
          operation: { key: 'evidence.integer-range', contractVersion: 1 },
          inputs: { min: 1, max: 20 },
          outputs: {},
          evidence: { kind: 'INTEGER_RANGE' as const, requestId: ids.request, value: 15 }
        },
        {
          nodeId: 'save',
          operation: { key: 'dnd5e.saving-throw', contractVersion: 1 },
          inputs: {
            naturalD20: 15,
            modifier: 0,
            threshold: 10,
            contributorChecksum: 'f'.repeat(64)
          },
          outputs: {
            contributorChecksum: 'f'.repeat(64),
            total: 15,
            resultPath: 'ON_SAVE_FAIL'
          }
        }
      ],
      outputs: { resultPath: 'ON_SAVE_FAIL' }
    }
  }
}

function installOccurrenceSeam() {
  state.calls.occurrenceFactory.mockImplementation((config: Record<string, unknown>) => ({
    executeResolved: async (
      port: { withLockedAuthorized: Function },
      commandInput: Record<string, Function>
    ) => {
      if (state.replay) return state.replay
      return port.withLockedAuthorized({}, async (aggregate: unknown) => {
        const resolved = await commandInput.resolve({
          db: {},
          aggregate,
          occurrenceId: ids.occurrence
        })
        if (resolved.manualReceipt) {
          return { status: 'MANUAL', occurrenceId: ids.occurrence, occurrenceVersion: 0 }
        }
        if (state.twoPhase && state.executeMode === 'PAUSE') {
          resolved.validatePausedExecution({
            continuation: { request: { kind: 'INTEGER_RANGE', min: 1, max: 20, nodeId: 'roll' } },
            applicationContext: resolved.pendingApplicationContext
          })
          state.pendingApplicationContext = resolved.pendingApplicationContext
          return {
            status: 'PAUSED',
            occurrenceId: ids.occurrence,
            occurrenceVersion: 0,
            request: {
              requestId: ids.request,
              kind: 'INTEGER_RANGE',
              min: 1,
              max: 20,
              nodeId: 'roll'
            },
            pending: resolved.pendingResult
          }
        }
        if (state.twoPhase) {
          await resolved.resolveAutomaticEvidence({
            request: {
              requestId: ids.request,
              kind: 'INTEGER_RANGE',
              min: 1,
              max: 20,
              nodeId: 'roll'
            },
            occurrenceId: ids.occurrence
          })
          const transition = await resolved.postCompletedExecution({
            execution: failedSaveExecution(),
            occurrenceId: ids.occurrence,
            applicationContext: resolved.pendingApplicationContext
          })
          if (transition?.continuation) {
            state.pendingApplicationContext = transition.applicationContext
            return {
              status: 'PAUSED',
              occurrenceId: ids.occurrence,
              occurrenceVersion: 1,
              request: transition.continuation.request,
              pending: transition.pendingResult
            }
          }
          if (!transition?.execution)
            throw new Error('The v4 action did not enter its sealed OUTCOME.')
          const completion = await (config.completionApplicator as { apply: Function }).apply({
            db: {},
            occurrenceId: ids.occurrence,
            commandId: ids.command,
            correlationId: null,
            commandFingerprint: 'e'.repeat(64),
            proposedAggregateVersion: 5,
            pendingApplicationContext: transition.applicationContext,
            execution: transition.execution
          })
          const result = completeResult(completion.applicationOutputs)
          await completion.afterResult(result)
          return result
        }
        if (state.executeMode === 'BAD_PAUSE') {
          resolved.validatePausedExecution({
            continuation: { request: { kind: 'INTEGER_RANGE', min: 2, max: 20, nodeId: 'roll' } },
            applicationContext: resolved.pendingApplicationContext
          })
        }
        if (state.executeMode === 'PAUSE') {
          resolved.validatePausedExecution({
            continuation: { request: { kind: 'INTEGER_RANGE', min: 1, max: 20, nodeId: 'roll' } },
            applicationContext: resolved.pendingApplicationContext
          })
          state.pendingApplicationContext = resolved.pendingApplicationContext
          return {
            status: 'PAUSED',
            occurrenceId: ids.occurrence,
            occurrenceVersion: 0,
            request: {
              requestId: ids.request,
              kind: 'INTEGER_RANGE',
              min: 1,
              max: 20,
              nodeId: 'roll'
            },
            pending: resolved.pendingResult
          }
        }
        if (state.executeMode === 'LR_PAUSE') {
          await resolved.resolveAutomaticEvidence({
            request: {
              requestId: ids.request,
              kind: 'INTEGER_RANGE',
              min: 1,
              max: 20,
              nodeId: 'roll'
            },
            occurrenceId: ids.occurrence
          })
          const transition = await resolved.postCompletedExecution({
            execution: {
              status: 'COMPLETE',
              outputs: { resultPath: 'ON_SAVE_FAIL' },
              evidence: {
                trace: [
                  {
                    nodeId: 'roll',
                    operation: { key: 'evidence.integer-range', contractVersion: 1 },
                    inputs: { min: 1, max: 20 },
                    outputs: {},
                    evidence: { kind: 'INTEGER_RANGE', requestId: ids.request, value: 15 }
                  },
                  {
                    nodeId: 'save',
                    operation: { key: 'dnd5e.saving-throw', contractVersion: 1 },
                    inputs: {
                      naturalD20: 15,
                      modifier: 0,
                      threshold: 10,
                      contributorChecksum: 'f'.repeat(64)
                    },
                    outputs: {
                      contributorChecksum: 'f'.repeat(64),
                      total: 15,
                      resultPath: 'ON_SAVE_FAIL'
                    }
                  }
                ],
                outputs: { resultPath: 'ON_SAVE_FAIL' }
              }
            },
            occurrenceId: ids.occurrence,
            applicationContext: resolved.pendingApplicationContext
          })
          state.pendingApplicationContext = transition.applicationContext
          return {
            status: 'PAUSED',
            occurrenceId: ids.occurrence,
            occurrenceVersion: 1,
            request: {
              requestId: ids.request,
              kind: 'INTEGER_RANGE',
              min: 0,
              max: 1,
              nodeId: 'choice'
            },
            pending: transition.pendingResult
          }
        }
        const completion = await (config.completionApplicator as { apply: Function }).apply({
          db: {},
          occurrenceId: ids.occurrence,
          commandId: ids.command,
          correlationId: null,
          commandFingerprint: 'e'.repeat(64),
          proposedAggregateVersion: 5,
          execution: { status: 'COMPLETE', outputs: {}, evidence: { trace: [], outputs: {} } }
        })
        const result = completeResult(completion.applicationOutputs)
        await completion.afterResult(result)
        return result
      })
    },
    resume: async (_port: unknown, resumeCommand: Record<string, Function>) => {
      if (state.replay) return state.replay
      const context = (state.pendingApplicationContext ?? {
        kind: 'ENCOUNTER_ACTOR_RULE_ACTION',
        schemaVersion: 1,
        actionId: ids.action,
        sourceActorId: ids.actor,
        targetActorId: ids.creature,
        sourceCharacterId: ids.character,
        sourceCharacterStreamVersion: 1,
        sourceProjectionChecksum: 'b'.repeat(64),
        sourceMechanicalContextChecksum: 'c'.repeat(64),
        targetCurrentnessChecksum: 'x'.repeat(64),
        publishedDefinitionId: ids.definition,
        publishedDefinitionChecksum: 'a'.repeat(64),
        d20: {
          rollMode: 'NORMAL',
          contributors: [],
          contributorChecksum: 'f'.repeat(64),
          modifier: 0,
          defenseOrDc: 10
        }
      }) as Record<string, unknown>
      const resolved = await resumeCommand.resolve({
        db: {},
        aggregate: { aggregateId: ids.encounter },
        applicationContext: context,
        occurrenceId: ids.occurrence
      })
      if (state.executeMode === 'BAD_PAUSE') {
        resolved.validatePausedExecution({
          continuation: { request: { kind: 'INTEGER_RANGE', min: 1, max: 20, nodeId: 'roll-2' } },
          applicationContext: resolved.pendingApplicationContext
        })
      }
      if (JSON.stringify(resolved.pendingApplicationContext) !== JSON.stringify(context)) {
        throw new Error('Direct Encounter action pending currentness changed.')
      }
      const outcomePending =
        (context.kind === 'ENCOUNTER_ACTOR_RULE_ACTION' ||
          context.kind === 'ENCOUNTER_CREATURE_RULE_ACTION') &&
        (context as { twoPhase?: { phase?: string } }).twoPhase?.phase === 'OUTCOME'
      await resumeCommand.deriveResponse({
        applicationContext: context,
        request: outcomePending
          ? {
              kind: 'INTEGER_RANGE',
              min: 1,
              max: 6,
              nodeId: 'outcome-d6',
              requestId: `${ids.request}-outcome`
            }
          : { kind: 'INTEGER_RANGE', min: 1, max: 20, nodeId: 'roll', requestId: ids.request }
      })
      if (state.executeMode === 'LR_PAUSE') {
        const transition = await resolved.postCompletedExecution({
          execution: {
            status: 'COMPLETE',
            outputs: { resultPath: 'ON_SAVE_FAIL' },
            evidence: {
              trace: [
                {
                  nodeId: 'roll',
                  operation: { key: 'evidence.integer-range', contractVersion: 1 },
                  inputs: { min: 1, max: 20 },
                  outputs: {},
                  evidence: { kind: 'INTEGER_RANGE', requestId: ids.request, value: 15 }
                },
                {
                  nodeId: 'save',
                  operation: { key: 'dnd5e.saving-throw', contractVersion: 1 },
                  inputs: {
                    naturalD20: 15,
                    modifier: 0,
                    threshold: 10,
                    contributorChecksum: 'f'.repeat(64)
                  },
                  outputs: {
                    contributorChecksum: 'f'.repeat(64),
                    total: 15,
                    resultPath: 'ON_SAVE_FAIL'
                  }
                }
              ],
              outputs: { resultPath: 'ON_SAVE_FAIL' }
            }
          },
          occurrenceId: ids.occurrence,
          applicationContext: context
        })
        state.pendingApplicationContext = transition.applicationContext
        return {
          status: 'PAUSED',
          occurrenceId: ids.occurrence,
          occurrenceVersion: 1,
          request: {
            requestId: ids.request,
            kind: 'INTEGER_RANGE',
            min: 0,
            max: 1,
            nodeId: 'choice'
          },
          pending: transition.pendingResult
        }
      }
      const choiceExecution = {
        status: 'COMPLETE' as const,
        outputs: state.legendaryResistanceUse ? { use: true } : { resultPath: 'ON_SAVE_FAIL' },
        evidence: { source: {}, trace: [], outputs: {} }
      }
      const transition = state.twoPhase
        ? await resolved.postCompletedExecution({
            execution: choiceExecution,
            occurrenceId: ids.occurrence,
            applicationContext: context
          })
        : null
      if (transition?.continuation) {
        state.pendingApplicationContext = transition.applicationContext
        return {
          status: 'PAUSED',
          occurrenceId: ids.occurrence,
          occurrenceVersion: 2,
          request: transition.continuation.request,
          pending: transition.pendingResult
        }
      }
      const completion = await (config.completionApplicator as { apply: Function }).apply({
        db: {},
        occurrenceId: ids.occurrence,
        commandId: ids.command,
        correlationId: null,
        commandFingerprint: 'e'.repeat(64),
        proposedAggregateVersion: 5,
        pendingApplicationContext: transition?.applicationContext ?? context,
        execution: transition?.execution ?? choiceExecution
      })
      const result = completeResult(completion.applicationOutputs)
      await completion.afterResult(result)
      return result
    }
  }))
}

function resumeCommand(resolution: unknown = { kind: 'SYSTEM', requestId: ids.request }) {
  return {
    actorUserId: ids.user,
    commandId: ids.command,
    correlationId: null,
    encounterId: ids.encounter,
    expectedEncounterVersion: 4,
    expectedOccurrenceVersion: 0,
    occurrenceId: ids.occurrence,
    resolution
  }
}

describe('encounter actor direct rule actions', () => {
  it('reuses a supplied locked Encounter for one terminal settlement and CAS', async () => {
    setup(creatureActor)
    state.receipts.clear()
    const { createRuleExecutionOccurrenceService } = await vi.importActual<
      typeof import('../rules/ruleExecutionOccurrenceService.js')
    >('../rules/ruleExecutionOccurrenceService.js')
    const prepare = state.calls.prepare.getMockImplementation()!
    state.calls.prepare.mockImplementation(async (input: Record<string, unknown>) => {
      const prepared = await prepare(input)
      return {
        ...prepared,
        action: {
          ...prepared.action,
          published: {
            ...prepared.action.published,
            definition: {
              schemaVersion: 1,
              id: ids.definition,
              gameSystemId: prepared.action.published.gameSystemId,
              definitionFamilyKey: prepared.action.published.definitionFamilyKey,
              nodes: [
                {
                  id: 'result',
                  operation: { key: 'number.add', contractVersion: 1 },
                  inputs: {
                    left: { kind: 'LITERAL', value: 1 },
                    right: { kind: 'LITERAL', value: 1 }
                  }
                }
              ],
              outputs: { result: { kind: 'NODE_OUTPUT', nodeId: 'result', port: 'value' } }
            }
          }
        }
      }
    })
    let currentVersion = 4
    const advanceVersion = vi.fn(async (expectedVersion: number) => {
      if (expectedVersion !== currentVersion) throw new Error('Encounter changed before execution.')
      return ++currentVersion
    })
    const rootPort = {
      async withLockedAuthorized(
        db: DBLike,
        run: (aggregate: {
          aggregateId: string
          aggregateKind: 'ENCOUNTER'
          actorUserId: string
          campaignId: string
          currentVersion: number
          advanceVersion: (_advanceDb: unknown, expectedVersion: number) => Promise<number>
        }) => Promise<unknown>
      ) {
        if (db !== testDb)
          throw new Error('Encounter root occurrence escaped its owning transaction.')
        return run({
          aggregateId: ids.encounter,
          aggregateKind: 'ENCOUNTER',
          actorUserId: ids.user,
          campaignId: ids.campaign,
          get currentVersion() {
            return currentVersion
          },
          advanceVersion: (advanceDb, expectedVersion) => {
            if (advanceDb !== testDb)
              throw new Error('Encounter root occurrence escaped its owning transaction.')
            return advanceVersion(expectedVersion)
          }
        })
      }
    }
    const createRootOccurrencePort = vi.fn(() => rootPort)
    const createReceiptOnlyChildOccurrencePort = vi.fn(() => rootPort)
    const lockedEncounter = {
      context: {
        encounterId: ids.encounter,
        campaignId: ids.campaign,
        actorUserId: ids.user,
        currentVersion: 4,
        role: 'OWNER',
        assignedCharacterId: ids.character,
        attunementSlotOverride: null,
        advanceVersion,
        createRootOccurrencePort,
        createReceiptOnlyChildOccurrencePort
      },
      encounter: state.currentEncounter
    } as unknown as NonNullable<
      Parameters<typeof executeEncounterActorDirectRuleAction>[0]['lockedEncounter']
    >
    state.calls.occurrenceFactory.mockImplementation(
      (input: Parameters<typeof createRuleExecutionOccurrenceService>[0]) =>
        createRuleExecutionOccurrenceService({ ...input, createOccurrenceId: () => ids.occurrence })
    )

    const completed = await executeEncounterActorDirectRuleAction({
      db: testDb,
      runtime: testRuntime,
      command: command(),
      lockedEncounter
    })
    await expect(
      executeEncounterActorDirectRuleAction({
        db: testDb,
        runtime: testRuntime,
        command: command(),
        lockedEncounter
      })
    ).resolves.toEqual(completed)

    expect(state.calls.lockContext).not.toHaveBeenCalled()
    expect(createRootOccurrencePort).toHaveBeenCalledTimes(2)
    expect(advanceVersion).toHaveBeenCalledTimes(1)
    expect(state.calls.settle).toHaveBeenCalledTimes(1)
    expect(state.calls.prepare).toHaveBeenCalledTimes(1)

    const wrongIdentity = {
      ...lockedEncounter,
      context: { ...lockedEncounter.context, actorUserId: ids.character }
    }
    await expect(
      executeEncounterActorDirectRuleAction({
        db: testDb,
        runtime: testRuntime,
        command: command(),
        lockedEncounter: wrongIdentity
      })
    ).rejects.toThrow('context is stale')

    const resolverCalls = state.calls.prepare.mock.calls.length
    await expect(
      executeEncounterActorDirectRuleAction({
        db: testDb,
        runtime: testRuntime,
        command: { ...command(), commandId: ids.request },
        lockedEncounter
      })
    ).rejects.toThrow('expected aggregate version 4, but found 5')
    expect(state.calls.prepare).toHaveBeenCalledTimes(resolverCalls)
    expect(advanceVersion).toHaveBeenCalledTimes(1)
    expect(state.calls.settle).toHaveBeenCalledTimes(1)
  })

  it('resolves an exact compiled spell-cast source through the direct-action lane', async () => {
    setup(creatureActor, 'AUTOMATIC', { spellCast: true })
    installOccurrenceSeam()

    await expect(
      executeEncounterActorDirectRuleAction({
        db: testDb,
        runtime: testRuntime,
        command: command()
      })
    ).resolves.toMatchObject({ status: 'COMPLETE', occurrenceId: ids.occurrence })

    expect(state.calls.prepare).toHaveBeenCalledWith(
      expect.objectContaining({
        actionSource: expect.objectContaining({
          kind: 'CHARACTER_SPELL_CAST',
          entry: expect.objectContaining({
            actionId: ids.action,
            spell: expect.objectContaining({ slotKey: 'STANDARD:1' })
          })
        })
      })
    )
    expect(state.calls.settle).toHaveBeenCalledTimes(1)
  })

  it('settles a terminal spell cast once with a sealed slot receipt', async () => {
    setup(creatureActor, 'AUTOMATIC', { spellCast: true })
    installOccurrenceSeam()

    const result = await executeEncounterActorDirectRuleAction({
      db: testDb,
      runtime: testRuntime,
      command: command()
    })

    expect(result).toMatchObject({
      status: 'COMPLETE',
      occurrenceId: ids.occurrence,
      application: {
        spellCastConsumption: {
          candidateId: ids.action,
          slotKey: 'STANDARD:1',
          beforeUsed: 0,
          afterUsed: 1
        }
      }
    })
    expect(state.calls.settle).toHaveBeenCalledTimes(1)
    expect(state.calls.appendEvent).toHaveBeenCalledTimes(1)
  })

  it('pauses an Assisted spell cast without consuming a slot, then consumes it once at terminal resume', async () => {
    setup(creatureActor, 'ASSISTED', { spellCast: true })
    state.d20 = { rollMode: 'NORMAL' }
    state.executeMode = 'PAUSE'
    installOccurrenceSeam()

    const paused = await executeEncounterActorDirectRuleAction({
      db: testDb,
      runtime: testRuntime,
      command: command()
    })
    expect(paused).toMatchObject({ status: 'PENDING', occurrenceId: ids.occurrence })
    expect(state.calls.settle).not.toHaveBeenCalled()
    expect(state.calls.appendEvent).not.toHaveBeenCalled()

    state.executeMode = 'COMPLETE'
    const completed = await resumeEncounterActorDirectRuleAction({
      db: testDb,
      runtime: testRuntime,
      command: resumeCommand()
    })

    expect(completed).toMatchObject({
      status: 'COMPLETE',
      occurrenceId: ids.occurrence,
      application: {
        spellCastConsumption: {
          slotKey: 'STANDARD:1',
          beforeUsed: 0,
          afterUsed: 1
        }
      }
    })
    expect(state.calls.settle).toHaveBeenCalledTimes(1)
    expect(state.calls.appendEvent).toHaveBeenCalledTimes(1)
  })

  it('replays a terminal spell-cast receipt without a second slot consumption', async () => {
    setup(creatureActor, 'AUTOMATIC', { spellCast: true })
    installOccurrenceSeam()

    const completed = await executeEncounterActorDirectRuleAction({
      db: testDb,
      runtime: testRuntime,
      command: command()
    })
    state.replay = completeResult(
      completed.status === 'COMPLETE' ? completed.application : { kind: 'UNREACHABLE' }
    )
    const replay = await executeEncounterActorDirectRuleAction({
      db: testDb,
      runtime: testRuntime,
      command: command()
    })

    expect(replay).toEqual(completed)
    expect(state.calls.settle).toHaveBeenCalledTimes(1)
    expect(state.calls.appendEvent).toHaveBeenCalledTimes(1)
  })

  it('rejects stale Assisted spell-cast target currentness before slot consumption or receipt', async () => {
    setup(creatureActor, 'ASSISTED', { spellCast: true })
    state.d20 = { rollMode: 'NORMAL' }
    state.executeMode = 'PAUSE'
    installOccurrenceSeam()
    await executeEncounterActorDirectRuleAction({
      db: testDb,
      runtime: testRuntime,
      command: command()
    })
    state.currentEncounter = encounter({ ...creatureActor, sourceRevision: 2 }, 'ASSISTED')
    state.executeMode = 'COMPLETE'
    await expect(
      resumeEncounterActorDirectRuleAction({
        db: testDb,
        runtime: testRuntime,
        command: resumeCommand()
      })
    ).rejects.toThrow('pending currentness changed')
    expect(state.calls.settle).not.toHaveBeenCalled()
    expect(state.calls.appendEvent).not.toHaveBeenCalled()
  })

  it('uses one immutable Creature feature source lane for Character and Encounter targets', async () => {
    const capability = cloakerBiteCapability()
    const characterTarget = { ...sourceActor, id: ids.character }
    setup(characterTarget)
    state.calls.discoverFeatureActions.mockReturnValue([capability])
    state.currentEncounter = encounter(characterTarget, 'AUTOMATIC', creatureSourceActor)
    installOccurrenceSeam()

    const characterResult = await executeEncounterActorDirectRuleAction({
      db: testDb,
      runtime: testRuntime,
      command: command(ids.character)
    })
    expect(characterResult).toMatchObject({
      status: 'COMPLETE',
      application: { kind: 'CHARACTER_MECHANICS_BATCH' }
    })
    if (characterResult.status !== 'COMPLETE') {
      throw new Error('Expected the automatic Creature action to complete.')
    }
    expect(characterResult.application).not.toHaveProperty('legendaryResistance')
    expect(state.calls.prepare).toHaveBeenCalledWith(
      expect.objectContaining({
        actionSource: expect.objectContaining({
          kind: 'ENCOUNTER_FEATURE',
          capability: expect.objectContaining({
            creatureSourceId: ids.creature,
            compiledEffectChecksum: capability.compiledEffectChecksum
          })
        })
      })
    )
    const prepareCalls = state.calls.prepare.mock.calls.length
    state.replay = completeResult(characterResult.application)
    await expect(
      executeEncounterActorDirectRuleAction({
        db: testDb,
        runtime: testRuntime,
        command: command(ids.character)
      })
    ).resolves.toMatchObject({ status: 'COMPLETE' })
    expect(state.calls.prepare).toHaveBeenCalledTimes(prepareCalls)

    setup(creatureActor)
    state.calls.discoverFeatureActions.mockReturnValue([capability])
    state.currentEncounter = encounter(creatureActor, 'AUTOMATIC', creatureSourceActor)
    installOccurrenceSeam()
    const actorResult = await executeEncounterActorDirectRuleAction({
      db: testDb,
      runtime: testRuntime,
      command: command(ids.creature)
    })
    expect(actorResult).toMatchObject({
      status: 'COMPLETE',
      application: { kind: 'ENCOUNTER_ACTOR_MECHANICS_BATCH' }
    })
    if (actorResult.status !== 'COMPLETE') {
      throw new Error('Expected the automatic Creature action to complete.')
    }
  })

  it('seals Character Cleaving currentness from the post-resource stream version', async () => {
    setup(creatureActor, 'AUTOMATIC', { characterActionRange: true })
    state.calls.settle.mockResolvedValue({
      application: {
        kind: 'ENCOUNTER_ACTOR_MECHANICS_BATCH',
        schemaVersion: 1,
        occurrenceId: ids.occurrence,
        sourceActorId: ids.actor,
        targetActorId: ids.creature,
        sourceCharacterStreamVersion: 2,
        resourceConsumption: { resourceId: 'resource', before: 1, after: 2 },
        featureResourceConsumption: null,
        targetFeatureResourceConsumption: null,
        d20: null,
        targetTransition: { before: {}, after: {}, checksum: 'd'.repeat(64) },
        applications: []
      },
      sourceActor: { ...sourceActor, sourceRevision: 2 },
      targetActor: creatureActor,
      characterTransitions: [
        {
          characterId: ids.character,
          beforeStreamVersion: 1,
          afterStreamVersion: 2
        }
      ]
    })
    installOccurrenceSeam()

    await expect(
      executeEncounterActorDirectRuleAction({
        db: testDb,
        runtime: testRuntime,
        command: command()
      })
    ).resolves.toMatchObject({ status: 'COMPLETE' })

    expect(state.calls.lockTargets).toHaveBeenCalledTimes(2)
    expect(state.calls.persistCleaving).toHaveBeenCalledWith(
      expect.objectContaining({
        encounter: expect.objectContaining({
          actors: expect.arrayContaining([
            expect.objectContaining({ id: ids.actor, sourceRevision: 2 })
          ])
        }),
        sourceCurrentness: expect.objectContaining({
          kind: 'CHARACTER',
          characterId: ids.character,
          streamVersion: 2
        })
      })
    )
  })

  it('seals Assisted Creature evidence and rejects a changed immutable capability', async () => {
    const capability = cloakerBiteCapability()
    setup(creatureActor, 'ASSISTED')
    state.calls.discoverFeatureActions.mockReturnValue([capability])
    state.currentEncounter = encounter(creatureActor, 'ASSISTED', creatureSourceActor)
    state.d20 = { rollMode: 'NORMAL' }
    state.executeMode = 'PAUSE'
    installOccurrenceSeam()

    await expect(
      executeEncounterActorDirectRuleAction({
        db: testDb,
        runtime: testRuntime,
        command: command(ids.creature)
      })
    ).resolves.toMatchObject({ status: 'PENDING' })
    expect(state.pendingApplicationContext).toMatchObject({
      kind: 'ENCOUNTER_CREATURE_RULE_ACTION',
      sourceChecksum: capability.sourceChecksum
    })

    state.calls.discoverFeatureActions.mockReturnValue([
      { ...capability, sourceChecksum: '6'.repeat(64) }
    ])
    await expect(
      resumeEncounterActorDirectRuleAction({
        db: testDb,
        runtime: testRuntime,
        command: resumeCommand()
      })
    ).rejects.toThrow('Creature action source is stale')
    expect(state.calls.settle).not.toHaveBeenCalled()
  })

  it.each([
    ['Creature', creatureActor, ids.creature],
    ['Custom', customActor, ids.custom]
  ])(
    'settles Character to %s and closes projection/event once',
    async (_kind, target, targetId) => {
      setup(target)
      installOccurrenceSeam()
      const result = await executeEncounterActorDirectRuleAction({
        db: testDb,
        runtime: testRuntime,
        command: command(targetId)
      })
      expect(result.status).toBe('COMPLETE')
      expect(state.calls.settle).toHaveBeenCalledTimes(1)
      expect(state.calls.publishProjection).toHaveBeenCalledTimes(1)
      expect(state.calls.appendEvent).toHaveBeenCalledWith(
        expect.objectContaining({ version: 5, commandId: ids.command })
      )
    }
  )

  it('records Manual without runtime, settlement, version, event, or projection mutation', async () => {
    setup(creatureActor, 'MANUAL')
    installOccurrenceSeam()
    const result = await executeEncounterActorDirectRuleAction({
      db: testDb,
      runtime: testRuntime,
      command: command()
    })
    expect(result.status).toBe('MANUAL')
    expect(state.calls.settle).not.toHaveBeenCalled()
    expect(state.calls.publishProjection).not.toHaveBeenCalled()
    expect(state.calls.appendEvent).not.toHaveBeenCalled()
  })

  it('turns an Assisted failed-save d20 resume into the same occurrence Legendary Resistance pause', async () => {
    setup(creatureActor, 'ASSISTED')
    state.d20 = { rollMode: 'NORMAL' }
    state.executeMode = 'PAUSE'
    installOccurrenceSeam()
    await executeEncounterActorDirectRuleAction({
      db: testDb,
      runtime: testRuntime,
      command: command()
    })
    state.executeMode = 'LR_PAUSE'
    const paused = await resumeEncounterActorDirectRuleAction({
      db: testDb,
      runtime: testRuntime,
      command: resumeCommand({ kind: 'PHYSICAL', requestId: ids.request, rawFaces: [17] })
    })
    expect(paused).toMatchObject({ status: 'PENDING' })
    expect(state.calls.settle).not.toHaveBeenCalled()
    expect(state.calls.appendEvent).not.toHaveBeenCalled()
  })

  it('executes the sealed failed-save OUTCOME when no Legendary Resistance is available', async () => {
    setup(creatureActor, 'AUTOMATIC', { twoPhase: true })
    state.d20 = { rollMode: 'NORMAL' }
    state.calls.discoverLegendaryResistance.mockResolvedValue(null)
    installOccurrenceSeam()

    const completed = await executeEncounterActorDirectRuleAction({
      db: testDb,
      runtime: testRuntime,
      command: command()
    })

    expect(completed).toMatchObject({ status: 'COMPLETE' })
    expect(testRuntime.executeResolvedWithGraph).toHaveBeenCalledWith(
      expect.objectContaining({
        published: expect.objectContaining({ id: ids.outcomeFail })
      })
    )
    expect(state.calls.settle).toHaveBeenCalledTimes(1)
  })

  it('runs an immutable Creature TEST/OUTCOME action through the sealed OUTCOME exactly once', async () => {
    const capability = cloakerBiteCapability()
    setup(creatureActor, 'AUTOMATIC', { twoPhase: true })
    state.currentEncounter = encounter(creatureActor, 'AUTOMATIC', creatureSourceActor)
    state.calls.discoverFeatureActions.mockReturnValue([capability])
    state.d20 = { rollMode: 'NORMAL' }
    state.calls.discoverLegendaryResistance.mockResolvedValue(null)
    installOccurrenceSeam()

    await expect(
      executeEncounterActorDirectRuleAction({
        db: testDb,
        runtime: testRuntime,
        command: command()
      })
    ).resolves.toMatchObject({ status: 'COMPLETE' })
    expect(testRuntime.executeResolvedWithGraph).toHaveBeenCalledWith(
      expect.objectContaining({ published: expect.objectContaining({ id: ids.outcomeFail }) })
    )
    expect(state.calls.settle).toHaveBeenCalledTimes(1)
  })

  it('resumes Assisted Creature TEST evidence into an OUTCOME d6 pause, then settles and replays', async () => {
    const capability = cloakerBiteCapability()
    setup(creatureActor, 'ASSISTED', { twoPhase: true })
    state.currentEncounter = encounter(creatureActor, 'ASSISTED', creatureSourceActor)
    state.calls.discoverFeatureActions.mockReturnValue([capability])
    state.d20 = { rollMode: 'NORMAL' }
    state.calls.discoverLegendaryResistance.mockResolvedValue(null)
    state.executeMode = 'PAUSE'
    installOccurrenceSeam()

    await expect(
      executeEncounterActorDirectRuleAction({
        db: testDb,
        runtime: testRuntime,
        command: command()
      })
    ).resolves.toMatchObject({ status: 'PENDING' })
    expect(state.pendingApplicationContext).toMatchObject({
      kind: 'ENCOUNTER_CREATURE_RULE_ACTION',
      twoPhase: { phase: 'TEST' }
    })

    state.executeMode = 'OUTCOME_PAUSE'
    const outcomePause = await resumeEncounterActorDirectRuleAction({
      db: testDb,
      runtime: testRuntime,
      command: resumeCommand({ kind: 'PHYSICAL', requestId: ids.request, rawFaces: [17] })
    })
    expect(outcomePause).toMatchObject({
      status: 'PENDING',
      phase: 'OUTCOME',
      requests: [expect.objectContaining({ min: 1, max: 6 })]
    })
    expect(state.pendingApplicationContext).toMatchObject({
      kind: 'ENCOUNTER_CREATURE_RULE_ACTION',
      twoPhase: { phase: 'OUTCOME' }
    })

    state.executeMode = 'COMPLETE'
    const completed = await resumeEncounterActorDirectRuleAction({
      db: testDb,
      runtime: testRuntime,
      command: resumeCommand({
        kind: 'PHYSICAL_OUTCOME',
        values: [{ requestId: `${ids.request}-outcome`, value: 4 }]
      })
    })
    expect(completed).toMatchObject({ status: 'COMPLETE' })
    if (completed.status !== 'COMPLETE') {
      throw new Error('Expected the Creature OUTCOME to complete.')
    }
    expect(state.calls.settle).toHaveBeenCalledTimes(1)
    const runtimeCalls = (testRuntime.executeResolvedWithGraph as ReturnType<typeof vi.fn>).mock
      .calls.length
    const settleCalls = state.calls.settle.mock.calls.length
    state.replay = completeResult(completed.application)
    await expect(
      resumeEncounterActorDirectRuleAction({
        db: testDb,
        runtime: testRuntime,
        command: resumeCommand({
          kind: 'PHYSICAL_OUTCOME',
          values: [{ requestId: `${ids.request}-outcome`, value: 4 }]
        })
      })
    ).resolves.toMatchObject({ status: 'COMPLETE' })
    expect(
      (testRuntime.executeResolvedWithGraph as ReturnType<typeof vi.fn>).mock.calls
    ).toHaveLength(runtimeCalls)
    expect(state.calls.settle).toHaveBeenCalledTimes(settleCalls)
    expect(state.calls.appendEvent).toHaveBeenCalledTimes(1)
    expect(state.calls.publishProjection).toHaveBeenCalledTimes(1)
  })

  it('carries Legendary Resistance through the sealed success OUTCOME and consumes once', async () => {
    setup(creatureActor, 'AUTOMATIC', { twoPhase: true })
    state.d20 = { rollMode: 'NORMAL' }
    installOccurrenceSeam()

    const pending = await executeEncounterActorDirectRuleAction({
      db: testDb,
      runtime: testRuntime,
      command: command()
    })
    expect(pending).toMatchObject({ status: 'PENDING' })

    state.legendaryResistanceUse = true
    const completed = await resumeEncounterActorDirectRuleAction({
      db: testDb,
      runtime: testRuntime,
      command: resumeCommand({ kind: 'LEGENDARY_RESISTANCE', selection: 'USE' })
    })

    expect(completed).toMatchObject({
      status: 'COMPLETE',
      application: { legendaryResistance: { use: true } }
    })
    expect(testRuntime.executeResolvedWithGraph).toHaveBeenCalledWith(
      expect.objectContaining({
        published: expect.objectContaining({ id: ids.outcomeSuccess })
      })
    )
    expect(state.calls.settle).toHaveBeenCalledTimes(1)
    expect(state.calls.settle).toHaveBeenCalledWith(
      expect.objectContaining({
        prepared: expect.objectContaining({
          targetFeatureResourceConsumption: expect.objectContaining({
            beforeUsed: 2,
            afterUsed: 3
          })
        })
      })
    )
  })

  it('opens and settles the existing Legendary Resistance choice for a Creature source', async () => {
    const capability = cloakerBiteCapability()
    setup(creatureActor, 'AUTOMATIC', { twoPhase: true })
    state.currentEncounter = encounter(creatureActor, 'AUTOMATIC', creatureSourceActor)
    state.calls.discoverFeatureActions.mockReturnValue([capability])
    state.d20 = { rollMode: 'NORMAL' }
    installOccurrenceSeam()

    await expect(
      executeEncounterActorDirectRuleAction({
        db: testDb,
        runtime: testRuntime,
        command: command()
      })
    ).resolves.toMatchObject({ status: 'PENDING' })
    expect(state.pendingApplicationContext).toMatchObject({
      kind: 'ENCOUNTER_CREATURE_RULE_ACTION',
      phase: { kind: 'LEGENDARY_RESISTANCE_CHOICE' }
    })

    state.legendaryResistanceUse = true
    await expect(
      resumeEncounterActorDirectRuleAction({
        db: testDb,
        runtime: testRuntime,
        command: resumeCommand({ kind: 'LEGENDARY_RESISTANCE', selection: 'USE' })
      })
    ).resolves.toMatchObject({
      status: 'COMPLETE',
      application: { legendaryResistance: { use: true } }
    })
    expect(state.calls.settle).toHaveBeenCalledTimes(1)
  })

  it('rejects a mismatched Assisted d20 request before settlement', async () => {
    setup(creatureActor, 'ASSISTED')
    state.d20 = { rollMode: 'NORMAL' }
    state.executeMode = 'PAUSE'
    installOccurrenceSeam()
    await executeEncounterActorDirectRuleAction({
      db: testDb,
      runtime: testRuntime,
      command: command()
    })

    await expect(
      resumeEncounterActorDirectRuleAction({
        db: testDb,
        runtime: testRuntime,
        command: resumeCommand({ kind: 'SYSTEM', requestId: 'stale-request' })
      })
    ).rejects.toThrow('roll request is unavailable')
    expect(state.calls.settle).not.toHaveBeenCalled()
  })

  it('denies a player LR choice and rejects a stale charge before settlement', async () => {
    setup(creatureActor, 'AUTOMATIC')
    state.d20 = { rollMode: 'NORMAL' }
    state.executeMode = 'LR_PAUSE'
    installOccurrenceSeam()
    await executeEncounterActorDirectRuleAction({
      db: testDb,
      runtime: testRuntime,
      command: command()
    })
    const locked = state.calls.lockContext.getMockImplementation()!
    state.calls.lockContext.mockImplementation(async () => {
      const value = await locked()
      return { ...value, context: { ...value.context, role: 'PLAYER' } }
    })
    await expect(
      resumeEncounterActorDirectRuleAction({
        db: testDb,
        runtime: testRuntime,
        command: resumeCommand({ kind: 'LEGENDARY_RESISTANCE', selection: 'USE' })
      })
    ).rejects.toThrow('choice is unavailable')
    expect(state.calls.settle).not.toHaveBeenCalled()

    setup(creatureActor, 'AUTOMATIC')
    state.d20 = { rollMode: 'NORMAL' }
    state.executeMode = 'LR_PAUSE'
    installOccurrenceSeam()
    await executeEncounterActorDirectRuleAction({
      db: testDb,
      runtime: testRuntime,
      command: command()
    })
    state.calls.discoverLegendaryResistance.mockResolvedValue({
      ...legendaryResistanceCandidate(),
      poolBefore: 2,
      poolRemaining: 1
    })
    await expect(
      resumeEncounterActorDirectRuleAction({
        db: testDb,
        runtime: testRuntime,
        command: resumeCommand({ kind: 'LEGENDARY_RESISTANCE', selection: 'USE' })
      })
    ).rejects.toThrow('source is stale')
    expect(state.calls.settle).not.toHaveBeenCalled()
  })

  it('rejects corrupted persisted Legendary Resistance action evidence before settlement', async () => {
    setup(creatureActor, 'AUTOMATIC')
    state.d20 = { rollMode: 'NORMAL' }
    state.executeMode = 'LR_PAUSE'
    installOccurrenceSeam()
    await executeEncounterActorDirectRuleAction({
      db: testDb,
      runtime: testRuntime,
      command: command()
    })
    const context = state.pendingApplicationContext as {
      phase: { originalExecutionChecksum: string }
    }
    context.phase.originalExecutionChecksum = 'f'.repeat(64)

    await expect(
      resumeEncounterActorDirectRuleAction({
        db: testDb,
        runtime: testRuntime,
        command: resumeCommand({ kind: 'LEGENDARY_RESISTANCE', selection: 'USE' })
      })
    ).rejects.toThrow('pending action evidence is invalid')
    expect(state.calls.settle).not.toHaveBeenCalled()
  })

  it('redacts a pending Legendary Resistance choice for a non-GM controller', async () => {
    setup(creatureActor, 'AUTOMATIC')
    state.d20 = { rollMode: 'NORMAL' }
    state.executeMode = 'LR_PAUSE'
    const locked = state.calls.lockContext.getMockImplementation()!
    state.calls.lockContext.mockImplementation(async () => {
      const value = await locked()
      return { ...value, context: { ...value.context, role: 'PLAYER' } }
    })
    installOccurrenceSeam()

    const pending = await executeEncounterActorDirectRuleAction({
      db: testDb,
      runtime: testRuntime,
      command: command()
    })

    expect(pending).toMatchObject({ status: 'PENDING' })
    expect(pending).not.toHaveProperty('legendaryResistance')
    expect(state.calls.settle).not.toHaveBeenCalled()
  })

  it('returns stored d20 roll mode for Assisted pause and replay without source resolution', async () => {
    setup(creatureActor, 'ASSISTED')
    state.d20 = { rollMode: 'ADVANTAGE' }
    state.executeMode = 'PAUSE'
    installOccurrenceSeam()
    const first = await executeEncounterActorDirectRuleAction({
      db: testDb,
      runtime: testRuntime,
      command: command()
    })
    state.replay = {
      status: 'PAUSED',
      occurrenceId: ids.occurrence,
      occurrenceVersion: 0,
      request: { requestId: ids.request, kind: 'INTEGER_RANGE', min: 1, max: 20, nodeId: 'roll' },
      pending: { kind: 'D20_EVIDENCE', rollMode: 'ADVANTAGE' }
    }
    const replay = await executeEncounterActorDirectRuleAction({
      db: testDb,
      runtime: testRuntime,
      command: command()
    })
    expect(first).toMatchObject({ status: 'PENDING', rollMode: 'ADVANTAGE' })
    expect(replay).toEqual(first)
    expect(state.calls.settle).not.toHaveBeenCalled()
  })

  it.each([
    ['DECLINE', false],
    ['USE', true]
  ])(
    'pauses an Automatic failed save before mutation, then settles %s exactly once',
    async (selection, use) => {
      setup(creatureActor, 'AUTOMATIC')
      state.d20 = { rollMode: 'NORMAL' }
      state.executeMode = 'LR_PAUSE'
      state.legendaryResistanceUse = use
      installOccurrenceSeam()
      const paused = await executeEncounterActorDirectRuleAction({
        db: testDb,
        runtime: testRuntime,
        command: command()
      })
      expect(paused).toMatchObject({ status: 'PENDING' })
      expect(state.calls.settle).not.toHaveBeenCalled()
      expect(state.calls.appendEvent).not.toHaveBeenCalled()

      state.executeMode = 'COMPLETE'
      const completed = await resumeEncounterActorDirectRuleAction({
        db: testDb,
        runtime: testRuntime,
        command: resumeCommand({ kind: 'LEGENDARY_RESISTANCE', selection })
      })
      state.replay = completeResult(
        completed.status === 'COMPLETE' ? completed.application : { kind: 'UNREACHABLE' }
      )
      const replay = await resumeEncounterActorDirectRuleAction({
        db: testDb,
        runtime: testRuntime,
        command: resumeCommand({ kind: 'LEGENDARY_RESISTANCE', selection })
      })
      expect(completed).toMatchObject({ status: 'COMPLETE' })
      expect(replay).toEqual(completed)
      expect(state.calls.settle).toHaveBeenCalledTimes(1)
      expect(state.calls.appendEvent).toHaveBeenCalledTimes(1)
      if (use) {
        expect(state.calls.settle).toHaveBeenCalledWith(
          expect.objectContaining({
            prepared: expect.objectContaining({
              targetFeatureResourceConsumption: expect.objectContaining({
                beforeUsed: 2,
                afterUsed: 3
              })
            })
          })
        )
      }
    }
  )

  it('settles an Assisted resume once, consumes the prepared source resource, and replays without mutation', async () => {
    setup(creatureActor, 'ASSISTED')
    state.d20 = { rollMode: 'ADVANTAGE' }
    state.executeMode = 'PAUSE'
    installOccurrenceSeam()
    await executeEncounterActorDirectRuleAction({
      db: testDb,
      runtime: testRuntime,
      command: command()
    })

    state.executeMode = 'COMPLETE'
    const completed = await resumeEncounterActorDirectRuleAction({
      db: testDb,
      runtime: testRuntime,
      command: resumeCommand({ kind: 'PHYSICAL', requestId: ids.request, rawFaces: [17, 2] })
    })
    state.replay = completeResult(
      completed.status === 'COMPLETE' ? completed.application : { kind: 'UNREACHABLE' }
    )
    const replay = await resumeEncounterActorDirectRuleAction({
      db: testDb,
      runtime: testRuntime,
      command: resumeCommand({ kind: 'PHYSICAL', requestId: ids.request, rawFaces: [17, 2] })
    })

    expect(completed.status).toBe('COMPLETE')
    expect(replay).toEqual(completed)
    expect(state.calls.settle).toHaveBeenCalledTimes(1)
    expect(state.calls.settle).toHaveBeenCalledWith(
      expect.objectContaining({
        prepared: expect.objectContaining({
          resourceConsumption: { resourceId: 'resource', before: 1, after: 2 }
        })
      })
    )
    expect(state.calls.publishProjection).toHaveBeenCalledTimes(1)
    expect(state.calls.appendEvent).toHaveBeenCalledTimes(1)
  })

  it('rejects an Assisted resume when frozen target currentness changes', async () => {
    setup(creatureActor, 'ASSISTED')
    state.d20 = { rollMode: 'NORMAL' }
    state.executeMode = 'PAUSE'
    installOccurrenceSeam()
    await executeEncounterActorDirectRuleAction({
      db: testDb,
      runtime: testRuntime,
      command: command()
    })

    state.currentEncounter = encounter({ ...creatureActor, sourceRevision: 2 }, 'ASSISTED')
    state.executeMode = 'COMPLETE'
    await expect(
      resumeEncounterActorDirectRuleAction({
        db: testDb,
        runtime: testRuntime,
        command: resumeCommand()
      })
    ).rejects.toThrow('pending currentness changed')
    expect(state.calls.settle).not.toHaveBeenCalled()
    expect(state.calls.appendEvent).not.toHaveBeenCalled()
  })

  it('rejects a second Assisted evidence stage before settlement', async () => {
    setup(creatureActor, 'ASSISTED')
    state.d20 = { rollMode: 'NORMAL' }
    state.executeMode = 'PAUSE'
    installOccurrenceSeam()
    await executeEncounterActorDirectRuleAction({
      db: testDb,
      runtime: testRuntime,
      command: command()
    })

    state.executeMode = 'BAD_PAUSE'
    await expect(
      resumeEncounterActorDirectRuleAction({
        db: testDb,
        runtime: testRuntime,
        command: resumeCommand()
      })
    ).rejects.toThrow('only one evidence stage')
    expect(state.calls.settle).not.toHaveBeenCalled()
    expect(state.calls.publishProjection).not.toHaveBeenCalled()
    expect(state.calls.appendEvent).not.toHaveBeenCalled()
  })

  it('rejects Character targets, unauthorized sources, and invalid paused evidence before settlement', async () => {
    setup(characterActorWithoutSource)
    installOccurrenceSeam()
    await expect(
      executeEncounterActorDirectRuleAction({
        db: testDb,
        runtime: testRuntime,
        command: command()
      })
    ).rejects.toThrow('Character targets')
    setup()
    const unauthorizedContext = {
      context: {
        encounterId: ids.encounter,
        campaignId: ids.campaign,
        actorUserId: ids.user,
        currentVersion: 4,
        role: 'PLAYER',
        assignedCharacterId: '00000000-0000-4000-8000-000000000099',
        advanceVersion: async () => 5
      },
      encounter: encounter()
    }
    state.calls.lockContext
      .mockResolvedValueOnce(unauthorizedContext)
      .mockResolvedValueOnce(unauthorizedContext)
    installOccurrenceSeam()
    await expect(
      executeEncounterActorDirectRuleAction({
        db: testDb,
        runtime: testRuntime,
        command: command()
      })
    ).rejects.toThrow('source is unavailable')
    setup(undefined, 'ASSISTED')
    state.executeMode = 'BAD_PAUSE'
    installOccurrenceSeam()
    await expect(
      executeEncounterActorDirectRuleAction({
        db: testDb,
        runtime: testRuntime,
        command: command()
      })
    ).rejects.toThrow('unsupported evidence')
    expect(state.calls.settle).not.toHaveBeenCalled()
  })
})
