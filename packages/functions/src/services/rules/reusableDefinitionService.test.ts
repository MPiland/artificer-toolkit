import { describe, expect, it } from 'vitest'

import type { ReusableDefinitionRootRecord } from '@artificer-toolkit/db'
import type {
  ReusableDefinitionCurrentDto,
  ReusableDefinitionDocumentDto
} from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { ruleGraphDefinitionDtoSchema } from '@artificer-toolkit/schema/api/rulesRuntime'
import {
  conditionRuleStateReusableDefinitionDocumentDtoSchema,
  dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema,
  dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema,
  ruleCapabilityReusableDefinitionDocumentDtoSchema,
  senseReusableDefinitionDocumentDtoSchema,
  initiativePolicyReusableDefinitionDocumentDtoSchema
} from '@artificer-toolkit/schema/shared'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  createReusableDefinitionRuntimeSource,
  createReusableDefinitionService,
  ReusableDefinitionAuthorizationError,
  ReusableDefinitionValidationError,
  CONDITION_RULE_STATE_DEFINITION_FAMILY_KEY,
  DND5E_ENCOUNTER_LIFECYCLE_DEFINITION_FAMILY_KEY,
  DND5E_OPTIONAL_COMBAT_DEFINITION_FAMILY_KEY,
  INITIATIVE_POLICY_DEFINITION_FAMILY_KEY,
  RULE_CAPABILITY_DEFINITION_FAMILY_KEY,
  RULE_RUNTIME_GRAPH_FAMILY_KEY,
  SENSE_DEFINITION_FAMILY_KEY,
  type ReusableDefinitionStore
} from './reusableDefinitionService.js'
import { DND5E_INITIATIVE_FACT_KEYS } from './systems/dnd5e/initiativeFactAdapter.js'
import { dnd5eEffectActionCapability } from './systems/dnd5e/effectActionCompiler.js'

const systemId = '11111111-1111-4111-8111-111111111111'
const definitionId = '22222222-2222-4222-8222-222222222222'
const sourceId = '33333333-3333-4333-8333-333333333333'
const ownerId = '44444444-4444-4444-8444-444444444444'
const otherId = '55555555-5555-4555-8555-555555555555'
const tieGraphId = '66666666-6666-4666-8666-666666666666'
const orderChoiceGraphId = '77777777-7777-4777-8777-777777777777'
const orderChoiceMinimumIndexFact = 'initiative.choice-min-index'
const orderChoiceMaximumIndexFact = 'initiative.choice-max-index'
const dnd5eInitiativePolicyId = '88888888-8888-4888-8888-888888888888'
const dnd5eInitiativeScoreGraphId = '99999999-9999-4999-8999-999999999999'
const dnd5eInitiativeTieGraphId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const dnd5eInitiativeOrderChoiceGraphId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const capability = {
  gameSystemId: systemId,
  contractVersion: 1,
  authoredRootKinds: ['action'],
  definitionFamilyKeys: [
    RULE_RUNTIME_GRAPH_FAMILY_KEY,
    SENSE_DEFINITION_FAMILY_KEY,
    RULE_CAPABILITY_DEFINITION_FAMILY_KEY,
    CONDITION_RULE_STATE_DEFINITION_FAMILY_KEY,
    INITIATIVE_POLICY_DEFINITION_FAMILY_KEY,
    DND5E_ENCOUNTER_LIFECYCLE_DEFINITION_FAMILY_KEY,
    DND5E_OPTIONAL_COMBAT_DEFINITION_FAMILY_KEY
  ],
  factContracts: [
    { key: orderChoiceMinimumIndexFact, valueKind: 'NUMBER' },
    { key: orderChoiceMaximumIndexFact, valueKind: 'NUMBER' }
  ],
  operationContracts: [
    { key: 'number.add', contractVersion: 1 },
    { key: 'number.compare-threshold', contractVersion: 1 },
    { key: 'evidence.integer-range', contractVersion: 1 }
  ]
} as const

function graph() {
  return ruleGraphDefinitionDtoSchema.parse({
    schemaVersion: 1,
    id: definitionId,
    gameSystemId: systemId,
    definitionFamilyKey: RULE_RUNTIME_GRAPH_FAMILY_KEY,
    nodes: [
      {
        id: 'result',
        operation: { key: 'number.add', contractVersion: 1 },
        inputs: {
          left: { kind: 'LITERAL', value: 1 },
          right: { kind: 'LITERAL', value: 2 }
        }
      },
      {
        id: 'available',
        operation: { key: 'number.compare-threshold', contractVersion: 1 },
        inputs: {
          value: { kind: 'LITERAL', value: 1 },
          threshold: { kind: 'LITERAL', value: 1 }
        }
      }
    ],
    outputs: {
      value: { kind: 'NODE_OUTPUT', nodeId: 'result', port: 'value' },
      available: { kind: 'NODE_OUTPUT', nodeId: 'available', port: 'passed' }
    }
  })
}

function booleanGraph(id: string) {
  return ruleGraphDefinitionDtoSchema.parse({
    schemaVersion: 1,
    id,
    gameSystemId: systemId,
    definitionFamilyKey: RULE_RUNTIME_GRAPH_FAMILY_KEY,
    nodes: [
      {
        id: 'result',
        operation: { key: 'number.compare-threshold', contractVersion: 1 },
        inputs: {
          value: { kind: 'LITERAL', value: 1 },
          threshold: { kind: 'LITERAL', value: 1 }
        }
      }
    ],
    outputs: { passed: { kind: 'NODE_OUTPUT', nodeId: 'result', port: 'passed' } }
  })
}

function rechargeGraph(
  id: string,
  input: { min?: number; max?: number; secondRequest?: boolean } = {}
) {
  const min = input.min ?? 1
  const max = input.max ?? 6
  return ruleGraphDefinitionDtoSchema.parse({
    schemaVersion: 1,
    id,
    gameSystemId: systemId,
    definitionFamilyKey: RULE_RUNTIME_GRAPH_FAMILY_KEY,
    nodes: [
      {
        id: 'd6',
        operation: { key: 'evidence.integer-range', contractVersion: 1 },
        inputs: { min: { kind: 'LITERAL', value: min }, max: { kind: 'LITERAL', value: max } }
      },
      ...(input.secondRequest
        ? [
            {
              id: 'again',
              operation: { key: 'evidence.integer-range', contractVersion: 1 },
              inputs: { min: { kind: 'LITERAL', value: 1 }, max: { kind: 'LITERAL', value: 6 } }
            }
          ]
        : []),
      {
        id: 'recharged',
        operation: { key: 'number.compare-threshold', contractVersion: 1 },
        inputs: {
          value: {
            kind: 'NODE_OUTPUT',
            nodeId: input.secondRequest ? 'again' : 'd6',
            port: 'value'
          },
          threshold: { kind: 'LITERAL', value: 4 }
        }
      }
    ],
    outputs: { recharged: { kind: 'NODE_OUTPUT', nodeId: 'recharged', port: 'passed' } }
  })
}

function orderChoiceGraph(id = orderChoiceGraphId) {
  return ruleGraphDefinitionDtoSchema.parse({
    schemaVersion: 1,
    id,
    gameSystemId: systemId,
    definitionFamilyKey: RULE_RUNTIME_GRAPH_FAMILY_KEY,
    nodes: [
      {
        id: 'result',
        operation: { key: 'number.add', contractVersion: 1 },
        inputs: {
          left: { kind: 'FACT', factKey: orderChoiceMinimumIndexFact },
          right: { kind: 'FACT', factKey: orderChoiceMaximumIndexFact }
        }
      }
    ],
    outputs: { value: { kind: 'NODE_OUTPUT', nodeId: 'result', port: 'value' } }
  })
}

function sense() {
  return senseReusableDefinitionDocumentDtoSchema.parse({
    schemaVersion: 1,
    kind: 'SENSE',
    id: definitionId,
    gameSystemId: systemId,
    capabilities: [
      {
        channel: 'NONVISUAL',
        accessGrade: 'PRECISE',
        satisfies: ['SEE'],
        illuminationAccess: 'IGNORE',
        obscurementAccess: 'IGNORE',
        perceivesInvisible: true,
        physicalConstraints: []
      }
    ]
  })
}

function ruleCapability() {
  return ruleCapabilityReusableDefinitionDocumentDtoSchema.parse({
    schemaVersion: 1,
    kind: 'RULE_CAPABILITY',
    id: definitionId,
    gameSystemId: systemId,
    usage: { maximum: 1, refreshBoundary: 'START_OF_TURN' }
  })
}

function conditionRuleState() {
  return conditionRuleStateReusableDefinitionDocumentDtoSchema.parse({
    schemaVersion: 1,
    kind: 'CONDITION_RULE_STATE',
    id: definitionId,
    gameSystemId: systemId,
    capabilitySuppressions: [
      {
        id: otherId,
        order: 0,
        kind: 'CAPABILITY_SUPPRESS',
        capabilityDefinitionIds: [sourceId]
      }
    ]
  })
}

function initiativePolicy() {
  return initiativePolicyReusableDefinitionDocumentDtoSchema.parse({
    schemaVersion: 1,
    kind: 'INITIATIVE_POLICY',
    id: definitionId,
    gameSystemId: systemId,
    procedure: 'ACTOR_ROLL',
    cadence: 'ENCOUNTER_START',
    evaluationGraph: {
      definitionId: sourceId,
      definitionVersion: 1,
      definitionChecksum: checksumRuleDocument({ ...graph(), id: sourceId }),
      scoreOutput: 'value',
      sortDirection: 'DESCENDING',
      automaticOutput: 'available'
    },
    orderChoiceGraph: {
      definitionId: orderChoiceGraphId,
      definitionVersion: 1,
      definitionChecksum: checksumRuleDocument(orderChoiceGraph()),
      selectionOutput: 'value',
      minimumIndexFact: orderChoiceMinimumIndexFact,
      maximumIndexFact: orderChoiceMaximumIndexFact
    },
    tieResolvers: [
      {
        definitionId: tieGraphId,
        definitionVersion: 2,
        definitionChecksum: checksumRuleDocument({ ...graph(), id: tieGraphId }),
        scoreOutput: 'value',
        sortDirection: 'DESCENDING',
        automaticOutput: 'available',
        repeatOnTie: false,
        maximumAttempts: 1
      }
    ],
    defaultTieResolverDefinitionId: tieGraphId
  })
}

function dnd5eInitiativeScoreGraph(id: string) {
  return ruleGraphDefinitionDtoSchema.parse({
    schemaVersion: 1,
    id,
    gameSystemId: dnd5eEffectActionCapability.gameSystemId,
    definitionFamilyKey: RULE_RUNTIME_GRAPH_FAMILY_KEY,
    nodes: [
      {
        id: 'd20',
        operation: { key: 'evidence.integer-range', contractVersion: 1 },
        inputs: { min: { kind: 'LITERAL', value: 1 }, max: { kind: 'LITERAL', value: 20 } }
      },
      {
        id: 'score',
        operation: { key: 'number.add', contractVersion: 1 },
        inputs: {
          left: { kind: 'NODE_OUTPUT', nodeId: 'd20', port: 'value' },
          right: { kind: 'FACT', factKey: DND5E_INITIATIVE_FACT_KEYS.modifier }
        }
      }
    ],
    outputs: {
      automatic: { kind: 'LITERAL', value: true },
      score: { kind: 'NODE_OUTPUT', nodeId: 'score', port: 'value' }
    }
  })
}

function dnd5eInitiativeOrderChoiceGraph() {
  return ruleGraphDefinitionDtoSchema.parse({
    schemaVersion: 1,
    id: dnd5eInitiativeOrderChoiceGraphId,
    gameSystemId: dnd5eEffectActionCapability.gameSystemId,
    definitionFamilyKey: RULE_RUNTIME_GRAPH_FAMILY_KEY,
    nodes: [
      {
        id: 'selected-index',
        operation: { key: 'number.add', contractVersion: 1 },
        inputs: {
          left: {
            kind: 'FACT',
            factKey: DND5E_INITIATIVE_FACT_KEYS.orderChoiceMinimumIndex
          },
          right: {
            kind: 'FACT',
            factKey: DND5E_INITIATIVE_FACT_KEYS.orderChoiceMaximumIndex
          }
        }
      }
    ],
    outputs: { selectedIndex: { kind: 'NODE_OUTPUT', nodeId: 'selected-index', port: 'value' } }
  })
}

function dnd5eSideRollInitiativePolicy() {
  const evaluationGraph = dnd5eInitiativeScoreGraph(dnd5eInitiativeScoreGraphId)
  const tieGraph = dnd5eInitiativeScoreGraph(dnd5eInitiativeTieGraphId)
  const orderChoiceGraph = dnd5eInitiativeOrderChoiceGraph()
  return initiativePolicyReusableDefinitionDocumentDtoSchema.parse({
    schemaVersion: 1,
    kind: 'INITIATIVE_POLICY',
    id: dnd5eInitiativePolicyId,
    gameSystemId: dnd5eEffectActionCapability.gameSystemId,
    procedure: 'SIDE_ROLL',
    cadence: 'ENCOUNTER_START',
    evaluationGraph: {
      definitionId: evaluationGraph.id,
      definitionVersion: 1,
      definitionChecksum: checksumRuleDocument(evaluationGraph),
      scoreOutput: 'score',
      sortDirection: 'DESCENDING',
      automaticOutput: 'automatic'
    },
    orderChoiceGraph: {
      definitionId: orderChoiceGraph.id,
      definitionVersion: 1,
      definitionChecksum: checksumRuleDocument(orderChoiceGraph),
      selectionOutput: 'selectedIndex',
      minimumIndexFact: DND5E_INITIATIVE_FACT_KEYS.orderChoiceMinimumIndex,
      maximumIndexFact: DND5E_INITIATIVE_FACT_KEYS.orderChoiceMaximumIndex
    },
    tieResolvers: [
      {
        definitionId: tieGraph.id,
        definitionVersion: 1,
        definitionChecksum: checksumRuleDocument(tieGraph),
        scoreOutput: 'score',
        sortDirection: 'DESCENDING',
        automaticOutput: 'automatic',
        repeatOnTie: true,
        maximumAttempts: 20
      }
    ],
    defaultTieResolverDefinitionId: tieGraph.id
  })
}

function encounterLifecycle(
  kind: 'LEGENDARY_ACTION' | 'LEGENDARY_RESISTANCE' | 'RECHARGE' = 'LEGENDARY_ACTION'
) {
  const graphDocument = kind === 'RECHARGE' ? rechargeGraph(sourceId) : booleanGraph(sourceId)
  const graphPin = {
    definitionId: sourceId,
    definitionVersion: 1,
    definitionChecksum: checksumRuleDocument(graphDocument)
  }
  if (kind === 'LEGENDARY_ACTION') {
    return dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema.parse({
      schemaVersion: 1,
      kind,
      id: definitionId,
      gameSystemId: systemId,
      eligibilityGraph: { ...graphPin, eligibleOutput: 'passed' },
      windowStage: 'END_OF_OTHER_ACTOR_TURN',
      refreshStage: 'START_OF_TURN',
      maximumActionsPerWindow: 1,
      resourceRecovery: 'FULL'
    })
  }
  if (kind === 'LEGENDARY_RESISTANCE') {
    return dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema.parse({
      schemaVersion: 1,
      kind,
      id: definitionId,
      gameSystemId: systemId,
      choiceGraph: { ...graphPin, useOutput: 'passed' },
      interruptedStage: 'AFTER_FAILED_SAVE_BEFORE_OUTCOME',
      replacement: 'SAVE_SUCCESS'
    })
  }
  return dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema.parse({
    schemaVersion: 1,
    kind,
    id: definitionId,
    gameSystemId: systemId,
    rechargeGraph: { ...graphPin, rechargedOutput: 'recharged' },
    boundary: 'START_OF_TURN',
    recovery: 'FULL'
  })
}

function root(overrides: Partial<ReusableDefinitionRootRecord> = {}): ReusableDefinitionRootRecord {
  return {
    id: definitionId,
    gameSystemId: systemId,
    contentSourceId: sourceId,
    definitionFamilyKey: RULE_RUNTIME_GRAPH_FAMILY_KEY,
    label: 'Graph',
    description: null,
    version: 0,
    draftVersion: null,
    sourceKind: 'USER',
    sourceOwnerUserId: ownerId,
    current: null,
    ...overrides
  }
}

function store(
  record = root(),
  document: ReusableDefinitionDocumentDto = graph(),
  dependencyCurrents = new Map<string, ReusableDefinitionCurrentDto>()
): ReusableDefinitionStore {
  return {
    async requireCurrent(id) {
      const dependency = dependencyCurrents.get(id)
      if (dependency) return dependency
      if (!record.current) throw new Error('unpublished')
      return record.current
    },
    async saveDraft(input) {
      await input.authorize(record)
      if (input.expectedDefinitionVersion !== record.version) throw new Error('stale root')
      return {
        definitionId: record.id,
        gameSystemId: record.gameSystemId,
        authorUserId: input.actorUserId,
        document: input.document as ReusableDefinitionDocumentDto,
        checksum: input.checksum,
        baseDefinitionVersion: 0,
        version: input.expectedDraftVersion === null ? 0 : input.expectedDraftVersion + 1,
        createdAt: '2026-08-25T00:00:00.000Z',
        updatedAt: '2026-08-25T00:00:00.000Z'
      }
    },
    async publishDraft(input) {
      await input.authorize(record)
      const draft = {
        definitionId: record.id,
        gameSystemId: record.gameSystemId,
        authorUserId: ownerId,
        document,
        checksum: checksumRuleDocument(document),
        baseDefinitionVersion: record.version,
        version: input.expectedDraftVersion,
        createdAt: '2026-08-25T00:00:00.000Z',
        updatedAt: '2026-08-25T00:00:00.000Z'
      }
      const dependencyIds = input.dependencyDefinitionIds(draft)
      const lockedDependencies = dependencyIds.map((dependencyId) => {
        const dependency = dependencyCurrents.get(dependencyId)
        if (!dependency) throw new Error('unpublished dependency')
        return dependency
      })
      await input.validate(record, draft, lockedDependencies)
      return {
        id: record.id,
        gameSystemId: record.gameSystemId,
        contentSourceId: record.contentSourceId,
        definitionFamilyKey: record.definitionFamilyKey,
        label: record.label,
        description: null,
        document,
        checksum: draft.checksum,
        contractVersion: 1,
        version: 1,
        publishedAt: '2026-08-25T00:00:00.000Z',
        publishedBy: ownerId
      }
    }
  }
}

function service(record = root()) {
  return createReusableDefinitionService({ store: store(record), capabilities: [capability] })
}

describe('reusable definition service', () => {
  it('publishes an exact D&D side-roll initiative policy through the registered System capability', async () => {
    const policy = dnd5eSideRollInitiativePolicy()
    const evaluationGraph = dnd5eInitiativeScoreGraph(dnd5eInitiativeScoreGraphId)
    const tieGraph = dnd5eInitiativeScoreGraph(dnd5eInitiativeTieGraphId)
    const orderChoiceGraph = dnd5eInitiativeOrderChoiceGraph()
    const current = (
      document: typeof evaluationGraph,
      version: number
    ): ReusableDefinitionCurrentDto => ({
      id: document.id,
      gameSystemId: document.gameSystemId,
      contentSourceId: sourceId,
      definitionFamilyKey: RULE_RUNTIME_GRAPH_FAMILY_KEY,
      label: 'D&D initiative graph',
      description: null,
      document,
      checksum: checksumRuleDocument(document),
      contractVersion: 1,
      version,
      publishedAt: '2026-09-01T00:00:00.000Z',
      publishedBy: ownerId
    })
    const currents = new Map<string, ReusableDefinitionCurrentDto>([
      [evaluationGraph.id, current(evaluationGraph, 1)],
      [tieGraph.id, current(tieGraph, 1)],
      [orderChoiceGraph.id, current(orderChoiceGraph, 1)]
    ])
    const policyRoot = root({
      id: policy.id,
      gameSystemId: policy.gameSystemId,
      definitionFamilyKey: INITIATIVE_POLICY_DEFINITION_FAMILY_KEY,
      label: 'D&D side initiative'
    })
    const publish = (capabilityContract: unknown) =>
      createReusableDefinitionService({
        store: store(policyRoot, policy, currents),
        capabilities: [capabilityContract]
      }).publishDraft({
        definitionId: policy.id,
        actorUserId: ownerId,
        expectedDefinitionVersion: 0,
        expectedDraftVersion: 0
      })

    await expect(publish(dnd5eEffectActionCapability)).resolves.toMatchObject({ document: policy })

    await expect(
      publish({
        ...dnd5eEffectActionCapability,
        factContracts: dnd5eEffectActionCapability.factContracts.filter(
          (fact) => fact.key !== DND5E_INITIATIVE_FACT_KEYS.modifier
        )
      })
    ).rejects.toThrow('Initiative policy graph pins must reference executable Rules Runtime graphs')

    await expect(
      publish({
        ...dnd5eEffectActionCapability,
        factContracts: dnd5eEffectActionCapability.factContracts.map((fact) =>
          fact.key === DND5E_INITIATIVE_FACT_KEYS.orderChoiceMaximumIndex
            ? { ...fact, valueKind: 'TEXT' }
            : fact
        )
      })
    ).rejects.toThrow(
      'Initiative order-choice bound facts must resolve to registered NUMBER System facts'
    )

    expect(dnd5eEffectActionCapability.factContracts).toEqual(
      expect.arrayContaining([
        { key: DND5E_INITIATIVE_FACT_KEYS.automatic, valueKind: 'BOOLEAN' },
        { key: DND5E_INITIATIVE_FACT_KEYS.modifier, valueKind: 'NUMBER' },
        { key: DND5E_INITIATIVE_FACT_KEYS.speedFactorModifier, valueKind: 'NUMBER' },
        {
          key: DND5E_INITIATIVE_FACT_KEYS.orderChoiceMinimumIndex,
          valueKind: 'NUMBER'
        },
        {
          key: DND5E_INITIATIVE_FACT_KEYS.orderChoiceMaximumIndex,
          valueKind: 'NUMBER'
        }
      ])
    )
    expect(dnd5eEffectActionCapability.operationContracts).toEqual(
      expect.arrayContaining([
        { key: 'evidence.integer-range', contractVersion: 1 },
        { key: 'number.add', contractVersion: 1 }
      ])
    )
  })

  it('rejects optional-combat publication when its check UUID is absent from the System vocabulary', async () => {
    const optionalRoot = root({
      definitionFamilyKey: DND5E_OPTIONAL_COMBAT_DEFINITION_FAMILY_KEY,
      label: 'Disarm'
    })
    const document = dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema.parse({
      schemaVersion: 1,
      id: definitionId,
      gameSystemId: systemId,
      kind: 'DISARM',
      module: { policyModuleKey: 'd20.action.disarm', contractVersion: 1 },
      parameters: {
        kind: 'DISARM',
        defenderCheckDefinitionIds: ['99999999-9999-4999-8999-999999999999']
      },
      mutuallyExclusiveGroup: null
    })
    const definitionService = createReusableDefinitionService({
      store: store(optionalRoot, document),
      capabilities: [capability],
      resolveSystemVocabulary: async () => ({
        schemaVersion: 4,
        id: systemId,
        label: 'Test',
        rulesetCode: 'test',
        rulesetVersion: '1',
        alignments: [],
        abilities: [
          {
            id: '88888888-8888-4888-8888-888888888888',
            code: 'ABILITY',
            label: 'Ability'
          }
        ],
        challengeRatings: [],
        conditionTypes: [],
        creatureTypes: [],
        currencies: [],
        damageTypes: [],
        heritages: [],
        languages: [],
        lifestyles: [],
        magicSchools: [],
        passives: [],
        rarities: [],
        senses: [],
        skills: [],
        speeds: [],
        terrains: [],
        userId: ownerId
      })
    })
    await expect(
      definitionService.publishDraft({
        definitionId,
        actorUserId: ownerId,
        expectedDefinitionVersion: 0,
        expectedDraftVersion: 0
      })
    ).rejects.toThrow('check definition is unavailable')
  })

  it('validates a user-owned draft and atomically consumes its checked draft on publish', async () => {
    const definitionService = service()
    await expect(
      definitionService.saveDraft({
        definitionId: definitionId.toUpperCase(),
        actorUserId: ownerId.toUpperCase(),
        expectedDefinitionVersion: 0,
        expectedDraftVersion: null,
        document: graph()
      })
    ).resolves.toMatchObject({
      definitionId,
      authorUserId: ownerId,
      version: 0,
      checksum: checksumRuleDocument(graph())
    })
    await expect(
      definitionService.publishDraft({
        definitionId,
        actorUserId: ownerId,
        expectedDefinitionVersion: 0,
        expectedDraftVersion: 0
      })
    ).resolves.toMatchObject({ version: 1, document: graph() })
  })

  it('fails closed for another owner, missing publisher family, stale base, and root mismatch', async () => {
    const definitionService = service()
    await expect(
      definitionService.saveDraft({
        definitionId,
        actorUserId: otherId,
        expectedDefinitionVersion: 0,
        expectedDraftVersion: null,
        document: graph()
      })
    ).rejects.toBeInstanceOf(ReusableDefinitionAuthorizationError)
    await expect(
      createReusableDefinitionService({
        store: store(root({ definitionFamilyKey: 'unknown' })),
        capabilities: [capability]
      }).saveDraft({
        definitionId,
        actorUserId: ownerId,
        expectedDefinitionVersion: 0,
        expectedDraftVersion: null,
        document: graph()
      })
    ).rejects.toBeInstanceOf(ReusableDefinitionValidationError)
    await expect(
      definitionService.saveDraft({
        definitionId,
        actorUserId: ownerId,
        expectedDefinitionVersion: 1,
        expectedDraftVersion: null,
        document: graph()
      })
    ).rejects.toThrow('stale root')
    await expect(
      definitionService.saveDraft({
        definitionId,
        actorUserId: ownerId,
        expectedDefinitionVersion: 0,
        expectedDraftVersion: null,
        document: { ...graph(), id: otherId }
      })
    ).rejects.toBeInstanceOf(ReusableDefinitionValidationError)
  })

  it('supplies only a checksum-verified current runtime envelope', async () => {
    const current = await service().publishDraft({
      definitionId,
      actorUserId: ownerId,
      expectedDefinitionVersion: 0,
      expectedDraftVersion: 0
    })
    const runtime = createReusableDefinitionRuntimeSource(store(root({ current })))
    await expect(runtime.requireCurrent(definitionId)).resolves.toMatchObject({
      id: definitionId,
      checksum: checksumRuleDocument(graph())
    })
    const bad = createReusableDefinitionRuntimeSource(
      store(root({ current: { ...current, checksum: 'a'.repeat(64) } }))
    )
    await expect(bad.requireCurrent(definitionId)).rejects.toBeInstanceOf(
      ReusableDefinitionValidationError
    )
  })

  it('does not expose trusted platform mutation and rejects platform roots', async () => {
    const definitionService = service(root({ sourceKind: 'PLATFORM', sourceOwnerUserId: null }))
    await expect(
      definitionService.saveDraft({
        definitionId,
        actorUserId: ownerId,
        expectedDefinitionVersion: 0,
        expectedDraftVersion: null,
        document: graph()
      })
    ).rejects.toBeInstanceOf(ReusableDefinitionAuthorizationError)
    expect('trustedPlatform' in definitionService.saveDraft).toBe(false)
  })

  it('fails closed when graph ports or System capabilities are not executable', async () => {
    await expect(
      service().saveDraft({
        definitionId,
        actorUserId: ownerId,
        expectedDefinitionVersion: 0,
        expectedDraftVersion: null,
        document: { ...graph(), nodes: [{ ...graph().nodes[0], inputs: {} }] }
      })
    ).rejects.toMatchObject({ message: expect.stringContaining('RULE_INPUT_PORT_MISSING') })
    await expect(
      createReusableDefinitionService({ store: store(), capabilities: [] }).saveDraft({
        definitionId,
        actorUserId: ownerId,
        expectedDefinitionVersion: 0,
        expectedDraftVersion: null,
        document: graph()
      })
    ).rejects.toBeInstanceOf(ReusableDefinitionValidationError)
  })

  it('saves and publishes sense definitions without changing graph execution admission', async () => {
    const senseRoot = root({ definitionFamilyKey: SENSE_DEFINITION_FAMILY_KEY, label: 'Sense' })
    const definitionService = createReusableDefinitionService({
      store: store(senseRoot, sense()),
      capabilities: [capability]
    })
    const saved = await definitionService.saveDraft({
      definitionId,
      actorUserId: ownerId,
      expectedDefinitionVersion: 0,
      expectedDraftVersion: null,
      document: sense()
    })
    expect(saved.document).toEqual(sense())

    const published = await definitionService.publishDraft({
      definitionId,
      actorUserId: ownerId,
      expectedDefinitionVersion: 0,
      expectedDraftVersion: 0
    })
    expect(published.document).toEqual(sense())

    await expect(
      createReusableDefinitionRuntimeSource(
        store(root({ ...senseRoot, current: published }), sense())
      ).requireCurrent(definitionId)
    ).rejects.toBeInstanceOf(ReusableDefinitionValidationError)
  })

  it.each([
    [RULE_CAPABILITY_DEFINITION_FAMILY_KEY, ruleCapability()],
    [CONDITION_RULE_STATE_DEFINITION_FAMILY_KEY, conditionRuleState()]
  ])(
    'saves and publishes %s definitions through the typed family publisher',
    async (family, document) => {
      const definitionRoot = root({ definitionFamilyKey: family, label: family })
      const definitionService = createReusableDefinitionService({
        store: store(definitionRoot, document),
        capabilities: [capability]
      })
      await expect(
        definitionService.saveDraft({
          definitionId,
          actorUserId: ownerId,
          expectedDefinitionVersion: 0,
          expectedDraftVersion: null,
          document
        })
      ).resolves.toMatchObject({ document })
      await expect(
        definitionService.publishDraft({
          definitionId,
          actorUserId: ownerId,
          expectedDefinitionVersion: 0,
          expectedDraftVersion: 0
        })
      ).resolves.toMatchObject({ document })
    }
  )

  it('rejects initiative-policy publication when a graph pin is stale or belongs to another System', async () => {
    const policyRoot = root({
      definitionFamilyKey: INITIATIVE_POLICY_DEFINITION_FAMILY_KEY,
      label: 'Initiative policy'
    })
    const policy = initiativePolicy()
    const graphCurrent = (id: string, version: number, gameSystemId = systemId) => {
      const document =
        id === orderChoiceGraphId
          ? { ...orderChoiceGraph(id), gameSystemId }
          : { ...graph(), id, gameSystemId }
      return {
        id,
        gameSystemId,
        contentSourceId: sourceId,
        definitionFamilyKey: RULE_RUNTIME_GRAPH_FAMILY_KEY,
        label: 'Graph',
        description: null,
        document,
        checksum: checksumRuleDocument(document),
        contractVersion: 1,
        version,
        publishedAt: '2026-08-25T00:00:00.000Z',
        publishedBy: ownerId
      }
    }
    const currents = new Map([
      [sourceId, graphCurrent(sourceId, 1)],
      [tieGraphId, graphCurrent(tieGraphId, 2)],
      [orderChoiceGraphId, graphCurrent(orderChoiceGraphId, 1)]
    ])
    const policyStore = store(policyRoot, policy, currents)
    const service = createReusableDefinitionService({
      store: policyStore,
      capabilities: [capability]
    })
    await expect(
      service.publishDraft({
        definitionId,
        actorUserId: ownerId,
        expectedDefinitionVersion: 0,
        expectedDraftVersion: 0
      })
    ).resolves.toMatchObject({ document: policy })

    currents.set(tieGraphId, graphCurrent(tieGraphId, 3))
    await expect(
      service.publishDraft({
        definitionId,
        actorUserId: ownerId,
        expectedDefinitionVersion: 0,
        expectedDraftVersion: 0
      })
    ).rejects.toBeInstanceOf(ReusableDefinitionValidationError)
  })

  it('rejects initiative-policy publication when a locked graph document is checksum-corrupted', async () => {
    const policyRoot = root({
      definitionFamilyKey: INITIATIVE_POLICY_DEFINITION_FAMILY_KEY,
      label: 'Initiative policy'
    })
    const policy = initiativePolicy()
    const corruptedCurrent = (
      id: string,
      version: number,
      checksum: string
    ): ReusableDefinitionCurrentDto => {
      const valid = { ...graph(), id }
      return {
        id,
        gameSystemId: systemId,
        contentSourceId: sourceId,
        definitionFamilyKey: RULE_RUNTIME_GRAPH_FAMILY_KEY,
        label: 'Graph',
        description: null,
        document: {
          ...valid,
          outputs: {
            value: { kind: 'NODE_OUTPUT', nodeId: 'result', port: 'tampered' }
          }
        },
        checksum,
        contractVersion: 1,
        version,
        publishedAt: '2026-08-25T00:00:00.000Z',
        publishedBy: ownerId
      }
    }
    const currents = new Map<string, ReusableDefinitionCurrentDto>([
      [sourceId, corruptedCurrent(sourceId, 1, policy.evaluationGraph.definitionChecksum)],
      [tieGraphId, corruptedCurrent(tieGraphId, 2, policy.tieResolvers[0].definitionChecksum)],
      [
        orderChoiceGraphId,
        corruptedCurrent(orderChoiceGraphId, 1, policy.orderChoiceGraph.definitionChecksum)
      ]
    ])
    const definitionService = createReusableDefinitionService({
      store: store(policyRoot, policy, currents),
      capabilities: [capability]
    })

    await expect(
      definitionService.publishDraft({
        definitionId,
        actorUserId: ownerId,
        expectedDefinitionVersion: 0,
        expectedDraftVersion: 0
      })
    ).rejects.toThrow('checksum-valid current Rules Runtime graphs')
  })

  it('requires exact numeric initiative score outputs from locked graphs', async () => {
    const policyRoot = root({
      definitionFamilyKey: INITIATIVE_POLICY_DEFINITION_FAMILY_KEY,
      label: 'Initiative policy'
    })
    const policy = initiativePolicy()
    const graphCurrent = (
      id: string,
      document = id === orderChoiceGraphId ? orderChoiceGraph(id) : { ...graph(), id }
    ): ReusableDefinitionCurrentDto => ({
      id,
      gameSystemId: systemId,
      contentSourceId: sourceId,
      definitionFamilyKey: RULE_RUNTIME_GRAPH_FAMILY_KEY,
      label: 'Graph',
      description: null,
      document,
      checksum: checksumRuleDocument(document),
      contractVersion: 1,
      version: id === tieGraphId ? 2 : 1,
      publishedAt: '2026-08-25T00:00:00.000Z',
      publishedBy: ownerId
    })
    const currents = new Map([
      [sourceId, graphCurrent(sourceId)],
      [tieGraphId, graphCurrent(tieGraphId)],
      [orderChoiceGraphId, graphCurrent(orderChoiceGraphId)]
    ])
    const definitionService = createReusableDefinitionService({
      store: store(policyRoot, policy, currents),
      capabilities: [capability]
    })

    await expect(
      definitionService.publishDraft({
        definitionId,
        actorUserId: ownerId,
        expectedDefinitionVersion: 0,
        expectedDraftVersion: 0
      })
    ).resolves.toMatchObject({ document: policy })

    const missingOutputPolicy = {
      ...policy,
      evaluationGraph: { ...policy.evaluationGraph, scoreOutput: 'missing' }
    }
    await expect(
      createReusableDefinitionService({
        store: store(policyRoot, missingOutputPolicy, currents),
        capabilities: [capability]
      }).publishDraft({
        definitionId,
        actorUserId: ownerId,
        expectedDefinitionVersion: 0,
        expectedDraftVersion: 0
      })
    ).rejects.toThrow('output must resolve to a registered NUMBER output')

    const missingOrderChoiceOutputPolicy = {
      ...policy,
      orderChoiceGraph: { ...policy.orderChoiceGraph, selectionOutput: 'missing' }
    }
    await expect(
      createReusableDefinitionService({
        store: store(policyRoot, missingOrderChoiceOutputPolicy, currents),
        capabilities: [capability]
      }).publishDraft({
        definitionId,
        actorUserId: ownerId,
        expectedDefinitionVersion: 0,
        expectedDraftVersion: 0
      })
    ).rejects.toThrow('output must resolve to a registered NUMBER output')

    const missingBoundGraph = ruleGraphDefinitionDtoSchema.parse({
      ...orderChoiceGraph(orderChoiceGraphId),
      nodes: [
        {
          id: 'result',
          operation: { key: 'number.add', contractVersion: 1 },
          inputs: {
            left: { kind: 'LITERAL', value: 0 },
            right: { kind: 'FACT', factKey: orderChoiceMaximumIndexFact }
          }
        }
      ]
    })
    currents.set(orderChoiceGraphId, graphCurrent(orderChoiceGraphId, missingBoundGraph))
    const missingBoundPolicy = {
      ...policy,
      orderChoiceGraph: {
        ...policy.orderChoiceGraph,
        definitionChecksum: checksumRuleDocument(missingBoundGraph)
      }
    }
    await expect(
      createReusableDefinitionService({
        store: store(policyRoot, missingBoundPolicy, currents),
        capabilities: [capability]
      }).publishDraft({
        definitionId,
        actorUserId: ownerId,
        expectedDefinitionVersion: 0,
        expectedDraftVersion: 0
      })
    ).rejects.toThrow('must reference its exact bounded System FACT keys')

    currents.set(orderChoiceGraphId, graphCurrent(orderChoiceGraphId))
    const nonNumericBoundCapability = {
      ...capability,
      factContracts: [
        { key: orderChoiceMinimumIndexFact, valueKind: 'NUMBER' as const },
        { key: orderChoiceMaximumIndexFact, valueKind: 'TEXT' as const }
      ]
    }
    await expect(
      createReusableDefinitionService({
        store: store(policyRoot, policy, currents),
        capabilities: [nonNumericBoundCapability]
      }).publishDraft({
        definitionId,
        actorUserId: ownerId,
        expectedDefinitionVersion: 0,
        expectedDraftVersion: 0
      })
    ).rejects.toThrow('bound facts must resolve to registered NUMBER System facts')

    const nonNumericGraph = booleanGraph(sourceId)
    currents.set(sourceId, graphCurrent(sourceId, nonNumericGraph))
    const nonNumericPolicy = {
      ...policy,
      evaluationGraph: {
        ...policy.evaluationGraph,
        definitionChecksum: checksumRuleDocument(nonNumericGraph),
        scoreOutput: 'passed'
      }
    }
    await expect(
      createReusableDefinitionService({
        store: store(policyRoot, nonNumericPolicy, currents),
        capabilities: [capability]
      }).publishDraft({
        definitionId,
        actorUserId: ownerId,
        expectedDefinitionVersion: 0,
        expectedDraftVersion: 0
      })
    ).rejects.toThrow('output must resolve to a registered NUMBER output')
  })

  it.each(['LEGENDARY_ACTION', 'LEGENDARY_RESISTANCE', 'RECHARGE'] as const)(
    'publishes the typed %s D&D encounter lifecycle policy through its exact graph pin',
    async (kind) => {
      const lifecycleRoot = root({
        definitionFamilyKey: DND5E_ENCOUNTER_LIFECYCLE_DEFINITION_FAMILY_KEY,
        label: 'Encounter lifecycle'
      })
      const lifecycle = encounterLifecycle(kind)
      const graphDocument = kind === 'RECHARGE' ? rechargeGraph(sourceId) : booleanGraph(sourceId)
      const current: ReusableDefinitionCurrentDto = {
        id: sourceId,
        gameSystemId: systemId,
        contentSourceId: sourceId,
        definitionFamilyKey: RULE_RUNTIME_GRAPH_FAMILY_KEY,
        label: 'Graph',
        description: null,
        document: graphDocument,
        checksum: checksumRuleDocument(graphDocument),
        contractVersion: 1,
        version: 1,
        publishedAt: '2026-08-25T00:00:00.000Z',
        publishedBy: ownerId
      }
      const lifecycleService = createReusableDefinitionService({
        store: store(lifecycleRoot, lifecycle, new Map([[sourceId, current]])),
        capabilities: [capability]
      })
      await expect(
        lifecycleService.publishDraft({
          definitionId,
          actorUserId: ownerId,
          expectedDefinitionVersion: 0,
          expectedDraftVersion: 0
        })
      ).resolves.toMatchObject({ document: lifecycle })
    }
  )

  it('rejects stale, foreign-System, and non-BOOLEAN D&D encounter lifecycle graph pins', async () => {
    const lifecycleRoot = root({
      definitionFamilyKey: DND5E_ENCOUNTER_LIFECYCLE_DEFINITION_FAMILY_KEY,
      label: 'Encounter lifecycle'
    })
    const lifecycle = encounterLifecycle()
    const graphCurrent = (
      document = booleanGraph(sourceId),
      version = 1,
      gameSystemId = systemId
    ): ReusableDefinitionCurrentDto => ({
      id: sourceId,
      gameSystemId,
      contentSourceId: sourceId,
      definitionFamilyKey: RULE_RUNTIME_GRAPH_FAMILY_KEY,
      label: 'Graph',
      description: null,
      document: { ...document, gameSystemId },
      checksum: checksumRuleDocument({ ...document, gameSystemId }),
      contractVersion: 1,
      version,
      publishedAt: '2026-08-25T00:00:00.000Z',
      publishedBy: ownerId
    })
    for (const current of [
      graphCurrent(undefined, 2),
      graphCurrent(undefined, 1, otherId),
      graphCurrent({ ...graph(), id: sourceId })
    ]) {
      const definitionService = createReusableDefinitionService({
        store: store(lifecycleRoot, lifecycle, new Map([[sourceId, current]])),
        capabilities: [capability]
      })
      await expect(
        definitionService.publishDraft({
          definitionId,
          actorUserId: ownerId,
          expectedDefinitionVersion: 0,
          expectedDraftVersion: 0
        })
      ).rejects.toBeInstanceOf(ReusableDefinitionValidationError)
    }
  })

  it('requires a single terminal d6 evidence protocol for published Recharge policies', async () => {
    const lifecycleRoot = root({
      definitionFamilyKey: DND5E_ENCOUNTER_LIFECYCLE_DEFINITION_FAMILY_KEY,
      label: 'Recharge lifecycle'
    })
    const lifecycle = dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema.parse(
      encounterLifecycle('RECHARGE')
    )
    if (lifecycle.kind !== 'RECHARGE') throw new Error('Expected a Recharge lifecycle fixture.')
    const current = (document: ReturnType<typeof ruleGraphDefinitionDtoSchema.parse>) => ({
      id: sourceId,
      gameSystemId: systemId,
      contentSourceId: sourceId,
      definitionFamilyKey: RULE_RUNTIME_GRAPH_FAMILY_KEY,
      label: 'Recharge graph',
      description: null,
      document,
      checksum: checksumRuleDocument(document),
      contractVersion: 1,
      version: 1,
      publishedAt: '2026-08-25T00:00:00.000Z',
      publishedBy: ownerId
    })
    const publish = (document: ReturnType<typeof ruleGraphDefinitionDtoSchema.parse>) =>
      createReusableDefinitionService({
        store: store(
          lifecycleRoot,
          {
            ...lifecycle,
            rechargeGraph: {
              ...lifecycle.rechargeGraph,
              definitionChecksum: checksumRuleDocument(document)
            }
          },
          new Map([[sourceId, current(document)]])
        ),
        capabilities: [capability]
      }).publishDraft({
        definitionId,
        actorUserId: ownerId,
        expectedDefinitionVersion: 0,
        expectedDraftVersion: 0
      })

    await expect(publish(rechargeGraph(sourceId))).resolves.toBeDefined()
    await expect(publish(booleanGraph(sourceId))).rejects.toThrow('BOOLEAN output')
    await expect(publish(rechargeGraph(sourceId, { max: 8 }))).rejects.toThrow('bounded d6')
    await expect(publish(rechargeGraph(sourceId, { secondRequest: true }))).rejects.toThrow(
      'exactly one INTEGER_RANGE'
    )
  })
})
