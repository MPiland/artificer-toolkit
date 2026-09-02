import { describe, expect, it, vi } from 'vitest'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { CampaignLiveSceneRecord, DBLike } from '@artificer-toolkit/db'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/rulesExecution'
import type { RulesRuntimeService } from '../rules/rulesRuntimeService.js'
import type { CharacterRuleActionSpatialDirective } from '../rules/characterRuleActionSystemAdapter.js'

const ids = {
  action: '00000000-0000-4000-8000-000000000101',
  actor: '00000000-0000-4000-8000-000000000102',
  target: '00000000-0000-4000-8000-000000000103',
  user: '00000000-0000-4000-8000-000000000104',
  character: '00000000-0000-4000-8000-000000000105',
  encounter: '00000000-0000-4000-8000-000000000106',
  campaign: '00000000-0000-4000-8000-000000000107',
  test: '00000000-0000-4000-8000-000000000108',
  outcome: '00000000-0000-4000-8000-000000000109',
  system: '00000000-0000-4000-8000-000000000110'
} as const

const nestedAdvantageContributors = [
  {
    sourceId: 'nested-save-test',
    grantId: null,
    domainKey: 'nested-save-test',
    influence: 'ADVANTAGE' as const
  }
]
const nestedAdvantageChecksum = checksumRuleDocument(nestedAdvantageContributors)

const state = vi.hoisted(() => {
  const occurrences = new Map<string, Record<string, unknown>>()
  const receipts = new Map<string, Record<string, unknown>>()
  const calls = {
    appendEvent: vi.fn(async () => undefined),
    advanceVersion: vi.fn(async () => 5),
    compileProjection: vi.fn((value: unknown) => value),
    evaluateSnapshot: vi.fn(),
    lockContext: vi.fn(),
    lockTargets: vi.fn(),
    prepare: vi.fn(),
    publishProjection: vi.fn(async () => undefined),
    interpretSpatial: vi.fn(),
    revalidateScene: vi.fn(),
    sceneAppendEvent: vi.fn(async () => undefined),
    sceneBindings: vi.fn<() => Promise<Array<{ actorId: string; tokenId: string }>>>(
      async () => []
    ),
    sceneProjection: vi.fn(async () => ({ version: 2 })),
    spatialScope: vi.fn(async () => ({ snapshot: async () => [] })),
    settle: vi.fn(),
    updateActor: vi.fn(async () => undefined)
  }
  return { calls, occurrences, receipts }
})

vi.mock('@artificer-toolkit/db', async (importOriginal) => ({
  ...(await importOriginal()),
  withTransaction: async (_db: unknown, run: (db: object) => Promise<unknown>) => run({}),
  createRuleOccurrenceRepository: () => ({
    findReceipt: vi.fn(
      async (_kind: string, aggregateId: string, commandId: string) =>
        state.receipts.get(`${aggregateId}:${commandId}`) ?? null
    ),
    lockOccurrence: vi.fn(async (_kind: string, aggregateId: string, occurrenceId: string) => {
      const occurrence = state.occurrences.get(occurrenceId)
      return occurrence?.aggregateId === aggregateId ? occurrence : null
    }),
    lockPendingEncounter: vi.fn(async () => null),
    createPending: vi.fn(async (input: Record<string, unknown>) => {
      const occurrence = {
        id: input.occurrenceId,
        aggregateKind: input.aggregateKind,
        aggregateId: input.aggregateId,
        rootCommandId: input.rootCommandId,
        commandFingerprint: input.commandFingerprint,
        state: 'PENDING',
        version: 0,
        expectedAggregateVersion: input.expectedAggregateVersion,
        pendingSnapshot: input.pendingSnapshot,
        completedAt: null,
        createdAt: '2026-08-31T00:00:00.000Z',
        updatedAt: '2026-08-31T00:00:00.000Z'
      }
      state.occurrences.set(String(input.occurrenceId), occurrence)
      return occurrence
    }),
    createCompleted: vi.fn(async (input: Record<string, unknown>) => ({
      id: input.occurrenceId,
      aggregateKind: input.aggregateKind,
      aggregateId: input.aggregateId,
      rootCommandId: input.rootCommandId,
      commandFingerprint: input.commandFingerprint,
      state: 'COMPLETED',
      version: 0,
      expectedAggregateVersion: input.aggregateVersion,
      pendingSnapshot: null,
      completedAt: '2026-08-31T00:00:00.000Z',
      createdAt: '2026-08-31T00:00:00.000Z',
      updatedAt: '2026-08-31T00:00:00.000Z'
    })),
    advancePending: vi.fn(async (input: Record<string, unknown>) => {
      const prior = state.occurrences.get(String(input.occurrenceId))!
      const next = {
        ...prior,
        version: Number(prior.version) + 1,
        expectedAggregateVersion: input.nextAggregateVersion,
        pendingSnapshot: input.pendingSnapshot
      }
      state.occurrences.set(String(input.occurrenceId), next)
      return next
    }),
    complete: vi.fn(async (input: Record<string, unknown>) => {
      const prior = state.occurrences.get(String(input.occurrenceId))!
      const next = {
        ...prior,
        state: 'COMPLETED',
        version: Number(prior.version) + 1,
        expectedAggregateVersion: input.nextAggregateVersion,
        pendingSnapshot: null,
        completedAt: '2026-08-31T00:00:00.000Z'
      }
      state.occurrences.set(String(input.occurrenceId), next)
      return next
    }),
    appendReceipt: vi.fn(async (input: Record<string, unknown>) => {
      state.receipts.set(`${input.aggregateId}:${input.commandId}`, input)
    })
  }),
  createReusableDefinitionRepository: () => ({}),
  createEncounterRepository: () => ({
    appendEvent: state.calls.appendEvent,
    publishCurrentProjection: state.calls.publishProjection,
    updateActor: state.calls.updateActor
  }),
  createSpatialRuleEffectRepository: () => ({ lockScope: state.calls.spatialScope }),
  createVttSceneRepository: () => ({
    appendEvent: state.calls.sceneAppendEvent,
    listActorTokenBindings: state.calls.sceneBindings,
    updateProjection: state.calls.sceneProjection
  })
}))
vi.mock('./encounterRuleExecutionCommandContext.js', () => ({
  lockEncounterRuleExecutionCommandContext: state.calls.lockContext
}))
vi.mock('./encounterActorRuleEvaluation.js', () => ({
  evaluateEncounterActorRuleSnapshot: state.calls.evaluateSnapshot,
  refreshEncounterActorRuleSnapshot: (snapshot: unknown) => snapshot,
  findEncounterFeatureResource: () => null
}))
vi.mock('./encounterActiveEffectTargetState.js', () => ({
  lockEncounterActiveEffectTargets: state.calls.lockTargets
}))
vi.mock('./encounterActionSettlementCore.js', () => ({
  prepareEncounterActionSettlementCore: state.calls.prepare,
  settleEncounterActionSettlementCore: state.calls.settle,
  withTargetEncounterFeatureResourceConsumption: (input: unknown) => input
}))
vi.mock('./encounterLegendaryResistanceDiscovery.js', () => ({
  discoverEncounterLegendaryResistanceCandidate: async () => null
}))
vi.mock('./encounterLegendaryResistanceChoice.js', () => ({
  startEncounterLegendaryResistanceChoice: vi.fn()
}))
vi.mock('./encounterProjection.js', () => ({
  compileEncounterCurrentProjection: state.calls.compileProjection,
  projectGm: (value: unknown) => value
}))
vi.mock('./encounterActionPositionalFacts.js', () => ({
  lockEncounterActionPositionalFacts: async () => null
}))
vi.mock('./encounterActionSceneContext.js', () => ({
  createEncounterActionStartIntent: (value: {
    actionId: string
    actorId: string
    targetActorId: string
  }) => ({
    actionId: value.actionId,
    actorId: value.actorId,
    sceneContextChecksum: 'e'.repeat(64),
    targetActorId: value.targetActorId
  }),
  revalidateEncounterActionSceneDependency: state.calls.revalidateScene,
  toEncounterActionSceneDependency: (
    context: {
      sceneId: string
      sceneVersion: number
      sourceToken: { tokenId: string }
      targetToken: { tokenId: string }
    } | null
  ) =>
    context
      ? {
          sceneId: context.sceneId,
          sceneVersion: context.sceneVersion,
          sourceTokenId: context.sourceToken.tokenId,
          targetTokenId: context.targetToken.tokenId
        }
      : null
}))
vi.mock('../rules/actionPhaseExecution.js', () => ({
  resolveActionPhaseExecution: () => ({
    kind: 'OUTCOME',
    template: template(ids.outcome, 'b'.repeat(64)),
    outcome: { published: outcomePublished(), templateChecksum: 'b'.repeat(64) }
  })
}))
vi.mock('@artificer-toolkit/schema/projections/encounter', () => ({
  encounterProjectionEventSchema: { parse: <T>(value: T) => value }
}))

import {
  executeEncounterActorDirectRuleAction,
  resumeEncounterActorDirectRuleAction
} from './encounterActorDirectRuleActionService.js'

function definition(id: string, checksum: string, nested = false) {
  const document = {
    schemaVersion: 1,
    id,
    gameSystemId: ids.system,
    definitionFamilyKey: 'action',
    nodes: nested
      ? [
          {
            id: 'nested-save-d20',
            operation: { key: 'evidence.integer-range', contractVersion: 1 },
            inputs: {
              min: { kind: 'LITERAL', value: 1 },
              max: { kind: 'LITERAL', value: 20 }
            }
          },
          {
            id: 'result',
            operation: { key: 'test.proposal', contractVersion: 1 },
            inputs: { value: { kind: 'LITERAL', value: 1 } }
          }
        ]
      : [
          {
            id: 'result',
            operation: { key: 'test.proposal', contractVersion: 1 },
            inputs: { value: { kind: 'LITERAL', value: 1 } }
          }
        ],
    outputs: { result: { kind: 'NODE_OUTPUT', nodeId: 'result', port: 'value' } }
  }
  return {
    id,
    checksum,
    gameSystemId: ids.system,
    definitionFamilyKey: 'action',
    definition: document
  }
}

function template(id: string, checksum: string) {
  return { definitionId: id, gameSystemId: ids.system, definitionFamilyKey: 'action', checksum }
}

function testPublished() {
  return definition(ids.test, 'a'.repeat(64))
}

function outcomePublished() {
  return definition(ids.outcome, 'b'.repeat(64), true)
}

function pause(input: { occurrenceId: string; requestId: string; nodeId: string }) {
  return {
    status: 'PAUSED' as const,
    continuation: {
      schemaVersion: 1,
      occurrenceId: input.occurrenceId,
      graph: {
        schemaVersion: 1,
        source: template(
          input.nodeId === 'nested-save-d20' ? ids.outcome : ids.test,
          input.nodeId === 'nested-save-d20' ? 'b'.repeat(64) : 'a'.repeat(64)
        ),
        capabilityContractVersion: 1,
        factContracts: [],
        nodes: [],
        outputs: {}
      },
      facts: {},
      nextNodeIndex: 0,
      nodeOutputs: {},
      trace: [],
      request: {
        requestId: input.requestId,
        kind: 'INTEGER_RANGE' as const,
        nodeId: input.nodeId,
        ordinal: 0,
        min: 1,
        max: 20
      },
      authority: 'APPLICATION_SERVICE' as const,
      redaction: 'SERVER_ONLY' as const,
      seal: 'a'.repeat(64)
    }
  }
}

function testComplete(requestId: string, value: number) {
  return {
    status: 'COMPLETE' as const,
    outputs: { resultPath: 'ON_SAVE_FAIL' },
    evidence: {
      source: template(ids.test, 'a'.repeat(64)),
      capabilityContractVersion: 1,
      facts: {},
      trace: [
        {
          nodeId: 'test-d20',
          operation: { key: 'evidence.integer-range', contractVersion: 1 },
          inputs: { min: 1, max: 20 },
          outputs: {},
          evidence: { kind: 'INTEGER_RANGE' as const, requestId, value }
        },
        {
          nodeId: 'test-save',
          operation: { key: 'dnd5e.saving-throw', contractVersion: 1 },
          inputs: {
            naturalD20: value,
            modifier: 0,
            threshold: 10,
            contributorChecksum: nestedAdvantageChecksum
          },
          outputs: {
            contributorChecksum: nestedAdvantageChecksum,
            total: value,
            resultPath: 'ON_SAVE_FAIL'
          }
        }
      ],
      outputs: { resultPath: 'ON_SAVE_FAIL' }
    }
  }
}

function outcomeComplete(requestId: string, value: number) {
  const resultPath = value >= 13 ? 'ON_SAVE_SUCCESS' : 'ON_SAVE_FAIL'
  return {
    status: 'COMPLETE' as const,
    outputs: { resultPath },
    evidence: {
      source: template(ids.outcome, 'b'.repeat(64)),
      capabilityContractVersion: 1,
      facts: {},
      trace: [
        {
          nodeId: 'nested-save-d20',
          operation: { key: 'evidence.integer-range', contractVersion: 1 },
          inputs: { min: 1, max: 20 },
          outputs: {},
          evidence: { kind: 'INTEGER_RANGE' as const, requestId, value }
        },
        {
          nodeId: 'nested-save',
          operation: { key: 'dnd5e.saving-throw', contractVersion: 1 },
          inputs: {
            naturalD20: value,
            modifier: 0,
            threshold: 13,
            contributorChecksum: nestedAdvantageChecksum
          },
          outputs: { contributorChecksum: nestedAdvantageChecksum, total: value, resultPath }
        }
      ],
      outputs: { resultPath }
    }
  }
}

function forcedScene(): CampaignLiveSceneRecord {
  const source = {
    assetId: null,
    controlledByUserIds: [],
    height: 5,
    hidden: false,
    id: '00000000-0000-4000-8000-000000000130',
    label: 'source',
    locked: false,
    position: { x: 0, y: 50 },
    rotationDegrees: 0,
    vision: null,
    width: 5
  }
  const target = {
    ...source,
    id: '00000000-0000-4000-8000-000000000131',
    label: 'target',
    position: { x: 200, y: 50 }
  }
  const state = {
    annotations: [],
    ambientIllumination: 'BRIGHT' as const,
    barriers: [],
    campaignId: ids.campaign,
    darknessZones: [],
    definitionId: '00000000-0000-4000-8000-000000000132',
    definitionVersion: 1,
    doorStates: {},
    fogLayers: [],
    fogMode: 'SHARED_PARTY' as const,
    grid: { kind: 'GRIDLESS' as const, pixelsPerUnit: 5, unit: 'FEET' as const },
    id: '00000000-0000-4000-8000-000000000132',
    lights: [],
    map: {
      assetId: '00000000-0000-4000-8000-000000000132',
      height: 500,
      tileManifestAssetId: null,
      width: 500
    },
    measurements: [],
    name: 'scene',
    tokens: [source, target],
    version: 1,
    visionRevealMode: 'ON_DRAG' as const
  }
  return {
    materializationCommandFingerprint: 'a'.repeat(64),
    materializationCommandId: ids.action,
    createdAt: '2026-08-31T00:00:00.000Z',
    definitionSnapshot: { ...state, tokens: [source, target] },
    projectionChecksum: 'b'.repeat(64),
    projectionSchemaVersion: 2,
    state,
    updatedAt: '2026-08-31T00:00:00.000Z'
  }
}

function configure(automationMode: 'AUTOMATIC' | 'ASSISTED') {
  state.occurrences.clear()
  state.receipts.clear()
  Object.values(state.calls).forEach((call) => call.mockClear())
  const scene = forcedScene()
  const lockedSceneContext = {
    scene,
    sceneId: scene.state.id,
    sceneVersion: scene.state.version,
    sourceToken: {
      actorId: ids.actor,
      height: 5,
      position: { x: 0, y: 50 },
      rotationDegrees: 0,
      tokenId: scene.state.tokens[0]!.id,
      width: 5
    },
    targetToken: {
      actorId: ids.target,
      height: 5,
      position: { x: 200, y: 50 },
      rotationDegrees: 0,
      tokenId: scene.state.tokens[1]!.id,
      width: 5
    },
    grid: scene.state.grid
  }
  state.calls.revalidateScene.mockImplementation(
    async ({ dependency }: { dependency: unknown }) => {
      if (
        !dependency ||
        typeof dependency !== 'object' ||
        (dependency as { sceneId?: unknown }).sceneId !== scene.state.id ||
        (dependency as { sceneVersion?: unknown }).sceneVersion !== scene.state.version ||
        (dependency as { sourceTokenId?: unknown }).sourceTokenId !== scene.state.tokens[0]!.id ||
        (dependency as { targetTokenId?: unknown }).targetTokenId !== scene.state.tokens[1]!.id
      )
        throw new Error('Action Scene context is stale.')
      return lockedSceneContext
    }
  )
  state.calls.sceneBindings.mockResolvedValue([
    { actorId: ids.actor, tokenId: scene.state.tokens[0]!.id },
    { actorId: ids.target, tokenId: scene.state.tokens[1]!.id }
  ])
  state.calls.spatialScope.mockResolvedValue({ snapshot: async () => [] })
  state.calls.interpretSpatial.mockImplementation(
    ({ execution }: { execution: { outputs?: { resultPath?: string } } }) =>
      execution.outputs?.resultPath === 'ON_SAVE_FAIL'
        ? [
            {
              kind: 'FORCED_MOVEMENT' as const,
              sourceNodeId: 'nested-save-forced-movement',
              sourceOperationKey: 'dnd5e.forced-movement-proposal',
              authoredPath: 'ON_HIT',
              resolvedPath: 'ON_SAVE_FAIL',
              targetActorId: ids.target,
              targetStateChecksum: checksumRuleDocument({
                actorId: ids.target,
                derivedFacts: {},
                conditionIds: [],
                currentHitPoints: 20,
                temporaryHitPoints: 0,
                maximumHitPoints: 20,
                defenses: [],
                conditionImmunityIds: []
              }),
              direction: 'TOWARD_SOURCE' as const,
              distanceMode: 'FIXED_DISTANCE' as const,
              amount: 25,
              unit: 'FEET' as const,
              actionEconomy: 'NONE' as const
            } satisfies CharacterRuleActionSpatialDirective
          ]
        : []
  )
  const sourceActor = {
    id: ids.actor,
    kind: 'CHARACTER' as const,
    sourceId: ids.character,
    sourceRevision: 1,
    resources: {},
    conditions: []
  }
  const targetActor = {
    id: ids.target,
    kind: 'CREATURE' as const,
    sourceId: null,
    sourceRevision: 1,
    resources: {},
    conditions: []
  }
  const encounter = {
    id: ids.encounter,
    campaignId: ids.campaign,
    version: 4,
    status: 'ACTIVE' as const,
    currentActorId: ids.actor,
    automationMode,
    manualReminderMode: 'OFF' as const,
    actors: [sourceActor, targetActor]
  }
  const entry = {
    actionId: ids.action,
    effectId: ids.test,
    schemaVersion: 4,
    compilation: {
      kind: 'COMPILED' as const,
      resourceBinding: null,
      activeEffectPlan: null,
      executionPlan: {
        kind: 'TEST_OUTCOME' as const,
        compilerSource: { effectId: ids.test, compilerSourceChecksum: 'c'.repeat(64) },
        test: { published: testPublished(), template: template(ids.test, 'a'.repeat(64)) },
        outcomes: [{ pathCode: 'ON_SAVE_FAIL', template: template(ids.outcome, 'b'.repeat(64)) }]
      }
    },
    targetPolicy: {
      range: { rangeKind: 'UNLIMITED' as const },
      targeting: { selectionKind: 'SINGLE_TARGET' as const, dispositionKind: 'ANY' as const },
      shape: null,
      pathOverrides: []
    }
  }
  const lockedCharacter = {
    id: ids.character,
    actor: sourceActor,
    streamVersion: 1,
    mechanics: {
      characterStreamVersion: 1,
      projectionChecksum: 'd'.repeat(64),
      compiledActionEntryPoints: [entry],
      rulePolicyInput: { actionCandidates: [{ actionId: ids.action, effectId: ids.test }] }
    },
    overlay: { mechanicalContextChecksum: 'e'.repeat(64) }
  }
  const targets = {
    lockedCharacters: new Map([[ids.character, lockedCharacter]]),
    encounterActorRules: { actors: [{ actorId: ids.target, featureResources: [] }] }
  }
  state.calls.lockContext.mockResolvedValue({
    context: {
      encounterId: ids.encounter,
      campaignId: ids.campaign,
      actorUserId: ids.user,
      currentVersion: 4,
      role: 'OWNER',
      assignedCharacterId: ids.character,
      attunementSlotOverride: null,
      advanceVersion: state.calls.advanceVersion
    },
    encounter
  })
  state.calls.evaluateSnapshot.mockResolvedValue({
    snapshot: { revisionId: 'snapshot', output: {} },
    reconciledEncounter: encounter,
    actorUpdates: []
  })
  state.calls.lockTargets.mockResolvedValue(targets)
  state.calls.prepare.mockResolvedValue({
    sourceActor,
    targetActor,
    targets,
    actionSource: {
      kind: 'CHARACTER_ACTION',
      actorId: ids.actor,
      characterId: ids.character,
      characterStreamVersion: 1,
      candidate: { actionId: ids.action, effectId: ids.test },
      entry
    },
    action: {
      published: testPublished(),
      actionMechanic: {},
      sourceDerivedFacts: {},
      target: {
        actorId: ids.target,
        derivedFacts: {},
        conditionIds: [],
        currentHitPoints: 20,
        temporaryHitPoints: 0,
        maximumHitPoints: 20,
        defenses: [],
        conditionImmunityIds: []
      },
      adapter: {
        bindFacts: ({ published }: { published: { id: string } }) => ({
          facts: {},
          d20RollMode: 'ADVANTAGE' as const,
          d20Audit: {
            contributors: nestedAdvantageContributors,
            contributorChecksum: nestedAdvantageChecksum,
            modifier: 0,
            defenseOrDc: published.id === ids.outcome ? 13 : 10
          }
        }),
        interpret: () => [],
        interpretSpatial: state.calls.interpretSpatial,
        specializeOutcomeTemplate: () => ({
          published: outcomePublished(),
          templateChecksum: 'b'.repeat(64)
        })
      }
    }
  })
  state.calls.settle.mockImplementation(async (input: Record<string, unknown>) => ({
    application: {
      kind: 'ENCOUNTER_ACTOR_MECHANICS_BATCH',
      schemaVersion: 1,
      occurrenceId: input.occurrenceId,
      sourceActorId: ids.actor,
      targetActorId: ids.target,
      sourceCharacterStreamVersion: null,
      resourceConsumption: null,
      featureResourceConsumption: null,
      targetFeatureResourceConsumption: null,
      d20: null,
      nestedD20:
        input.execution && typeof input.execution === 'object'
          ? ((input.execution as { nestedD20?: unknown }).nestedD20 ?? null)
          : null,
      targetTransition: {
        before: {
          currentHitPoints: 20,
          temporaryHitPoints: 0,
          maximumHitPoints: 20,
          conditionIds: []
        },
        after: {
          currentHitPoints: 20,
          temporaryHitPoints: 0,
          maximumHitPoints: 20,
          conditionIds: []
        },
        checksum: 'f'.repeat(64)
      },
      applications: []
    },
    sourceActor,
    targetActor,
    characterTransitions: []
  }))
  return { encounter }
}

function command(commandId: string) {
  const scene = forcedScene()
  return {
    actionId: ids.action,
    actorId: ids.actor,
    actorUserId: ids.user,
    commandId,
    correlationId: null,
    encounterId: ids.encounter,
    expectedEncounterVersion: 4,
    sceneContext: {
      scene,
      sceneId: scene.state.id,
      sceneVersion: scene.state.version,
      sourceToken: {
        actorId: ids.actor,
        height: 5,
        position: { x: 0, y: 50 },
        rotationDegrees: 0,
        tokenId: scene.state.tokens[0]!.id,
        width: 5
      },
      targetToken: {
        actorId: ids.target,
        height: 5,
        position: { x: 200, y: 50 },
        rotationDegrees: 0,
        tokenId: scene.state.tokens[1]!.id,
        width: 5
      },
      grid: scene.state.grid
    },
    targetActorId: ids.target
  }
}

function runtime() {
  const executeResolvedWithGraph = vi.fn(
    async ({ command: input }: { command: { definitionId: string; occurrenceId: string } }) => {
      if (input.definitionId === ids.test)
        return {
          result: pause({
            occurrenceId: input.occurrenceId,
            requestId: 'test-request',
            nodeId: 'test-d20'
          }),
          graph: pause({
            occurrenceId: input.occurrenceId,
            requestId: 'test-request',
            nodeId: 'test-d20'
          }).continuation.graph
        }
      return {
        result: pause({
          occurrenceId: input.occurrenceId,
          requestId: 'nested-request',
          nodeId: 'nested-save-d20'
        }),
        graph: pause({
          occurrenceId: input.occurrenceId,
          requestId: 'nested-request',
          nodeId: 'nested-save-d20'
        }).continuation.graph
      }
    }
  )
  const resumeWithGraph = vi.fn(
    async ({
      continuation,
      response
    }: {
      continuation: { request: { nodeId: string } }
      response: { requestId: string; value: number }
    }) => ({
      result:
        continuation.request.nodeId === 'test-d20'
          ? testComplete(response.requestId, response.value)
          : outcomeComplete(response.requestId, response.value),
      graph: {
        schemaVersion: 1,
        source: template(
          continuation.request.nodeId === 'test-d20' ? ids.test : ids.outcome,
          continuation.request.nodeId === 'test-d20' ? 'a'.repeat(64) : 'b'.repeat(64)
        ),
        capabilityContractVersion: 1,
        factContracts: [],
        nodes: [],
        outputs: {}
      }
    })
  )
  return { executeResolvedWithGraph, resumeWithGraph } as unknown as RulesRuntimeService & {
    resumeWithGraph: typeof resumeWithGraph
  }
}

describe('encounter actor nested-save occurrence integration', () => {
  it('rejects a mismatched frozen Scene dependency before a terminal receipt or Scene move', async () => {
    configure('AUTOMATIC')
    const input = command('00000000-0000-4000-8000-000000000144')
    input.sceneContext = { ...input.sceneContext, sceneVersion: 2 }

    await expect(
      executeEncounterActorDirectRuleAction({
        db: {} as DBLike,
        runtime: runtime(),
        command: input
      })
    ).rejects.toThrow('Scene context is stale')
    expect(state.receipts.size).toBe(0)
    expect(state.calls.sceneAppendEvent).not.toHaveBeenCalled()
  })

  it('moves once after an automatic failed nested save and replays before interpretation or Scene mutation', async () => {
    configure('AUTOMATIC')
    const coordinator = runtime()
    const rolls = [15, 1, 3, 1]
    const first = await executeEncounterActorDirectRuleAction({
      db: {} as DBLike,
      runtime: coordinator,
      command: command('00000000-0000-4000-8000-000000000140'),
      rollD20: () => rolls.shift() ?? 1
    })
    const replay = await executeEncounterActorDirectRuleAction({
      db: {} as DBLike,
      runtime: coordinator,
      command: command('00000000-0000-4000-8000-000000000140'),
      rollD20: () => {
        throw new Error('replay rolled')
      }
    })

    expect(first).toEqual(replay)
    expect(state.calls.sceneAppendEvent).toHaveBeenCalledTimes(1)
    expect(state.calls.sceneAppendEvent).toHaveBeenCalledWith(
      expect.objectContaining({ commandType: 'RESOLVE_ACTION', encounterId: ids.encounter })
    )
    expect(state.calls.sceneProjection).toHaveBeenCalledTimes(1)
    expect(state.calls.interpretSpatial).toHaveBeenCalledTimes(1)
    expect(coordinator.resumeWithGraph).toHaveBeenCalledTimes(2)
  })

  it('persists automatic nested d20 evidence and replays without a second settlement', async () => {
    configure('AUTOMATIC')
    const coordinator = runtime()
    const rolls = [15, 1, 3, 17]
    const first = await executeEncounterActorDirectRuleAction({
      db: {} as DBLike,
      runtime: coordinator,
      command: command('00000000-0000-4000-8000-000000000120'),
      rollD20: () => rolls.shift() ?? 1
    })
    const replay = await executeEncounterActorDirectRuleAction({
      db: {} as DBLike,
      runtime: coordinator,
      command: command('00000000-0000-4000-8000-000000000120'),
      rollD20: () => {
        throw new Error('replay rolled')
      }
    })
    expect(first).toMatchObject({
      status: 'COMPLETE',
      application: {
        nestedD20: {
          requestNodeId: 'nested-save-d20',
          rawFaces: [3, 17],
          selectedNatural: 17,
          rollMode: 'ADVANTAGE',
          modifier: 0,
          defenseOrDc: 13,
          resultPath: 'ON_SAVE_SUCCESS'
        }
      }
    })
    const terminalReceipt = structuredClone(
      state.receipts.get(`${ids.encounter}:00000000-0000-4000-8000-000000000120`)?.resultPayload
    ) as Record<string, unknown>
    const terminalOutputs = terminalReceipt.applicationOutputs as Record<string, unknown>
    const nestedD20 = terminalOutputs.nestedD20 as Record<string, unknown>
    nestedD20.rollMode = 'DISADVANTAGE'
    nestedD20.rawFaces = [17, 17]
    nestedD20.selectedNatural = 17
    expect(() => storedRuleExecutionResultDtoSchema.parse(terminalReceipt)).toThrow()
    expect(replay).toEqual(first)
    expect(state.calls.settle).toHaveBeenCalledTimes(1)
    expect(state.calls.appendEvent).toHaveBeenCalledTimes(1)
    expect(state.calls.interpretSpatial).toHaveBeenCalledTimes(1)
    expect(coordinator.resumeWithGraph).toHaveBeenCalledTimes(2)
  })

  it('persists both Assisted pauses and seals nested physical faces before replay', async () => {
    configure('ASSISTED')
    const coordinator = runtime()
    const started = await executeEncounterActorDirectRuleAction({
      db: {} as DBLike,
      runtime: coordinator,
      command: command('00000000-0000-4000-8000-000000000121')
    })
    if (started.status !== 'PENDING' || !('request' in started))
      throw new Error('Expected test pause.')
    const outcome = await resumeEncounterActorDirectRuleAction({
      db: {} as DBLike,
      runtime: coordinator,
      command: {
        actorUserId: ids.user,
        commandId: '00000000-0000-4000-8000-000000000122',
        correlationId: null,
        encounterId: ids.encounter,
        expectedEncounterVersion: 4,
        expectedOccurrenceVersion: started.occurrenceVersion,
        occurrenceId: started.occurrenceId,
        resolution: { kind: 'PHYSICAL', requestId: started.request.requestId, rawFaces: [15, 2] }
      }
    })
    if (outcome.status !== 'PENDING' || !('phase' in outcome) || outcome.phase !== 'OUTCOME')
      throw new Error(`Expected nested save pause, received ${JSON.stringify(outcome)}.`)
    const nestedRequest = outcome.requests[0]
    if (!nestedRequest) throw new Error('Expected one nested save request.')
    const completed = await resumeEncounterActorDirectRuleAction({
      db: {} as DBLike,
      runtime: coordinator,
      command: {
        actorUserId: ids.user,
        commandId: '00000000-0000-4000-8000-000000000123',
        correlationId: null,
        encounterId: ids.encounter,
        expectedEncounterVersion: 4,
        expectedOccurrenceVersion: outcome.occurrenceVersion,
        occurrenceId: outcome.occurrenceId,
        resolution: { kind: 'PHYSICAL', requestId: nestedRequest.requestId, rawFaces: [3, 17] }
      }
    })
    const replay = await resumeEncounterActorDirectRuleAction({
      db: {} as DBLike,
      runtime: coordinator,
      command: {
        actorUserId: ids.user,
        commandId: '00000000-0000-4000-8000-000000000123',
        correlationId: null,
        encounterId: ids.encounter,
        expectedEncounterVersion: 4,
        expectedOccurrenceVersion: outcome.occurrenceVersion,
        occurrenceId: outcome.occurrenceId,
        resolution: { kind: 'PHYSICAL', requestId: nestedRequest.requestId, rawFaces: [3, 17] }
      }
    })
    expect(completed).toMatchObject({
      status: 'COMPLETE',
      application: {
        nestedD20: {
          requestNodeId: 'nested-save-d20',
          rawFaces: [3, 17],
          selectedNatural: 17,
          resultPath: 'ON_SAVE_SUCCESS'
        }
      }
    })
    expect(replay).toEqual(completed)
    expect(state.calls.settle).toHaveBeenCalledTimes(1)
    expect(state.calls.appendEvent).toHaveBeenCalledTimes(1)
    expect(state.calls.interpretSpatial).toHaveBeenCalledTimes(1)
    expect(state.calls.sceneAppendEvent).not.toHaveBeenCalled()
    expect(state.calls.sceneProjection).not.toHaveBeenCalled()
  })

  it('moves once after an Assisted failed nested save and replays the terminal resume', async () => {
    configure('ASSISTED')
    const coordinator = runtime()
    const started = await executeEncounterActorDirectRuleAction({
      db: {} as DBLike,
      runtime: coordinator,
      command: command('00000000-0000-4000-8000-000000000141')
    })
    if (started.status !== 'PENDING' || !('request' in started))
      throw new Error('Expected test pause.')
    const outcome = await resumeEncounterActorDirectRuleAction({
      db: {} as DBLike,
      runtime: coordinator,
      command: {
        actorUserId: ids.user,
        commandId: '00000000-0000-4000-8000-000000000142',
        correlationId: null,
        encounterId: ids.encounter,
        expectedEncounterVersion: 4,
        expectedOccurrenceVersion: started.occurrenceVersion,
        occurrenceId: started.occurrenceId,
        resolution: { kind: 'PHYSICAL', requestId: started.request.requestId, rawFaces: [15, 2] }
      }
    })
    if (outcome.status !== 'PENDING' || !('phase' in outcome) || outcome.phase !== 'OUTCOME')
      throw new Error('Expected nested save pause.')
    const request = outcome.requests[0]
    if (!request) throw new Error('Expected nested save request.')
    const terminal = {
      actorUserId: ids.user,
      commandId: '00000000-0000-4000-8000-000000000143',
      correlationId: null,
      encounterId: ids.encounter,
      expectedEncounterVersion: 4,
      expectedOccurrenceVersion: outcome.occurrenceVersion,
      occurrenceId: outcome.occurrenceId,
      resolution: { kind: 'PHYSICAL' as const, requestId: request.requestId, rawFaces: [3, 1] }
    }
    const completed = await resumeEncounterActorDirectRuleAction({
      db: {} as DBLike,
      runtime: coordinator,
      command: terminal
    })
    const replay = await resumeEncounterActorDirectRuleAction({
      db: {} as DBLike,
      runtime: coordinator,
      command: terminal
    })

    expect(replay).toEqual(completed)
    expect(state.calls.interpretSpatial).toHaveBeenCalledTimes(1)
    expect(state.calls.sceneAppendEvent).toHaveBeenCalledTimes(1)
    expect(state.calls.sceneProjection).toHaveBeenCalledTimes(1)
  })
})
