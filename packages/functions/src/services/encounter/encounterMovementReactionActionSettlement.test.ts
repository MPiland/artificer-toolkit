import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { EncounterActorRecord } from '@artificer-toolkit/db'
import type { ServerPublishedRuleDefinitionDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import {
  addNumbersRuleOperation,
  checksumRuleDocument,
  integerRangeEvidenceRuleOperation
} from '@artificer-toolkit/shared/rules'

const state = vi.hoisted(() => ({
  createActiveEffect: vi.fn(),
  assertCurrentFeature: vi.fn(),
  applyActor: vi.fn(),
  applyCharacter: vi.fn(),
  compileFeature: vi.fn(),
  persistResource: vi.fn(),
  updateActor: vi.fn()
}))

vi.mock('../rules/encounterFeatureActionCapabilityDiscovery.js', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../rules/encounterFeatureActionCapabilityDiscovery.js')
  >()),
  assertEncounterFeatureActionCapabilityCurrent: state.assertCurrentFeature
}))

vi.mock('../rules/characterRuleActionSystemAdapterRegistry.js', () => ({
  characterRuleActionSystemAdapterRegistry: {
    get: () => ({ compile: state.compileFeature })
  }
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@artificer-toolkit/db')>()),
  createEncounterRepository: () => ({ updateActor: state.updateActor }),
  createActiveRuleEffectRepository: () => ({
    create: state.createActiveEffect
  })
}))

vi.mock('./encounterCharacterMechanicsBatch.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./encounterCharacterMechanicsBatch.js')>()),
  applyLockedEncounterActorMechanicsBatch: state.applyActor,
  applyLockedEncounterCharacterMechanicsBatch: state.applyCharacter,
  deriveEncounterCharacterMechanicsEventCommandId: ({
    sourceCommandId,
    phase,
    ordinal
  }: {
    sourceCommandId: string
    phase: string
    ordinal: number
  }) => `${sourceCommandId}:${phase}:${ordinal}`,
  readEncounterActorConditionState: (value: unknown) => ({
    ids: Array.isArray(value)
      ? value.flatMap((entry) =>
          typeof entry === 'object' &&
          entry !== null &&
          'conditionTypeId' in entry &&
          typeof entry.conditionTypeId === 'string'
            ? [entry.conditionTypeId]
            : []
        )
      : [],
    values: Array.isArray(value) ? value : []
  })
}))

vi.mock('./encounterCharacterActionResource.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./encounterCharacterActionResource.js')>()),
  persistEncounterCharacterActionResourceConsumption: state.persistResource
}))

import type { PreparedEncounterMovementReactionSettlement } from './encounterMovementReactionActionSettlement.js'
import { settleEncounterActionSettlementCore } from './encounterActionSettlementCore.js'
import {
  prepareEncounterMovementReactionSettlement,
  settleEncounterMovementReactionAction
} from './encounterMovementReactionActionSettlement.js'
import { createRulesRuntimeService } from '../rules/rulesRuntimeService.js'
import {
  compileDnd5eEffectActionTestTemplate,
  dnd5eAttackTestOperation,
  dnd5eCharacterRuleActionSystemAdapter,
  dnd5eDamageProposalOperation,
  dnd5eDamageTotalOperation,
  dnd5eEffectActionCapability,
  dnd5eHitPointMaximumReductionProposalOperation,
  dnd5eSaveTestOperation,
  DND5E_ATTACK_MODIFIER_FACT_KEY,
  DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY,
  DND5E_SAVE_MODIFIER_FACT_KEY,
  DND5E_TARGET_ACTOR_FACT_KEY,
  DND5E_TARGET_DEFENSE_FACT_KEY,
  DND5E_TARGET_STATE_CHECKSUM_FACT_KEY,
  specializeDnd5eEffectActionOutcome,
  type Dnd5eCompiledEffectActionSource
} from '../rules/systems/dnd5e/effectActionCompiler.js'
import { DND5E_SYSTEM_ID } from '../rules/systems/dnd5e/characterActionCapabilityDiscovery.js'
import {
  clayGolemSlamFixture,
  rugSmotherFixture
} from '../rules/systems/dnd5e/creatureRelationshipFixtures.js'
import { foldCharacterMechanicsApplications } from './encounterCharacterMechanicsBatch.js'

type LockedTargetCharacter =
  PreparedEncounterMovementReactionSettlement['targets']['lockedCharacters'] extends ReadonlyMap<
    string,
    infer Value
  >
    ? Value
    : never

const ids = {
  actor: '00000000-0000-4000-8000-000000000201',
  allowance: '00000000-0000-4000-8000-000000000202',
  character: '00000000-0000-4000-8000-000000000203',
  encounter: '00000000-0000-4000-8000-000000000204',
  occurrence: '00000000-0000-4000-8000-000000000205',
  feature: '00000000-0000-4000-8000-000000000216',
  featureCharge: 'feature-charge',
  target: '00000000-0000-4000-8000-000000000206',
  user: '00000000-0000-4000-8000-000000000207'
}

const transition = {
  checksum: 'a'.repeat(64),
  before: {
    currentHitPoints: 10,
    temporaryHitPoints: 0,
    maximumHitPoints: 10,
    scalarValues: {},
    conditionIds: []
  },
  after: {
    currentHitPoints: 6,
    temporaryHitPoints: 0,
    maximumHitPoints: 10,
    scalarValues: {},
    conditionIds: []
  }
}

const receiptApplication = {
  ordinal: 0,
  kind: 'DAMAGE' as const,
  requestedAmount: 4,
  resolvedAmount: 4,
  appliedAmount: 4,
  beforeCurrentHitPoints: 10,
  afterCurrentHitPoints: 6,
  beforeTemporaryHitPoints: 0,
  afterTemporaryHitPoints: 0,
  maximumHitPoints: 10,
  damageTypeId: '00000000-0000-4000-8000-000000000208',
  damageDisposition: 'NORMAL' as const,
  sourceNodeId: 'damage',
  sourceOperationKey: 'test.damage',
  authoredPath: 'ON_HIT',
  resolvedPath: 'ON_HIT'
}

function actor(input: {
  id: string
  kind: 'CHARACTER' | 'CREATURE'
  sourceId?: string
}): EncounterActorRecord {
  return {
    id: input.id,
    encounterId: ids.encounter,
    kind: input.kind,
    sourceId: input.sourceId ?? null,
    sourceRevision: input.kind === 'CHARACTER' ? 4 : 1,
    systemId: '00000000-0000-4000-8000-000000000209',
    label: input.kind,
    stableTieKey: input.id,
    public: true,
    maxHitPoints: 10,
    currentHitPoints: 10,
    tempHitPoints: 0,
    conditions: [],
    resources: {},
    gmNotes: null,
    initiative: null,
    manualOrder: null,
    snapshot: {},
    createdAt: '2026-08-28T00:00:00.000Z',
    updatedAt: '2026-08-28T00:00:00.000Z'
  }
}

function prepared(
  resourceConsumption: PreparedEncounterMovementReactionSettlement['resourceConsumption'] = null
): PreparedEncounterMovementReactionSettlement {
  const sourceActor = actor({
    id: ids.actor,
    kind: 'CHARACTER',
    sourceId: ids.character
  })
  const targetActor = actor({ id: ids.target, kind: 'CREATURE' })
  return {
    action: {} as PreparedEncounterMovementReactionSettlement['action'],
    actionSource: {
      kind: 'CHARACTER_ACTION',
      actorId: ids.actor,
      characterId: ids.character
    } as PreparedEncounterMovementReactionSettlement['actionSource'],
    option: {
      optionId: 'b'.repeat(64)
    } as PreparedEncounterMovementReactionSettlement['option'],
    movementInterruption: null,
    sourceActor,
    targetActor,
    targets: {
      characterIds: [ids.character],
      encounterActorIds: [ids.target],
      lockedCharacters: new Map([
        [
          ids.character,
          {
            id: ids.character,
            systemId: sourceActor.systemId!,
            streamVersion: 4,
            actor: sourceActor,
            mechanics: {
              commandState: { state: { spellSlots: [] } }
            } as unknown as LockedTargetCharacter['mechanics'],
            overlay: {} as LockedTargetCharacter['overlay'],
            maximumHitPoints: 10,
            conditionDefinitions: [],
            activeConditionDefinitionIds: [],
            baseScalarValues: {},
            effectiveScalarValues: {}
          }
        ]
      ]),
      encounterActors: new Map([[ids.target, targetActor]]),
      activeEffectsByActorId: new Map([
        [ids.actor, []],
        [ids.target, []]
      ]),
      encounterActorRules: null
    },
    resourceConsumption,
    featureResourceConsumption: null,
    targetFeatureResourceConsumption: null,
    allowance: {
      definitionId: ids.allowance,
      maximum: 1,
      beforeUsed: 0,
      afterUsed: 1
    }
  }
}

function featureActionSource(actorId = ids.actor) {
  return {
    kind: 'ENCOUNTER_FEATURE' as const,
    actorId,
    capability: {
      kind: 'ENCOUNTER_FEATURE',
      encounterActorId: actorId,
      gameSystemId: '00000000-0000-4000-8000-000000000209',
      compiledEffect: {
        invocation: {
          kind: 'ACTION',
          shape: null,
          targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' },
          resourceUse: null
        }
      },
      mechanicFacts: {
        invocation: {
          triggerCode: 'MELEE_WEAPON_ATTACK',
          activation: { code: 'REACTION', amount: 1 },
          savingThrow: null
        },
        outcomes: []
      },
      effectId: '00000000-0000-4000-8000-000000000212',
      ownerFeatureId: ids.feature,
      featureResourceUse: null,
      attackMechanic: {
        rollDefinitionId: '00000000-0000-4000-8000-000000000213',
        attackBonus: 4,
        rollMode: 'NORMAL',
        definitionChecksum: 'a'.repeat(64)
      }
    }
  } as unknown as PreparedEncounterMovementReactionSettlement['actionSource']
}

function featureResourceConsumption() {
  return {
    ownerFeatureId: ids.feature,
    chargeId: ids.featureCharge,
    cost: 1,
    beforeUsed: 0,
    afterUsed: 1,
    beforeRemaining: 2,
    afterRemaining: 1
  } as NonNullable<PreparedEncounterMovementReactionSettlement['featureResourceConsumption']>
}

function preparedFeature(
  targetActor = actor({ id: ids.target, kind: 'CREATURE' })
): PreparedEncounterMovementReactionSettlement {
  const sourceActor = actor({ id: ids.actor, kind: 'CREATURE' })
  return {
    action: {} as PreparedEncounterMovementReactionSettlement['action'],
    actionSource: featureActionSource(),
    option: {
      optionId: 'b'.repeat(64)
    } as PreparedEncounterMovementReactionSettlement['option'],
    movementInterruption: null,
    sourceActor,
    targetActor,
    targets: {
      characterIds: [],
      encounterActorIds: [ids.actor, targetActor.id],
      lockedCharacters: new Map(),
      encounterActors: new Map([
        [ids.actor, sourceActor],
        [targetActor.id, targetActor]
      ]),
      activeEffectsByActorId: new Map([
        [ids.actor, []],
        [targetActor.id, []]
      ]),
      baseScalarValuesByActorId: new Map([
        [ids.actor, {}],
        [targetActor.id, {}]
      ]),
      effectiveScalarValuesByActorId: new Map([
        [ids.actor, {}],
        [targetActor.id, {}]
      ]),
      encounterActorRules: null
    },
    resourceConsumption: null,
    featureResourceConsumption: null,
    targetFeatureResourceConsumption: null,
    allowance: {
      definitionId: ids.allowance,
      maximum: 1,
      beforeUsed: 0,
      afterUsed: 1
    }
  }
}

function publishedGraph(input: {
  checksum: string
  nodeId: string
}): ServerPublishedRuleDefinitionDto {
  const definition = {
    schemaVersion: 1 as const,
    id: '00000000-0000-4000-8000-000000000212',
    gameSystemId: '00000000-0000-4000-8000-000000000209',
    definitionFamilyKey: 'effect-action',
    nodes: [
      {
        id: input.nodeId,
        operation: { key: 'evidence.integer-range', contractVersion: 1 },
        inputs: {
          min: { kind: 'LITERAL' as const, value: 1 },
          max: { kind: 'LITERAL' as const, value: 20 }
        }
      }
    ],
    outputs: {
      value: {
        kind: 'NODE_OUTPUT' as const,
        nodeId: input.nodeId,
        port: 'value'
      }
    },
    sourceEntryBindings: [
      {
        sourceEntryId: '00000000-0000-4000-8000-000000000226',
        nodeId: input.nodeId
      }
    ]
  }
  return {
    id: definition.id,
    gameSystemId: definition.gameSystemId,
    definitionFamilyKey: definition.definitionFamilyKey,
    checksum: input.checksum,
    definition
  }
}

function repeatingConditionPlan() {
  const initialGraph = publishedGraph({
    checksum: 'a'.repeat(64),
    nodeId: 'initial-d20'
  })
  const repeatGraph = publishedGraph({
    checksum: 'd'.repeat(64),
    nodeId: 'repeat-save-test'
  })
  return {
    initialGraph,
    plan: {
      authoredEffectId: initialGraph.id,
      compiledEntryId: '00000000-0000-4000-8000-000000000226',
      frozenGraphNodeId: 'repeat-save-test',
      frozenGraph: repeatGraph,
      capabilityContractVersion: 1,
      recurrenceStage: 'END_OF_TURN' as const,
      initialRemaining: null,
      conditionContribution: {
        conditionId: '00000000-0000-4000-8000-000000000227'
      },
      adapterFacts: {},
      perceptionContributions: [],
      maintenance: null
    }
  }
}

function conditionApplyExecution(targetActorId: string) {
  return {
    ...execution(),
    applications: [
      {
        kind: 'CONDITION_APPLY' as const,
        targetActorId,
        conditionId: '00000000-0000-4000-8000-000000000227',
        sourceNodeId: 'initial-condition-apply',
        sourceOperationKey: 'dnd5e.condition-apply-proposal',
        authoredPath: 'ON_SAVE_FAIL',
        resolvedPath: 'ON_SAVE_FAIL'
      }
    ]
  }
}

function execution() {
  return {
    kind: 'COMPLETE' as const,
    execution: {
      status: 'COMPLETE',
      outputs: {},
      evidence: { trace: [] },
      movementInterruption: null
    },
    applications: [],
    d20: null
  } as unknown as Parameters<typeof settleEncounterMovementReactionAction>[0]['execution']
}

function clayGolemSlamSource(): {
  action: Dnd5eCompiledEffectActionSource
  damageOutcomeId: string
  damageTypeId: string
  reductionOutcomeId: string
} {
  const fixture = clayGolemSlamFixture()
  return {
    action: {
      gameSystemId: fixture.capability.gameSystemId,
      entryPointDefinitionId: fixture.capability.effectId,
      effectId: fixture.capability.effectId,
      conditionDefinitionIds: [],
      compiledEffect: fixture.capability.compiledEffect
    },
    damageOutcomeId: fixture.source.damageId,
    damageTypeId: fixture.damageTypeId,
    reductionOutcomeId: fixture.source.reductionId
  }
}

function canonicalRugSmotherSource() {
  const fixture = rugSmotherFixture()
  const sourceActor: EncounterActorRecord = {
    ...actor({ id: ids.actor, kind: 'CREATURE' }),
    sourceId: fixture.capability.creatureSourceId,
    sourceRevision: 1,
    systemId: DND5E_SYSTEM_ID,
    label: 'Rug Smother fixture',
    snapshot: {
      kind: 'CREATURE',
      id: fixture.capability.creatureSourceId,
      systemId: DND5E_SYSTEM_ID,
      sourceRevision: 1,
      sourceVersionId: '00000000-0000-4000-8000-000000000245',
      sourceChecksum: 'a'.repeat(64),
      payload: {
        size: 'MEDIUM',
        abilityScores: fixture.abilityScores,
        features: []
      }
    } as EncounterActorRecord['snapshot']
  }
  const capability = { ...fixture.capability, encounterActorId: sourceActor.id }
  const published = dnd5eCharacterRuleActionSystemAdapter.compile({ action: capability })
  const [activeEffectPlan] = dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans!({
    action: capability,
    published
  })
  if (!activeEffectPlan?.actorRelationshipContribution) {
    throw new Error('The local Rug Smother relationship plan is unavailable.')
  }
  return { activeEffectPlan, capability, published, sourceActor }
}

async function executeRuleDefinition(input: {
  published: ServerPublishedRuleDefinitionDto
  occurrenceId: string
  facts: Readonly<Record<string, string | number | boolean>>
  valueForNode: (nodeId: string) => number
}) {
  const runtime = createRulesRuntimeService({
    capabilities: [dnd5eEffectActionCapability],
    operations: [
      integerRangeEvidenceRuleOperation,
      addNumbersRuleOperation,
      dnd5eAttackTestOperation,
      dnd5eSaveTestOperation,
      dnd5eDamageTotalOperation,
      dnd5eDamageProposalOperation,
      dnd5eHitPointMaximumReductionProposalOperation
    ],
    continuationIntegrityKey: new Uint8Array(32).fill(41),
    definitions: {
      async requireCurrent() {
        throw new Error('Not used by the source-bound Clay Golem tracer.')
      }
    }
  })
  let result = await runtime.executeResolved({
    command: {
      definitionId: input.published.id,
      occurrenceId: input.occurrenceId,
      facts: input.facts
    },
    published: input.published
  })
  while (result.status === 'PAUSED') {
    const request = result.continuation.request
    result = await runtime.resume({
      continuation: result.continuation,
      response: {
        requestId: request.requestId,
        value: input.valueForNode(request.nodeId)
      }
    })
  }
  if (result.status !== 'COMPLETE') throw new Error('Expected a completed Clay Golem rule graph.')
  return result
}

async function executeClayGolemSlam(input: {
  attackNatural: number
  saveNatural: number
  occurrenceId: string
  defenses?: readonly {
    kind: 'RESISTANCE' | 'IMMUNITY' | 'VULNERABILITY'
    damageTypeId: string
  }[]
}) {
  const source = clayGolemSlamSource()
  const testTemplate = compileDnd5eEffectActionTestTemplate({
    action: source.action
  })
  const commonFacts = {
    [DND5E_TARGET_ACTOR_FACT_KEY]: ids.target,
    [DND5E_TARGET_STATE_CHECKSUM_FACT_KEY]: 'a'.repeat(64),
    [DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY]: checksumRuleDocument([])
  }
  const testExecution = await executeRuleDefinition({
    published: testTemplate.published,
    occurrenceId: input.occurrenceId,
    facts: {
      ...commonFacts,
      [DND5E_ATTACK_MODIFIER_FACT_KEY]: 8,
      [DND5E_TARGET_DEFENSE_FACT_KEY]: 14
    },
    valueForNode: () => input.attackNatural
  })
  const selectedPath = testExecution.outputs.resultPath
  if (selectedPath !== 'ON_HIT' && selectedPath !== 'ON_CRIT') {
    throw new Error('Expected the canonical Clay Golem Slam to hit.')
  }
  const outcomeTemplate = specializeDnd5eEffectActionOutcome({
    action: source.action,
    testTemplate,
    selectedPath,
    facts: {
      resolvedDamageOutcomeExpressions: {
        [source.damageOutcomeId]: '2d10 + 5'
      }
    }
  })
  if (!outcomeTemplate) throw new Error('The canonical Clay Golem Slam outcome is unavailable.')
  const outcomeExecution = await executeRuleDefinition({
    published: outcomeTemplate.published,
    occurrenceId: input.occurrenceId,
    facts: { ...commonFacts, [DND5E_SAVE_MODIFIER_FACT_KEY]: 0 },
    valueForNode: (nodeId) => (nodeId === 'nested-save-d20' ? input.saveNatural : 1)
  })
  const applications = dnd5eCharacterRuleActionSystemAdapter.interpret({
    execution: outcomeExecution,
    occurrenceId: input.occurrenceId,
    published: outcomeTemplate.published,
    targetActorId: ids.target,
    currentHitPoints: 10,
    temporaryHitPoints: 0,
    maximumHitPoints: 10,
    defenses: input.defenses ?? []
  })
  return {
    applications,
    outcomeExecution,
    published: outcomeTemplate.published,
    selectedPath
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  state.assertCurrentFeature.mockReturnValue(undefined)
  state.compileFeature.mockReturnValue({
    id: '00000000-0000-4000-8000-000000000212',
    checksum: 'a'.repeat(64)
  })
  state.updateActor.mockResolvedValue(undefined)
  state.createActiveEffect.mockImplementation(async (input) => ({
    id: '00000000-0000-4000-8000-000000000225',
    owner: input.owner,
    sourceEncounterId: input.owner.kind === 'CHARACTER' ? ids.encounter : null,
    maintainedEffectStateId: null,
    createdOrdinal: 1,
    version: 1,
    definition: input.definition,
    definitionChecksum: 'b'.repeat(64),
    lifecycle: input.lifecycle,
    lifecycleChecksum: 'c'.repeat(64),
    createdAt: '2026-08-31T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z'
  }))
  state.persistResource.mockResolvedValue(undefined)
  state.applyActor.mockResolvedValue({
    updatedActor: {
      ...actor({ id: ids.target, kind: 'CREATURE' }),
      currentHitPoints: 6
    },
    receiptApplications: [receiptApplication],
    targetTransition: transition,
    stateChanged: true
  })
})

describe('Encounter movement reaction action settlement', () => {
  it.each([
    { label: 'Character target', kind: 'CHARACTER' as const },
    { label: 'Encounter actor target', kind: 'CREATURE' as const }
  ])(
    'persists the distinct frozen repeat graph for a condition applied to a $label',
    async ({ kind }) => {
      const targetActor = actor({
        id: ids.target,
        kind,
        ...(kind === 'CHARACTER' ? { sourceId: ids.character } : {})
      })
      const value = preparedFeature(targetActor)
      const repeat = repeatingConditionPlan()
      value.action = {
        ...value.action,
        published: repeat.initialGraph,
        target: {
          actorId: targetActor.id,
          currentHitPoints: 10,
          temporaryHitPoints: 0,
          maximumHitPoints: 10,
          scalarValues: {},
          conditionIds: [],
          derivedFacts: {},
          defenses: [],
          conditionImmunityIds: []
        }
      }
      value.activeEffectPlan = repeat.plan
      value.targets = {
        ...value.targets,
        activeEffectsByActorId: new Map([[targetActor.id, []]])
      }
      const complete = conditionApplyExecution(targetActor.id)
      const folded = foldCharacterMechanicsApplications({
        targetActorId: targetActor.id,
        currentHitPoints: 10,
        temporaryHitPoints: 0,
        maximumHitPoints: 10,
        scalarValues: {},
        conditionIds: [],
        applications: complete.applications
      })
      const targetTransition = {
        checksum: checksumRuleDocument({
          before: folded.before,
          after: folded.after,
          applications: folded.applications
        }),
        before: folded.before,
        after: folded.after
      }
      if (kind === 'CHARACTER') {
        value.targets = {
          ...value.targets,
          characterIds: [ids.character],
          lockedCharacters: new Map([
            [
              ids.character,
              {
                id: ids.character,
                systemId: targetActor.systemId!,
                streamVersion: 4,
                actor: targetActor,
                mechanics: {
                  commandState: { state: { spellSlots: [] } }
                } as unknown as LockedTargetCharacter['mechanics'],
                overlay: {} as LockedTargetCharacter['overlay'],
                maximumHitPoints: 10,
                conditionDefinitions: [],
                activeConditionDefinitionIds: []
              }
            ]
          ])
        }
        state.applyCharacter.mockResolvedValue({
          updatedActor: targetActor,
          streamVersion: 5,
          targetTransition,
          receiptApplications: folded.applications
        })
      } else {
        state.applyActor.mockResolvedValue({
          updatedActor: targetActor,
          receiptApplications: folded.applications,
          targetTransition,
          stateChanged: true
        })
      }

      const settled = await settleEncounterActionSettlementCore({
        db: {} as never,
        actorUserId: ids.user,
        encounterId: ids.encounter,
        occurrenceId: ids.occurrence,
        commandId: '00000000-0000-4000-8000-000000000228',
        ordinal: 0,
        eventPhases: {
          resource: 'MOVEMENT_REACTION_RESOURCE',
          outcome: 'MOVEMENT_REACTION_OUTCOME'
        },
        prepared: value,
        execution: complete
      })

      expect(state.createActiveEffect).toHaveBeenCalledTimes(1)
      expect(state.createActiveEffect).toHaveBeenCalledWith(
        expect.objectContaining({
          owner:
            kind === 'CHARACTER'
              ? { kind: 'CHARACTER', characterId: ids.character }
              : {
                  kind: 'ENCOUNTER_ACTOR',
                  encounterId: ids.encounter,
                  targetActorId: ids.target
                },
          definition: expect.objectContaining({
            authoredEffectId: repeat.plan.authoredEffectId,
            compiledEntryId: repeat.plan.compiledEntryId,
            frozenGraphNodeId: repeat.plan.frozenGraphNodeId,
            recurrence: expect.objectContaining({
              recurrenceStage: 'END_OF_TURN'
            }),
            stateContributions: [
              {
                kind: 'CONDITION_OWNERSHIP',
                conditionId: repeat.plan.conditionContribution!.conditionId,
                baselinePresent: false
              }
            ],
            frozenGraph: expect.objectContaining({
              source: expect.objectContaining({
                checksum: repeat.plan.frozenGraph.checksum
              })
            })
          }),
          lifecycle: { schemaVersion: 1, remainingTicks: null }
        })
      )
      if (!('activeEffectTransitions' in settled.application)) {
        throw new Error('Expected active-effect receipt transitions.')
      }
      expect(settled.application.activeEffectTransitions).toEqual([
        expect.objectContaining({
          authoredEffectId: repeat.plan.authoredEffectId,
          compiledEntryId: repeat.plan.compiledEntryId,
          frozenGraphNodeId: repeat.plan.frozenGraphNodeId,
          frozenSourceChecksum: repeat.plan.frozenGraph.checksum,
          recurrenceStage: 'END_OF_TURN',
          remainingTicks: null
        })
      ])
    }
  )

  it.each([
    {
      label: 'Cloaker Bite',
      recurrenceStage: 'NONE' as const,
      applications: [receiptApplication],
      targetSize: 'MEDIUM',
      rollMode: 'NORMAL' as const,
      unconditionalSuppression: false,
      conditionalState: true,
      expectedConditionalState: false
    },
    {
      label: 'Cloaker Bite with authored advantage state',
      recurrenceStage: 'NONE' as const,
      applications: [receiptApplication],
      targetSize: 'MEDIUM',
      rollMode: 'ADVANTAGE' as const,
      unconditionalSuppression: false,
      conditionalState: true,
      expectedConditionalState: true
    },
    {
      label: 'Rug Smother',
      recurrenceStage: 'START_OF_TURN' as const,
      applications: [],
      targetSize: 'MEDIUM',
      rollMode: 'NORMAL' as const,
      unconditionalSuppression: true,
      conditionalState: false,
      expectedConditionalState: false
    }
  ])(
    'persists the target-owned $label relationship only after a successful attack',
    async ({
      recurrenceStage,
      applications,
      targetSize,
      rollMode,
      unconditionalSuppression,
      conditionalState,
      expectedConditionalState
    }) => {
      const targetActor = {
        ...actor({ id: ids.target, kind: 'CREATURE' }),
        snapshot: { payload: { size: targetSize } }
      }
      const value = preparedFeature(targetActor)
      const graph = publishedGraph({
        checksum: 'a'.repeat(64),
        nodeId: 'relationship'
      })
      const relationshipOutcomeId = '00000000-0000-4000-8000-000000000229'
      value.action = {
        ...value.action,
        published: graph,
        target: {
          actorId: targetActor.id,
          currentHitPoints: 10,
          temporaryHitPoints: 0,
          maximumHitPoints: 10,
          scalarValues: {},
          conditionIds: [],
          derivedFacts: {},
          defenses: [],
          conditionImmunityIds: []
        }
      }
      value.activeEffectPlan = {
        authoredEffectId: graph.id,
        compiledEntryId: '00000000-0000-4000-8000-000000000226',
        frozenGraphNodeId: 'relationship',
        frozenGraph: graph,
        capabilityContractVersion: 1,
        recurrenceStage,
        initialRemaining: null,
        conditionContribution: null,
        actorRelationshipContribution: {
          relationshipOutcomeId,
          modules: [
            {
              id: '00000000-0000-4000-8000-000000000230',
              order: 0,
              kind: 'TARGET_SIZE_MAXIMUM',
              sizeCode: 'LARGE'
            },
            {
              id: '00000000-0000-4000-8000-000000000231',
              order: 1,
              kind: 'SOURCE_EXCLUSIVE_TARGET',
              maximum: 1
            },
            ...(unconditionalSuppression
              ? [
                  {
                    id: '00000000-0000-4000-8000-000000000240' as const,
                    order: 2,
                    kind: 'TARGET_CAPABILITY_SUPPRESSION' as const,
                    capabilityDefinitionIds: ['00000000-0000-4000-8000-000000000242']
                  }
                ]
              : []),
            ...(conditionalState
              ? [
                  {
                    id: '00000000-0000-4000-8000-000000000241' as const,
                    order: 3,
                    kind: 'CONDITIONAL_TARGET_STATE' as const,
                    whenResolvedAttackD20Mode: 'ADVANTAGE' as const,
                    conditionIds: ['00000000-0000-4000-8000-000000000243'],
                    capabilityDefinitionIds: ['00000000-0000-4000-8000-000000000242']
                  }
                ]
              : [])
          ],
          conditionIds: [],
          capabilitySuppressions: unconditionalSuppression
            ? [
                {
                  contributionId: '00000000-0000-4000-8000-000000000240',
                  capabilityDefinitionIds: ['00000000-0000-4000-8000-000000000242']
                }
              ]
            : []
        },
        adapterFacts: {},
        perceptionContributions: [],
        maintenance: null
      }
      value.targets = {
        ...value.targets,
        activeEffectsByActorId: new Map([[targetActor.id, []]])
      }
      const contributors =
        rollMode === 'ADVANTAGE'
          ? [
              {
                sourceId: 'active-effect:test-relationship',
                grantId: null,
                domainKey: 'actor-relationship:test',
                influence: 'ADVANTAGE' as const
              }
            ]
          : []
      const complete = {
        ...execution(),
        applications,
        d20: {
          requestId: '00000000-0000-4000-8000-000000000233',
          rollMode,
          rawFaces: rollMode === 'ADVANTAGE' ? [10, 9] : [10],
          selectedNatural: 10,
          contributors,
          contributorChecksum: checksumRuleDocument(contributors),
          modifier: 4,
          total: 14,
          defenseOrDc: 12,
          resultPath: 'ON_HIT'
        }
      } as Parameters<typeof settleEncounterActionSettlementCore>[0]['execution']
      state.applyActor.mockResolvedValue({
        updatedActor: targetActor,
        receiptApplications: applications,
        targetTransition:
          applications.length > 0
            ? transition
            : {
                checksum: checksumRuleDocument({
                  before: transition.before,
                  after: transition.before
                }),
                before: transition.before,
                after: transition.before
              },
        stateChanged: applications.length > 0
      })

      await settleEncounterActionSettlementCore({
        db: {} as never,
        actorUserId: ids.user,
        encounterId: ids.encounter,
        occurrenceId: ids.occurrence,
        commandId: '00000000-0000-4000-8000-000000000232',
        ordinal: 0,
        eventPhases: {
          resource: 'MOVEMENT_REACTION_RESOURCE',
          outcome: 'MOVEMENT_REACTION_OUTCOME'
        },
        prepared: value,
        execution: complete
      })

      expect(state.createActiveEffect).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: {
            kind: 'ENCOUNTER_ACTOR',
            encounterId: ids.encounter,
            targetActorId: ids.target
          },
          definition: expect.objectContaining({
            schemaVersion: 2,
            recurrence: expect.objectContaining({ recurrenceStage }),
            stateContributions: expect.arrayContaining([
              expect.objectContaining({
                kind: 'ACTOR_RELATIONSHIP',
                relationshipOutcomeId,
                conditionIds: expectedConditionalState
                  ? ['00000000-0000-4000-8000-000000000243']
                  : [],
                capabilitySuppressions: [
                  ...(unconditionalSuppression
                    ? [
                        {
                          contributionId: '00000000-0000-4000-8000-000000000240',
                          capabilityDefinitionIds: ['00000000-0000-4000-8000-000000000242']
                        }
                      ]
                    : []),
                  ...(expectedConditionalState
                    ? [
                        {
                          contributionId: '00000000-0000-4000-8000-000000000241',
                          capabilityDefinitionIds: ['00000000-0000-4000-8000-000000000242']
                        }
                      ]
                    : [])
                ]
              })
            ])
          })
        })
      )
    }
  )

  it('persists the canonical Rug Smother relationship on its target without running its start-turn recurrence', async () => {
    const source = canonicalRugSmotherSource()
    const targetActor: EncounterActorRecord = {
      ...actor({ id: ids.target, kind: 'CREATURE' }),
      snapshot: { payload: { size: 'MEDIUM' } } as EncounterActorRecord['snapshot']
    }
    const value = preparedFeature(targetActor)
    value.sourceActor = source.sourceActor
    value.actionSource = {
      kind: 'ENCOUNTER_FEATURE',
      actorId: source.sourceActor.id,
      capability: source.capability
    } as PreparedEncounterMovementReactionSettlement['actionSource']
    value.action = {
      ...value.action,
      published: source.published,
      target: {
        actorId: targetActor.id,
        currentHitPoints: targetActor.currentHitPoints,
        temporaryHitPoints: targetActor.tempHitPoints,
        maximumHitPoints: targetActor.maxHitPoints,
        scalarValues: {},
        conditionIds: [],
        derivedFacts: {},
        defenses: [],
        conditionImmunityIds: []
      }
    }
    value.activeEffectPlan = source.activeEffectPlan
    value.targets = {
      ...value.targets,
      encounterActors: new Map([
        [source.sourceActor.id, source.sourceActor],
        [targetActor.id, targetActor]
      ]),
      activeEffectsByActorId: new Map([[targetActor.id, []]])
    }
    state.applyActor.mockResolvedValue({
      updatedActor: targetActor,
      receiptApplications: [],
      targetTransition: {
        checksum: checksumRuleDocument({ before: transition.before, after: transition.before }),
        before: transition.before,
        after: transition.before
      },
      stateChanged: false
    })

    const settled = await settleEncounterActionSettlementCore({
      db: {} as never,
      actorUserId: ids.user,
      encounterId: ids.encounter,
      occurrenceId: ids.occurrence,
      commandId: '00000000-0000-4000-8000-000000000246',
      ordinal: 0,
      eventPhases: {
        resource: 'MOVEMENT_REACTION_RESOURCE',
        outcome: 'MOVEMENT_REACTION_OUTCOME'
      },
      prepared: value,
      execution: {
        ...execution(),
        d20: {
          requestId: '00000000-0000-4000-8000-000000000247',
          rollMode: 'NORMAL',
          rawFaces: [16],
          selectedNatural: 16,
          contributors: [],
          contributorChecksum: checksumRuleDocument([]),
          modifier: 0,
          total: 16,
          defenseOrDc: 10,
          resultPath: 'ON_HIT'
        }
      } as Parameters<typeof settleEncounterActionSettlementCore>[0]['execution']
    })

    expect(state.createActiveEffect).toHaveBeenCalledTimes(1)
    expect(state.createActiveEffect).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: {
          kind: 'ENCOUNTER_ACTOR',
          encounterId: ids.encounter,
          targetActorId: targetActor.id
        },
        definition: expect.objectContaining({
          authoredEffectId: source.activeEffectPlan.authoredEffectId,
          compiledEntryId: source.activeEffectPlan.compiledEntryId,
          recurrence: expect.objectContaining({ recurrenceStage: 'START_OF_TURN' }),
          stateContributions: expect.arrayContaining([
            expect.objectContaining({
              kind: 'ACTOR_RELATIONSHIP',
              relationshipOutcomeId: expect.any(String)
            })
          ])
        })
      })
    )
    const [actorBatch] = state.applyActor.mock.calls[0] ?? []
    expect(actorBatch.applications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'CONDITION_APPLY',
          sourceOperationKey: 'dnd5e.actor-relationship-state'
        })
      ])
    )
    expect(actorBatch.applications).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'DAMAGE' })])
    )
    if (!('activeEffectTransitions' in settled.application)) {
      throw new Error('Expected Rug active-effect receipt transitions.')
    }
    expect(settled.application.activeEffectTransitions).toEqual([
      expect.objectContaining({ recurrenceStage: 'START_OF_TURN' })
    ])
  })

  it('creates one target-owned state effect for a sealed maximum-hit-point reduction', async () => {
    const value = preparedFeature()
    value.action = {
      ...value.action,
      published: {
        id: '00000000-0000-4000-8000-000000000221',
        gameSystemId: value.targetActor.systemId,
        definitionFamilyKey: 'effect-action',
        checksum: 'a'.repeat(64),
        definition: {
          schemaVersion: 1,
          id: '00000000-0000-4000-8000-000000000221',
          gameSystemId: value.targetActor.systemId,
          definitionFamilyKey: 'effect-action',
          nodes: [
            {
              id: 'maximum-reduction',
              operation: {
                key: 'dnd5e.hit-point-maximum-reduction-proposal',
                contractVersion: 1
              },
              inputs: {}
            }
          ],
          outputs: { resultPath: { kind: 'LITERAL', value: 'ON_SAVE_FAIL' } }
        }
      }
    } as typeof value.action
    const reduction = {
      kind: 'HIT_POINT_MAXIMUM_REDUCTION' as const,
      targetActorId: ids.target,
      sourceNodeId: 'maximum-reduction',
      sourceOperationKey: 'dnd5e.hit-point-maximum-reduction-proposal',
      authoredPath: 'ON_SAVE_FAIL',
      resolvedPath: 'ON_SAVE_FAIL',
      sourceDamageNodeId: 'damage',
      sourceDamageOperationKey: 'dnd5e.damage-proposal',
      sourceDamageOutcomeId: '00000000-0000-4000-8000-000000000222',
      reductionAmount: 4,
      recoveryTags: ['RESTORE_HIT_POINT_MAXIMUM'] as const
    }
    state.applyActor.mockResolvedValue({
      updatedActor: {
        ...value.targetActor,
        currentHitPoints: 6,
        maxHitPoints: 6
      },
      receiptApplications: [
        {
          ordinal: 0,
          ...(() => {
            const { targetActorId: _targetActorId, ...receiptReduction } = reduction
            return receiptReduction
          })(),
          requestedAmount: 4,
          resolvedAmount: 4,
          appliedAmount: 4,
          beforeMaximumHitPoints: 10,
          afterMaximumHitPoints: 6,
          beforeCurrentHitPoints: 10,
          afterCurrentHitPoints: 6,
          beforeTemporaryHitPoints: 0,
          afterTemporaryHitPoints: 0,
          maximumHitPoints: 10
        }
      ],
      targetTransition: {
        ...transition,
        after: { ...transition.after, maximumHitPoints: 6 }
      },
      stateChanged: true
    })
    const complete = {
      ...execution(),
      applications: [reduction],
      execution: {
        ...execution().execution,
        evidence: {
          source: {
            definitionId: '00000000-0000-4000-8000-000000000221',
            gameSystemId: value.targetActor.systemId,
            definitionFamilyKey: 'effect-action',
            checksum: 'a'.repeat(64)
          },
          capabilityContractVersion: 1,
          facts: {},
          sourceEntryBindings: [
            {
              sourceEntryId: '00000000-0000-4000-8000-000000000223',
              nodeId: 'maximum-reduction'
            }
          ],
          trace: [],
          outputs: { resultPath: 'ON_HIT' }
        }
      }
    } as Parameters<typeof settleEncounterActionSettlementCore>[0]['execution']

    const settled = await settleEncounterActionSettlementCore({
      db: {} as never,
      actorUserId: ids.user,
      encounterId: ids.encounter,
      occurrenceId: ids.occurrence,
      commandId: '00000000-0000-4000-8000-000000000224',
      ordinal: 0,
      eventPhases: {
        resource: 'MOVEMENT_REACTION_RESOURCE',
        outcome: 'MOVEMENT_REACTION_OUTCOME'
      },
      prepared: value,
      execution: complete
    })

    expect(state.createActiveEffect).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: {
          kind: 'ENCOUNTER_ACTOR',
          encounterId: ids.encounter,
          targetActorId: ids.target
        },
        definition: expect.objectContaining({
          schemaVersion: 2,
          stateContributions: [expect.objectContaining({ amount: 4 })]
        })
      })
    )
    expect(settled.application).toMatchObject({
      stateEffectTransitions: [
        expect.objectContaining({
          activeEffectId: '00000000-0000-4000-8000-000000000225',
          contribution: expect.objectContaining({ amount: 4 })
        })
      ]
    })
  })

  it.each([
    { label: 'Character', kind: 'CHARACTER' as const },
    { label: 'Encounter actor', kind: 'CREATURE' as const }
  ])(
    'creates one target-owned scalar reduction effect with sealed provenance for $label',
    async ({ kind }) => {
      const targetActor = actor({
        id: ids.target,
        kind,
        ...(kind === 'CHARACTER' ? { sourceId: ids.character } : {})
      })
      const value = preparedFeature(targetActor)
      if (kind === 'CHARACTER') {
        value.targets = {
          ...value.targets,
          characterIds: [ids.character],
          lockedCharacters: new Map([
            [
              ids.character,
              {
                id: ids.character,
                systemId: targetActor.systemId!,
                streamVersion: 4,
                actor: targetActor,
                mechanics: {
                  commandState: { state: { spellSlots: [] } }
                } as unknown as LockedTargetCharacter['mechanics'],
                overlay: {} as LockedTargetCharacter['overlay'],
                maximumHitPoints: 10,
                conditionDefinitions: [],
                activeConditionDefinitionIds: [],
                baseScalarValues: {},
                effectiveScalarValues: {}
              }
            ]
          ])
        }
      }
      const scalarDefinitionId = '00000000-0000-4000-8000-000000000251'
      const scalar = {
        kind: 'SCALAR_REDUCTION' as const,
        targetActorId: ids.target,
        sourceNodeId: 'scalar-reduction',
        sourceOperationKey: 'dnd5e.scalar-reduction-proposal',
        authoredPath: 'ON_HIT',
        resolvedPath: 'ON_HIT',
        valueDefinitionId: scalarDefinitionId,
        reductionAmount: 4,
        stacking: 'ADDITIVE' as const,
        floor: 0 as const,
        recoveryTriggers: ['SHORT_REST', 'LONG_REST'] as const,
        terminalConsequence: 'TARGET_DIED' as const,
        sourceOutcomeId: '00000000-0000-4000-8000-000000000252'
      }
      value.action = {
        ...value.action,
        published: {
          id: '00000000-0000-4000-8000-000000000253',
          gameSystemId: value.targetActor.systemId,
          definitionFamilyKey: 'effect-action',
          checksum: 'a'.repeat(64),
          definition: {
            schemaVersion: 1,
            id: '00000000-0000-4000-8000-000000000253',
            gameSystemId: value.targetActor.systemId,
            definitionFamilyKey: 'effect-action',
            nodes: [
              {
                id: scalar.sourceNodeId,
                operation: { key: scalar.sourceOperationKey, contractVersion: 1 },
                inputs: {}
              }
            ],
            outputs: { resultPath: { kind: 'LITERAL', value: 'ON_HIT' } }
          }
        }
      } as typeof value.action
      const scalarReceipt = [
        (() => {
          const { targetActorId: _targetActorId, ...receipt } = scalar
          return { ordinal: 0, ...receipt, beforeValue: 3, afterValue: 0, targetDied: true }
        })()
      ]
      const scalarTransition = {
        ...transition,
        before: { ...transition.before, scalarValues: { [scalarDefinitionId]: 3 } },
        after: {
          ...transition.after,
          currentHitPoints: 0,
          scalarValues: { [scalarDefinitionId]: 0 }
        }
      }
      state.applyActor.mockResolvedValue({
        updatedActor: { ...value.targetActor, currentHitPoints: 0 },
        receiptApplications: scalarReceipt,
        targetTransition: scalarTransition,
        stateChanged: true
      })
      state.applyCharacter.mockImplementation(async (input) => {
        await input.afterPersist?.({ db: {} as never })
        return {
          updatedActor: targetActor,
          streamVersion: 5,
          receiptApplications: scalarReceipt,
          targetTransition: scalarTransition
        }
      })
      const complete = {
        ...execution(),
        applications: [scalar],
        execution: {
          ...execution().execution,
          evidence: {
            source: {
              definitionId: value.action.published.id,
              gameSystemId: value.targetActor.systemId,
              definitionFamilyKey: 'effect-action',
              checksum: 'a'.repeat(64)
            },
            capabilityContractVersion: 1,
            facts: {},
            sourceEntryBindings: [
              { sourceEntryId: '00000000-0000-4000-8000-000000000254', nodeId: scalar.sourceNodeId }
            ],
            trace: [],
            outputs: { resultPath: 'ON_HIT' }
          }
        }
      } as Parameters<typeof settleEncounterActionSettlementCore>[0]['execution']
      const settled = await settleEncounterActionSettlementCore({
        db: {} as never,
        actorUserId: ids.user,
        encounterId: ids.encounter,
        occurrenceId: ids.occurrence,
        commandId: '00000000-0000-4000-8000-000000000255',
        ordinal: 0,
        eventPhases: {
          resource: 'MOVEMENT_REACTION_RESOURCE',
          outcome: 'MOVEMENT_REACTION_OUTCOME'
        },
        prepared: value,
        execution: complete
      })
      expect(state.createActiveEffect).toHaveBeenCalledWith(
        expect.objectContaining({
          owner:
            kind === 'CHARACTER'
              ? { kind: 'CHARACTER', characterId: ids.character }
              : { kind: 'ENCOUNTER_ACTOR', encounterId: ids.encounter, targetActorId: ids.target },
          definition: expect.objectContaining({
            stateContributions: [
              expect.objectContaining({
                kind: 'SCALAR_REDUCTION',
                valueDefinitionId: scalarDefinitionId,
                amount: 4
              })
            ]
          })
        })
      )
      expect(settled.application).toMatchObject({
        stateEffectTransitions: [
          expect.objectContaining({
            contribution: expect.objectContaining({
              kind: 'SCALAR_REDUCTION',
              sourceOutcomeId: scalar.sourceOutcomeId
            })
          })
        ]
      })
    }
  )

  it('traces the canonical Clay Golem Slam through compilation, evidence, and settlement', async () => {
    const source = clayGolemSlamSource()
    const scenarios = [
      {
        label: 'failed save',
        attackNatural: 12,
        saveNatural: 1,
        reductionAmount: 7
      },
      {
        label: 'successful save',
        attackNatural: 12,
        saveNatural: 20,
        reductionAmount: null
      },
      {
        label: 'immune target',
        attackNatural: 12,
        saveNatural: 1,
        reductionAmount: null,
        defenses: [{ kind: 'IMMUNITY' as const, damageTypeId: source.damageTypeId }]
      },
      {
        label: 'critical failed save',
        attackNatural: 20,
        saveNatural: 1,
        reductionAmount: 9
      }
    ] as const

    for (const [index, scenario] of scenarios.entries()) {
      vi.clearAllMocks()
      state.createActiveEffect.mockImplementation(async (input) => ({
        id: '00000000-0000-4000-8000-000000000225',
        owner: input.owner,
        sourceEncounterId: input.owner.kind === 'CHARACTER' ? ids.encounter : null,
        maintainedEffectStateId: null,
        createdOrdinal: 1,
        version: 1,
        definition: input.definition,
        definitionChecksum: 'b'.repeat(64),
        lifecycle: input.lifecycle,
        lifecycleChecksum: 'c'.repeat(64),
        createdAt: '2026-08-31T00:00:00.000Z',
        updatedAt: '2026-08-31T00:00:00.000Z'
      }))
      const occurrenceId = `00000000-0000-4000-8000-${String(300 + index).padStart(12, '0')}`
      const executed = await executeClayGolemSlam({
        attackNatural: scenario.attackNatural,
        saveNatural: scenario.saveNatural,
        occurrenceId,
        ...('defenses' in scenario ? { defenses: scenario.defenses } : {})
      })
      const damage = executed.applications.find((application) => application.kind === 'DAMAGE')
      const reduction = executed.applications.find(
        (application) => application.kind === 'HIT_POINT_MAXIMUM_REDUCTION'
      )
      expect(damage, scenario.label).toBeDefined()
      expect(reduction?.reductionAmount ?? null, scenario.label).toBe(scenario.reductionAmount)
      expect(executed.selectedPath, scenario.label).toBe(
        scenario.attackNatural === 20 ? 'ON_CRIT' : 'ON_HIT'
      )
      if (reduction) {
        expect(reduction).toMatchObject({
          sourceDamageOutcomeId: source.damageOutcomeId,
          sourceNodeId: 'nested-save-hit-point-maximum-reduction',
          reductionAmount: damage?.resolvedAmount
        })
        expect(executed.outcomeExecution.evidence.sourceEntryBindings).toContainEqual({
          sourceEntryId: source.damageOutcomeId,
          nodeId: reduction.sourceDamageNodeId
        })
      }

      const folded = foldCharacterMechanicsApplications({
        targetActorId: ids.target,
        currentHitPoints: 10,
        temporaryHitPoints: 0,
        maximumHitPoints: 10,
        scalarValues: {},
        conditionIds: [],
        applications: executed.applications
      })
      state.applyActor.mockResolvedValue({
        updatedActor: {
          ...actor({ id: ids.target, kind: 'CREATURE' }),
          currentHitPoints: folded.after.currentHitPoints,
          tempHitPoints: folded.after.temporaryHitPoints,
          maxHitPoints: folded.after.maximumHitPoints
        },
        receiptApplications: folded.applications,
        targetTransition: {
          checksum: 'd'.repeat(64),
          before: folded.before,
          after: folded.after
        },
        stateChanged: folded.stateChanged
      })
      const value = preparedFeature()
      value.action = {
        ...value.action,
        published: executed.published
      } as typeof value.action
      const settled = await settleEncounterActionSettlementCore({
        db: {} as never,
        actorUserId: ids.user,
        encounterId: ids.encounter,
        occurrenceId,
        commandId: `00000000-0000-4000-8000-${String(400 + index).padStart(12, '0')}`,
        ordinal: index,
        eventPhases: {
          resource: 'MOVEMENT_REACTION_RESOURCE',
          outcome: 'MOVEMENT_REACTION_OUTCOME'
        },
        prepared: value,
        execution: {
          kind: 'COMPLETE',
          execution: {
            ...executed.outcomeExecution,
            movementInterruption: null
          },
          applications: executed.applications,
          d20: null
        }
      })

      if (!('stateEffectTransitions' in settled.application)) {
        throw new Error('Expected Clay state-effect receipt transitions.')
      }
      expect(state.createActiveEffect, scenario.label).toHaveBeenCalledTimes(
        scenario.reductionAmount === null ? 0 : 1
      )
      expect(settled.application.stateEffectTransitions, scenario.label).toHaveLength(
        scenario.reductionAmount === null ? 0 : 1
      )
      if (reduction) {
        expect(state.createActiveEffect, scenario.label).toHaveBeenCalledWith(
          expect.objectContaining({
            definition: expect.objectContaining({
              compiledEntryId: source.reductionOutcomeId,
              frozenGraphNodeId: 'nested-save-hit-point-maximum-reduction',
              stateContributions: [
                expect.objectContaining({
                  amount: scenario.reductionAmount,
                  sourceDamageOutcomeId: source.damageOutcomeId,
                  sourceDamageNodeId: reduction.sourceDamageNodeId
                })
              ]
            })
          })
        )
        expect(settled.application.stateEffectTransitions).toEqual([
          expect.objectContaining({
            compiledEntryId: source.reductionOutcomeId,
            frozenGraphNodeId: 'nested-save-hit-point-maximum-reduction',
            contribution: expect.objectContaining({
              amount: scenario.reductionAmount,
              sourceDamageOutcomeId: source.damageOutcomeId,
              sourceDamageNodeId: reduction.sourceDamageNodeId
            })
          })
        ])
      }
    }
  })

  it('rejects a movement interruption outside the movement settlement entry point', async () => {
    const value = execution()
    value.execution = {
      ...value.execution,
      movementInterruption: { kind: 'STOP' }
    }

    await expect(
      settleEncounterActionSettlementCore({
        db: {} as never,
        actorUserId: ids.user,
        encounterId: ids.encounter,
        occurrenceId: ids.occurrence,
        commandId: '00000000-0000-4000-8000-000000000220',
        ordinal: 0,
        eventPhases: {
          resource: 'MOVEMENT_REACTION_RESOURCE',
          outcome: 'MOVEMENT_REACTION_OUTCOME'
        },
        prepared: prepared(),
        execution: value
      })
    ).rejects.toThrow('Movement interruption is unavailable')

    expect(state.applyActor).not.toHaveBeenCalled()
    expect(state.updateActor).not.toHaveBeenCalled()
  })

  it('applies a non-Character target outcome and consumes one allowance', async () => {
    const value = await settleEncounterMovementReactionAction({
      db: {} as never,
      actorUserId: ids.user,
      encounterId: ids.encounter,
      occurrenceId: ids.occurrence,
      commandId: '00000000-0000-4000-8000-000000000210',
      ordinal: 0,
      prepared: prepared(),
      execution: execution()
    })

    expect(value.application).toMatchObject({
      kind: 'ENCOUNTER_ACTOR_MECHANICS_BATCH',
      targetActorId: ids.target,
      sourceCharacterStreamVersion: null,
      applications: [{ ordinal: 0, kind: 'DAMAGE' }]
    })
    expect(value.reactionExecution).toMatchObject({
      ordinal: 0,
      allowance: { beforeUsed: 0, afterUsed: 1 }
    })
    expect(state.applyCharacter).not.toHaveBeenCalled()
    expect(state.updateActor).toHaveBeenCalledWith(
      expect.objectContaining({
        id: ids.actor,
        resources: { ruleUsage: { [ids.allowance]: 1 } }
      })
    )
  })

  it('persists the authored action cost before applying the target and allowance', async () => {
    const resource = {
      poolId: 'pool',
      chargeId: 'charge',
      cost: 1,
      owner: {
        kind: 'AUTHORED_GRANT' as const,
        resourceGrantId: 'grant'
      },
      usageId: 'usage',
      beforeUsed: 0,
      afterUsed: 1,
      beforeRemaining: 2,
      afterRemaining: 1,
      nextBaseState: { facts: {}, output: {} },
      nextOverlayState: null
    } as PreparedEncounterMovementReactionSettlement['resourceConsumption']
    state.applyCharacter.mockImplementation(async (input) => {
      await input.afterPersist({ db: {}, streamVersion: 5 })
      return {
        updatedActor: {
          ...actor({
            id: ids.actor,
            kind: 'CHARACTER',
            sourceId: ids.character
          }),
          sourceRevision: 5
        },
        streamVersion: 5,
        finalState: transition.before,
        receiptApplications: [],
        targetTransition: {
          ...transition,
          after: transition.before
        },
        stateChanged: false
      }
    })

    const value = await settleEncounterMovementReactionAction({
      db: {} as never,
      actorUserId: ids.user,
      encounterId: ids.encounter,
      occurrenceId: ids.occurrence,
      commandId: '00000000-0000-4000-8000-000000000211',
      ordinal: 0,
      prepared: prepared(resource),
      execution: execution()
    })

    expect(value.application).toMatchObject({
      kind: 'ENCOUNTER_ACTOR_MECHANICS_BATCH',
      sourceCharacterStreamVersion: 5,
      resourceConsumption: {
        beforeUsed: 0,
        afterUsed: 1,
        beforeRemaining: 2,
        afterRemaining: 1
      }
    })
    expect(state.persistResource).toHaveBeenCalledTimes(1)
    expect(state.applyCharacter).toHaveBeenCalledBefore(state.applyActor)
    expect(state.applyActor).toHaveBeenCalledBefore(state.updateActor)
    expect(state.applyCharacter).toHaveBeenCalledWith(
      expect.objectContaining({
        commandId: '00000000-0000-4000-8000-000000000211:MOVEMENT_REACTION_RESOURCE:0',
        sourceCommandId: '00000000-0000-4000-8000-000000000211'
      })
    )
  })

  it('prepares an immutable Feature through the shared System adapter with locked actor facts', async () => {
    const sourceActor = actor({ id: ids.actor, kind: 'CREATURE' })
    const targetActor = actor({ id: ids.target, kind: 'CREATURE' })
    const actionSource = featureActionSource()
    ;(
      actionSource as {
        capability: { mechanicFacts: { invocation: { triggerCode: string } } }
      }
    ).capability.mechanicFacts.invocation.triggerCode = 'RANGED_WEAPON_ATTACK'
    const value = await prepareEncounterMovementReactionSettlement({
      db: {} as never,
      actorUserId: ids.user,
      automationMode: 'AUTOMATIC',
      encounter: { actors: [sourceActor, targetActor] } as never,
      option: {
        candidate: { movingActorId: ids.target },
        binding: { movementInterruption: null },
        policy: { allowanceDefinitionId: ids.allowance, allowanceMaximum: 1 }
      } as never,
      actionSource,
      targets: {
        characterIds: [],
        encounterActorIds: [ids.actor, ids.target],
        lockedCharacters: new Map(),
        encounterActors: new Map([
          [ids.actor, sourceActor],
          [ids.target, targetActor]
        ]),
        activeEffectsByActorId: new Map([
          [ids.actor, []],
          [ids.target, []]
        ]),
        encounterActorRules: {
          actors: [
            {
              actorId: ids.actor,
              initiativeModifier: 2,
              targetProtection: {
                status: 'NORMALIZED',
                defenses: [],
                conditionImmunityIds: []
              },
              featureResources: []
            },
            {
              actorId: ids.target,
              initiativeModifier: 0,
              targetProtection: {
                status: 'NORMALIZED',
                defenses: [],
                conditionImmunityIds: []
              },
              featureResources: []
            }
          ]
        }
      }
    })

    expect(state.assertCurrentFeature).toHaveBeenCalledWith({
      actor: sourceActor,
      capability: (actionSource as Extract<typeof actionSource, { kind: 'ENCOUNTER_FEATURE' }>)
        .capability
    })
    expect(state.compileFeature).toHaveBeenCalledWith({
      action: expect.objectContaining({
        kind: 'ENCOUNTER_FEATURE',
        encounterActorId: ids.actor
      })
    })
    expect(value.action.sourceDerivedFacts).toMatchObject({
      actorId: ids.actor,
      initiativeModifier: 2
    })
    expect(value.action.actionMechanic).toMatchObject({
      attackBonus: 4,
      attackRollMode: 'NORMAL',
      attackKind: 'RANGED'
    })
    expect(value.resourceConsumption).toBeNull()
  })

  it('rejects an immutable Feature action before outcomes when its exact charge has no remaining use', async () => {
    const sourceActor = {
      ...actor({ id: ids.actor, kind: 'CREATURE' }),
      resources: { featureCharges: { [ids.feature]: 1 } }
    }
    const targetActor = actor({ id: ids.target, kind: 'CREATURE' })
    const actionSource = featureActionSource()
    ;(
      actionSource as { capability: { featureResourceUse: unknown } }
    ).capability.featureResourceUse = {
      chargeId: ids.featureCharge,
      cost: 1
    }

    await expect(
      prepareEncounterMovementReactionSettlement({
        db: {} as never,
        actorUserId: ids.user,
        automationMode: 'AUTOMATIC',
        encounter: { actors: [sourceActor, targetActor] } as never,
        option: {
          candidate: { movingActorId: ids.target },
          policy: { allowanceDefinitionId: ids.allowance, allowanceMaximum: 1 }
        } as never,
        actionSource,
        targets: {
          characterIds: [],
          encounterActorIds: [ids.actor, ids.target],
          lockedCharacters: new Map(),
          encounterActors: new Map([
            [ids.actor, sourceActor],
            [ids.target, targetActor]
          ]),
          activeEffectsByActorId: new Map([
            [ids.actor, []],
            [ids.target, []]
          ]),
          encounterActorRules: {
            actors: [
              {
                actorId: ids.actor,
                initiativeModifier: 2,
                targetProtection: {
                  status: 'NORMALIZED',
                  defenses: [],
                  conditionImmunityIds: []
                },
                featureResources: [
                  {
                    featureId: ids.feature,
                    maximum: 1,
                    reconciliationPolicy: 'CLAMP_USED_TO_MAXIMUM',
                    rawUsed: 1,
                    used: 1,
                    remaining: 0,
                    resetKind: 'DAILY'
                  }
                ]
              },
              {
                actorId: ids.target,
                initiativeModifier: 0,
                targetProtection: {
                  status: 'NORMALIZED',
                  defenses: [],
                  conditionImmunityIds: []
                },
                featureResources: []
              }
            ]
          }
        }
      })
    ).rejects.toThrow('resource is unavailable')
    expect(state.applyActor).not.toHaveBeenCalled()
  })

  it('rejects a stale immutable Feature binding before resource or outcome mutation', async () => {
    state.assertCurrentFeature.mockImplementation(() => {
      throw new Error('binding changed')
    })
    const sourceActor = actor({ id: ids.actor, kind: 'CREATURE' })
    const targetActor = actor({ id: ids.target, kind: 'CREATURE' })

    await expect(
      prepareEncounterMovementReactionSettlement({
        db: {} as never,
        actorUserId: ids.user,
        automationMode: 'AUTOMATIC',
        encounter: { actors: [sourceActor, targetActor] } as never,
        option: {
          candidate: { movingActorId: ids.target },
          policy: { allowanceDefinitionId: ids.allowance, allowanceMaximum: 1 }
        } as never,
        actionSource: featureActionSource(),
        targets: {
          characterIds: [],
          encounterActorIds: [ids.actor, ids.target],
          lockedCharacters: new Map(),
          encounterActors: new Map([
            [ids.actor, sourceActor],
            [ids.target, targetActor]
          ]),
          activeEffectsByActorId: new Map([
            [ids.actor, []],
            [ids.target, []]
          ]),
          encounterActorRules: {
            actors: [
              {
                actorId: ids.actor,
                initiativeModifier: 2,
                targetProtection: {
                  status: 'NORMALIZED',
                  defenses: [],
                  conditionImmunityIds: []
                },
                featureResources: []
              },
              {
                actorId: ids.target,
                initiativeModifier: 0,
                targetProtection: {
                  status: 'NORMALIZED',
                  defenses: [],
                  conditionImmunityIds: []
                },
                featureResources: []
              }
            ]
          }
        }
      })
    ).rejects.toThrow('binding changed')
    expect(state.applyActor).not.toHaveBeenCalled()
  })

  it('settles an immutable Feature against a non-Character target without Character resource mutation', async () => {
    const value = await settleEncounterMovementReactionAction({
      db: {} as never,
      actorUserId: ids.user,
      encounterId: ids.encounter,
      occurrenceId: ids.occurrence,
      commandId: '00000000-0000-4000-8000-000000000213',
      ordinal: 0,
      prepared: preparedFeature(),
      execution: execution()
    })

    expect(value.application).toMatchObject({
      kind: 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
    })
    expect(state.applyCharacter).not.toHaveBeenCalled()
    expect(state.persistResource).not.toHaveBeenCalled()
    expect(state.updateActor).toHaveBeenCalledWith(
      expect.objectContaining({
        id: ids.actor,
        resources: { ruleUsage: { [ids.allowance]: 1 } }
      })
    )
  })

  it('advances an immutable Feature charge exactly once after the target outcome settles', async () => {
    const value = preparedFeature()
    value.featureResourceConsumption = featureResourceConsumption()
    value.sourceActor = {
      ...value.sourceActor,
      resources: { featureCharges: { [ids.feature]: 0 } }
    }
    state.applyActor.mockResolvedValue({
      updatedActor: { ...value.targetActor, currentHitPoints: 6 },
      receiptApplications: [receiptApplication],
      targetTransition: transition,
      stateChanged: true
    })

    const settled = await settleEncounterActionSettlementCore({
      db: {} as never,
      actorUserId: ids.user,
      encounterId: ids.encounter,
      occurrenceId: ids.occurrence,
      commandId: '00000000-0000-4000-8000-000000000217',
      ordinal: 0,
      eventPhases: {
        resource: 'MOVEMENT_REACTION_RESOURCE',
        outcome: 'MOVEMENT_REACTION_OUTCOME'
      },
      prepared: value,
      execution: execution()
    })

    expect(state.updateActor).toHaveBeenCalledWith(
      expect.objectContaining({
        id: ids.actor,
        resources: { featureCharges: { [ids.feature]: 1 } }
      })
    )
    expect(settled.application).toMatchObject({
      featureResourceConsumption: {
        ownerActorId: ids.actor,
        ownerFeatureId: ids.feature,
        chargeId: ids.featureCharge,
        beforeUsed: 0,
        afterUsed: 1
      }
    })
  })

  it('keeps both a self-targeted Feature outcome and its charge mutation', async () => {
    const sourceActor = actor({ id: ids.actor, kind: 'CREATURE' })
    const value = preparedFeature(sourceActor)
    value.featureResourceConsumption = featureResourceConsumption()
    value.sourceActor = {
      ...sourceActor,
      resources: { featureCharges: { [ids.feature]: 0 } }
    }
    value.targetActor = value.sourceActor
    state.applyActor.mockResolvedValue({
      updatedActor: { ...value.sourceActor, currentHitPoints: 6 },
      receiptApplications: [receiptApplication],
      targetTransition: transition,
      stateChanged: true
    })

    const settled = await settleEncounterActionSettlementCore({
      db: {} as never,
      actorUserId: ids.user,
      encounterId: ids.encounter,
      occurrenceId: ids.occurrence,
      commandId: '00000000-0000-4000-8000-000000000218',
      ordinal: 0,
      eventPhases: {
        resource: 'MOVEMENT_REACTION_RESOURCE',
        outcome: 'MOVEMENT_REACTION_OUTCOME'
      },
      prepared: value,
      execution: execution()
    })

    expect(state.applyActor).toHaveBeenCalledWith(
      expect.objectContaining({
        targetActor: expect.objectContaining({ id: ids.actor })
      })
    )
    expect(state.updateActor).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: ids.actor,
        currentHitPoints: 6,
        resources: { featureCharges: { [ids.feature]: 1 } }
      })
    )
    expect(settled.application).toMatchObject({
      featureResourceConsumption: {
        ownerActorId: ids.actor,
        ownerFeatureId: ids.feature,
        afterRemaining: 1
      }
    })
  })

  it('keeps a self-targeted Feature outcome when consuming its action allowance', async () => {
    const sourceActor = actor({ id: ids.actor, kind: 'CREATURE' })
    const value = preparedFeature(sourceActor)
    value.sourceActor = sourceActor
    value.targetActor = sourceActor
    value.actionEconomyConsumption = {
      definitionId: ids.allowance,
      definitionVersion: 1,
      definitionChecksum: 'f'.repeat(64),
      maximum: 1,
      beforeUsed: 0,
      afterUsed: 1
    }
    state.applyActor.mockResolvedValue({
      updatedActor: { ...sourceActor, currentHitPoints: 6 },
      receiptApplications: [receiptApplication],
      targetTransition: transition,
      stateChanged: true
    })

    const settled = await settleEncounterActionSettlementCore({
      db: {} as never,
      actorUserId: ids.user,
      encounterId: ids.encounter,
      occurrenceId: ids.occurrence,
      commandId: '00000000-0000-4000-8000-000000000229',
      ordinal: 0,
      eventPhases: {
        resource: 'MOVEMENT_REACTION_RESOURCE',
        outcome: 'MOVEMENT_REACTION_OUTCOME'
      },
      prepared: value,
      execution: execution()
    })

    expect(state.updateActor).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: ids.actor,
        currentHitPoints: 6,
        resources: { ruleUsage: { [ids.allowance]: 1 } }
      })
    )
    expect(settled.sourceActor).toMatchObject({
      currentHitPoints: 6,
      resources: { ruleUsage: { [ids.allowance]: 1 } }
    })
    expect(settled.targetActor).toEqual(settled.sourceActor)
  })

  it('settles both source arms in the generic core without consuming a reaction allowance', async () => {
    for (const value of [prepared(), preparedFeature()]) {
      vi.clearAllMocks()
      state.updateActor.mockResolvedValue(undefined)
      state.applyActor.mockResolvedValue({
        updatedActor: {
          ...actor({ id: ids.target, kind: 'CREATURE' }),
          currentHitPoints: 6
        },
        receiptApplications: [receiptApplication],
        targetTransition: transition,
        stateChanged: true
      })
      const settled = await settleEncounterActionSettlementCore({
        db: {} as never,
        actorUserId: ids.user,
        encounterId: ids.encounter,
        occurrenceId: ids.occurrence,
        commandId: '00000000-0000-4000-8000-000000000215',
        ordinal: 0,
        eventPhases: {
          resource: 'MOVEMENT_REACTION_RESOURCE',
          outcome: 'MOVEMENT_REACTION_OUTCOME'
        },
        prepared: value,
        execution: execution()
      })
      expect(settled.application).toMatchObject({
        kind: 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
      })
      expect(settled.sourceActor.id).toBe(ids.actor)
      expect(state.updateActor).not.toHaveBeenCalled()
    }
  })

  it('settles an immutable Feature against a locked Character target without a source Character', async () => {
    const targetActor = actor({
      id: ids.target,
      kind: 'CHARACTER',
      sourceId: ids.character
    })
    const value = preparedFeature(targetActor)
    const targetCharacter = {
      id: ids.character,
      systemId: targetActor.systemId!,
      streamVersion: 4,
      actor: targetActor,
      mechanics: {
        commandState: { state: { spellSlots: [] } }
      } as unknown as LockedTargetCharacter['mechanics'],
      overlay: {} as LockedTargetCharacter['overlay'],
      maximumHitPoints: 10,
      conditionDefinitions: [],
      activeConditionDefinitionIds: []
    }
    value.targets = {
      ...value.targets,
      characterIds: [ids.character],
      lockedCharacters: new Map([[ids.character, targetCharacter]])
    }
    state.applyCharacter.mockResolvedValue({
      updatedActor: { ...targetActor, currentHitPoints: 6 },
      streamVersion: 5,
      receiptApplications: [receiptApplication],
      targetTransition: transition
    })

    const settled = await settleEncounterMovementReactionAction({
      db: {} as never,
      actorUserId: ids.user,
      encounterId: ids.encounter,
      occurrenceId: ids.occurrence,
      commandId: '00000000-0000-4000-8000-000000000214',
      ordinal: 0,
      prepared: value,
      execution: execution()
    })

    expect(settled.application).toMatchObject({
      kind: 'CHARACTER_MECHANICS_BATCH',
      sourceCharacterStreamVersion: null,
      targetCharacterStreamVersion: 5
    })
    expect(state.applyCharacter).toHaveBeenCalledWith(
      expect.objectContaining({ targetCharacterId: ids.character })
    )
    expect(state.persistResource).not.toHaveBeenCalled()
    expect(state.updateActor).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: ids.actor,
        resources: { ruleUsage: { [ids.allowance]: 1 } }
      })
    )
  })
})
