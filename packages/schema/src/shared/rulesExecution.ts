import { z } from 'zod'

import {
  canonicalD20ContributorKey,
  checksumRuleDocument,
  compareCanonicalD20Contributors,
  RULE_GRAPH_LIMITS
} from '@artificer-toolkit/shared/rules'

import {
  ruleFactContractDtoSchema,
  ruleGraphDefinitionDtoSchema,
  ruleGraphNodeDefinitionDtoSchema,
  ruleGraphSourceEntryBindingDtoSchema,
  ruleInputBindingDtoSchema,
  ruleOperationReferenceDtoSchema,
  ruleValueDtoSchema
} from '../api/rulesRuntime.js'
import { postgresUuidSchema } from './postgresUuid.js'
import { actorRelationshipModuleDtoSchema } from '../effects/actorRelationship.js'
import {
  stagedInitiativeRoundStateDtoSchema,
  type PausedInitiativeRoundStateDto as CanonicalStagedInitiativeRoundStateDto
} from './initiativeState.js'
import { AUTHORED_LIMITS, authoredIdentifierSchema } from './authoredLimits.js'
import {
  encounterRuleOccurrenceSummaryDtoSchema,
  initiativeDeclarationAdjudicationFieldDtoSchema
} from './encounterRuleOccurrence.js'
import {
  movementReactionChoiceOptionDtoSchema,
  movementReactionChoiceSelectionDtoSchema,
  movementReactionTimelineDtoSchema
} from './reaction.js'
import { combatPerceptionContributionsDtoSchema } from './combatPerception.js'
import { pathLifecycleConsumeEventSchema, pathLifecycleEndEventSchema } from '../shared/enums.js'
import {
  MAX_SPATIAL_CANDIDATES,
  MAX_SPATIAL_PATH_POINTS,
  spatialMovementCandidateDtoSchema,
  spatialMovementKindDtoSchema,
  spatialPointDtoSchema
} from './spatialFacts.js'
import { rangeDtoSchema, type RangeDto } from './range.js'

/** Server-owned UUID identity. PostgreSQL UUID equality is case-insensitive, so command seams
 * canonicalize spelling before fingerprints, receipt lookup, or persistence. */
export const serverUuidIdentityDtoSchema = postgresUuidSchema.transform((value) =>
  value.toLowerCase()
)
const uuidSchema = serverUuidIdentityDtoSchema
const checksumSchema = z.string().regex(/^[a-f0-9]{64}$/)
const contractVersionSchema = z.number().int().positive().max(10_000)
const capabilityKeySchema = z.string().regex(/^[a-z][a-z0-9.-]{0,79}$/)

const concentrationContributorDtoSchema = z.strictObject({
  sourceId: z.string().trim().min(1).max(240),
  grantId: z.string().trim().min(1).max(240).nullable(),
  domainKey: z.string().trim().min(1).max(240).nullable(),
  influence: z.enum(['ADVANTAGE', 'DISADVANTAGE'])
})

const canonicalConcentrationContributorsDtoSchema = z
  .array(concentrationContributorDtoSchema)
  .max(RULE_GRAPH_LIMITS.NODES)
  .superRefine((contributors, context) => {
    let prior: z.infer<typeof concentrationContributorDtoSchema> | null = null
    for (const [index, contributor] of contributors.entries()) {
      if (prior !== null && compareCanonicalD20Contributors(prior, contributor) >= 0)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index],
          message: 'Concentration contributors must be unique and in canonical order.'
        })
      prior = contributor
    }
  })
const localNodeIdSchema = z.string().regex(/^[a-z][a-z0-9_-]{0,79}$/)
const portNameSchema = z.string().regex(/^[a-z][a-zA-Z0-9_]{0,79}$/)

/** Hard aggregate-local bound for persisted active effects. */
export const MAX_ACTIVE_RULE_EFFECTS_PER_OWNER = 64
/** Hard Encounter-local bound for maintained state owned by one source actor. */
export const MAX_MAINTAINED_RULE_EFFECT_STATES_PER_ACTOR = 64
/** Hard Encounter-local total of maintained dependents for one source actor. */
export const MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR = 64
/** Actor removal can also empty one foreign state per direct actor-owned effect. */
export const MAX_MAINTENANCE_CLEANUP_TERMINATED_STATES =
  MAX_MAINTAINED_RULE_EFFECT_STATES_PER_ACTOR + MAX_ACTIVE_RULE_EFFECTS_PER_OWNER
/** Actor removal deletes maintained dependents plus direct actor-owned effects. */
export const MAX_MAINTENANCE_CLEANUP_REMOVED_EFFECTS =
  MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR + MAX_ACTIVE_RULE_EFFECTS_PER_OWNER
/** Each maintained dependent may belong to a distinct Character aggregate. */
export const MAX_MAINTENANCE_CLEANUP_CHARACTER_TRANSITIONS =
  MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR
/** A turn can touch at most an END and START boundary. */
export const MAX_ENCOUNTER_TURN_ACTIVE_EFFECT_EXECUTIONS = MAX_ACTIVE_RULE_EFFECTS_PER_OWNER * 2
/** A persisted Recharge plan is bounded by the authored Feature collection limit. */
export const MAX_ENCOUNTER_TURN_RECHARGE_CANDIDATES = AUTHORED_LIMITS.nestedCollectionItems

/** Server-only current published source returned by an authorized repository seam. */
export const serverPublishedRuleDefinitionDtoSchema = z.strictObject({
  id: uuidSchema,
  gameSystemId: uuidSchema,
  definitionFamilyKey: capabilityKeySchema,
  checksum: checksumSchema,
  definition: ruleGraphDefinitionDtoSchema
})

const activeEffectFactsSchema = z
  .record(capabilityKeySchema, ruleValueDtoSchema)
  .refine(
    (facts) => Object.keys(facts).length <= RULE_GRAPH_LIMITS.RUNTIME_FACTS,
    `Active effects support at most ${RULE_GRAPH_LIMITS.RUNTIME_FACTS} adapter facts.`
  )

const activeEffectOriginDtoSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('CHARACTER'),
    sourceAggregateId: uuidSchema,
    sourceOccurrenceId: uuidSchema,
    rootCommandId: uuidSchema
  }),
  z.strictObject({
    kind: z.literal('ENCOUNTER'),
    sourceAggregateId: uuidSchema,
    sourceOccurrenceId: uuidSchema,
    rootCommandId: uuidSchema,
    sourceActorId: uuidSchema.nullable()
  })
])

/** Server-only runtime invocation after domain authorization and capability discovery. */
export const serverRuleExecutionInputDtoSchema = z.strictObject({
  definitionId: uuidSchema,
  occurrenceId: uuidSchema,
  facts: z
    .record(capabilityKeySchema, ruleValueDtoSchema)
    .refine((facts) => Object.keys(facts).length <= RULE_GRAPH_LIMITS.RUNTIME_FACTS, {
      message: `Rule execution supports at most ${RULE_GRAPH_LIMITS.RUNTIME_FACTS} runtime facts.`
    })
})

export const ruleGraphSourceIdentityDtoSchema = z.strictObject({
  definitionId: uuidSchema,
  gameSystemId: uuidSchema,
  definitionFamilyKey: capabilityKeySchema,
  checksum: checksumSchema
})

export const serverRuleExecutionTraceEntryDtoSchema = z.strictObject({
  nodeId: localNodeIdSchema,
  operation: ruleOperationReferenceDtoSchema,
  inputs: z.record(portNameSchema, ruleValueDtoSchema),
  outputs: z.record(portNameSchema, ruleValueDtoSchema),
  evidence: z
    .strictObject({
      requestId: z.string().min(1).max(256),
      kind: z.literal('INTEGER_RANGE'),
      value: z.number().int()
    })
    .optional()
})

const sourceEntryBindingsDtoSchema = z
  .array(ruleGraphSourceEntryBindingDtoSchema)
  .max(RULE_GRAPH_LIMITS.NODES)
  .refine(
    (bindings) =>
      new Set(bindings.map((binding) => binding.sourceEntryId)).size === bindings.length &&
      new Set(bindings.map((binding) => binding.nodeId)).size === bindings.length,
    'Rule source-entry bindings must form a one-to-one source-entry to node relation.'
  )

const vocabularyBindingsDtoSchema = z
  .array(z.strictObject({ kind: z.literal('ABILITY'), definitionId: uuidSchema }))
  .max(RULE_GRAPH_LIMITS.NODES)
  .refine(
    (bindings) =>
      new Set(bindings.map((binding) => `${binding.kind}:${binding.definitionId}`)).size ===
      bindings.length,
    'Rule vocabulary bindings must be unique.'
  )

export const compiledRuleGraphDtoSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    source: ruleGraphSourceIdentityDtoSchema,
    capabilityContractVersion: contractVersionSchema,
    factContracts: z.array(ruleFactContractDtoSchema).max(RULE_GRAPH_LIMITS.FACT_CONTRACTS),
    nodes: z.array(ruleGraphNodeDefinitionDtoSchema).min(1).max(RULE_GRAPH_LIMITS.NODES),
    outputs: z.record(portNameSchema, ruleInputBindingDtoSchema).refine((outputs) => {
      const count = Object.keys(outputs).length
      return count >= 1 && count <= RULE_GRAPH_LIMITS.OUTPUTS
    }, `Compiled rule graphs require between one and ${RULE_GRAPH_LIMITS.OUTPUTS} outputs.`),
    sourceEntryBindings: sourceEntryBindingsDtoSchema.optional(),
    vocabularyBindings: vocabularyBindingsDtoSchema.optional()
  })
  .superRefine((graph, context) => {
    if (
      graph.sourceEntryBindings?.some(
        (binding) => !graph.nodes.some((node) => node.id === binding.nodeId)
      )
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sourceEntryBindings'],
        message: 'Compiled rule source-entry bindings must reference an existing graph node.'
      })
  })

const activeEffectEndEventsSchema = z
  .array(pathLifecycleEndEventSchema)
  .max(16)
  .superRefine((events, context) => {
    if (new Set(events).size !== events.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Active-effect end events must be unique.'
      })
    }
    if (events.some((event, index) => index > 0 && events[index - 1]! > event)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Active-effect end events must be sorted.'
      })
    }
  })

/** Immutable provenance, compiled plan, and recurrence configuration for one active effect. */
const activeRuleEffectDefinitionBaseDtoSchema = z.strictObject({
  origin: activeEffectOriginDtoSchema,
  authoredEffectId: uuidSchema,
  compiledEntryId: uuidSchema,
  frozenGraphNodeId: localNodeIdSchema,
  frozenGraph: compiledRuleGraphDtoSchema,
  adapterFacts: activeEffectFactsSchema,
  perceptionContributions: combatPerceptionContributionsDtoSchema,
  recurrence: z.strictObject({
    recurrenceStage: z.enum(['NONE', 'START_OF_TURN', 'END_OF_TURN']),
    consumeOnFirstEvent: pathLifecycleConsumeEventSchema.nullable(),
    endOnEvents: activeEffectEndEventsSchema,
    lifetimeScope: z.enum(['OWNER', 'ENCOUNTER']),
    expiration: z.discriminatedUnion('kind', [
      z.strictObject({ kind: z.literal('INDEFINITE') }),
      z.strictObject({
        kind: z.literal('TICKS'),
        initialRemaining: z.number().int().min(1).max(10_000),
        decrementStage: z.enum(['START_OF_TURN', 'END_OF_TURN'])
      })
    ])
  })
})

const activeRuleEffectStateContributionDtoSchema = z.strictObject({
  kind: z.literal('HIT_POINT_MAXIMUM_REDUCTION'),
  amount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  sourceDamageOutcomeId: uuidSchema,
  sourceDamageNodeId: z.string().trim().min(1).max(240),
  sourceDamageOperationKey: z.string().trim().min(1).max(240),
  recoveryTags: z.tuple([z.literal('RESTORE_HIT_POINT_MAXIMUM')])
})
const activeRuleEffectScalarReductionContributionDtoSchema = z.strictObject({
  kind: z.literal('SCALAR_REDUCTION'),
  valueDefinitionId: uuidSchema,
  amount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  stacking: z.literal('ADDITIVE'),
  floor: z.literal(0),
  recoveryTriggers: z
    .array(z.enum(['SHORT_REST', 'LONG_REST']))
    .min(1)
    .max(2),
  terminalConsequence: z.literal('TARGET_DIED'),
  sourceOutcomeId: uuidSchema,
  sourceNodeId: z.string().trim().min(1).max(240),
  sourceOperationKey: z.string().trim().min(1).max(240)
})
const activeRuleEffectConditionContributionDtoSchema = z.strictObject({
  kind: z.literal('CONDITION_OWNERSHIP'),
  conditionId: uuidSchema,
  baselinePresent: z.boolean()
})
const activeRuleEffectActorRelationshipContributionDtoSchema = z.strictObject({
  kind: z.literal('ACTOR_RELATIONSHIP'),
  relationshipOutcomeId: uuidSchema,
  modules: z.array(actorRelationshipModuleDtoSchema).min(1).max(RULE_GRAPH_LIMITS.NODES),
  conditionIds: z.array(uuidSchema).max(32),
  capabilitySuppressions: z
    .array(
      z.strictObject({
        contributionId: uuidSchema,
        capabilityDefinitionIds: z.array(uuidSchema).min(1).max(32)
      })
    )
    .max(32)
})

/**
 * Version one is retained byte-faithfully for existing rows and receipts.
 * Version two adds a bounded, immutable aggregate-state contribution list.
 */
export const activeRuleEffectDefinitionDtoSchema = z
  .discriminatedUnion('schemaVersion', [
    activeRuleEffectDefinitionBaseDtoSchema.extend({
      schemaVersion: z.literal(1)
    }),
    activeRuleEffectDefinitionBaseDtoSchema.extend({
      schemaVersion: z.literal(2),
      stateContributions: z
        .array(
          z.discriminatedUnion('kind', [
            activeRuleEffectStateContributionDtoSchema,
            activeRuleEffectScalarReductionContributionDtoSchema,
            activeRuleEffectConditionContributionDtoSchema,
            activeRuleEffectActorRelationshipContributionDtoSchema
          ])
        )
        .min(1)
        .max(RULE_GRAPH_LIMITS.NODES)
    })
  ])
  .superRefine((definition, context) => {
    const sourceDefinitionId = definition.frozenGraph.source.definitionId
    if (definition.authoredEffectId !== sourceDefinitionId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['frozenGraph', 'source', 'definitionId'],
        message: 'Active-effect authored identity must match the frozen graph source.'
      })
    }
    if (
      definition.frozenGraph.sourceEntryBindings?.filter(
        (binding) =>
          binding.sourceEntryId === definition.compiledEntryId &&
          binding.nodeId === definition.frozenGraphNodeId
      ).length !== 1
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['frozenGraphNodeId'],
        message: 'Active-effect compiled entry must bind exactly one frozen graph node.'
      })
    }
    if (
      definition.recurrence.lifetimeScope === 'ENCOUNTER' &&
      definition.origin.kind !== 'ENCOUNTER'
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['recurrence', 'lifetimeScope'],
        message: 'Encounter-lifetime effects require an Encounter origin.'
      })
    }
    for (const [index, contribution] of definition.perceptionContributions.entries()) {
      if (
        contribution.kind === 'SENSE_GRANT' &&
        contribution.document.gameSystemId !== definition.frozenGraph.source.gameSystemId
      )
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['perceptionContributions', index, 'document', 'gameSystemId'],
          message: 'Active-effect sense grants must belong to the frozen graph Game System.'
        })
    }
  })

/** Mutable current lifecycle state. It never repeats immutable recurrence configuration. */
export const activeRuleEffectLifecycleDtoSchema = z.strictObject({
  schemaVersion: z.literal(1),
  remainingTicks: z.number().int().min(1).max(10_000).nullable()
})

/**
 * Immutable System-owned maintenance identity. The application layer only
 * persists and replaces this descriptor; it never interprets its meaning.
 */
const encounterMaintainedEffectDescriptorBaseDtoSchema = z.strictObject({
  maintenanceDefinitionId: uuidSchema,
  definitionChecksum: checksumSchema,
  sourceActionId: uuidSchema,
  sourceOccurrenceId: uuidSchema,
  sourceActorId: uuidSchema,
  replacementPolicy: z.literal('REPLACE_SAME_DEFINITION')
})

/** Version one retains its original implicit terminal-empty cleanup behavior. */
export const encounterMaintainedEffectDescriptorDtoSchema = z.discriminatedUnion('schemaVersion', [
  encounterMaintainedEffectDescriptorBaseDtoSchema.extend({
    schemaVersion: z.literal(1)
  }),
  encounterMaintainedEffectDescriptorBaseDtoSchema.extend({
    schemaVersion: z.literal(2),
    emptyDependentPolicy: z.enum(['TERMINATE_WHEN_EMPTY', 'RETAIN_UNTIL_TERMINAL'])
  })
])

export type EncounterMaintainedEffectDescriptorDto = z.infer<
  typeof encounterMaintainedEffectDescriptorDtoSchema
>

/** Strict persisted active-effect state reconstructed from immutable definition plus mutable lifecycle. */
export const activeRuleEffectStateDtoSchema = z
  .strictObject({
    definition: activeRuleEffectDefinitionDtoSchema,
    lifecycle: activeRuleEffectLifecycleDtoSchema
  })
  .superRefine((state, context) => {
    const configuredExpiration = state.definition.recurrence.expiration
    const remainingTicks = state.lifecycle.remainingTicks
    if (
      (configuredExpiration.kind === 'INDEFINITE' && remainingTicks !== null) ||
      (configuredExpiration.kind === 'TICKS' && remainingTicks === null)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['lifecycle', 'remainingTicks'],
        message: 'Active-effect lifecycle ticks must match its immutable definition.'
      })
    }
    if (
      configuredExpiration.kind === 'TICKS' &&
      remainingTicks !== null &&
      remainingTicks > configuredExpiration.initialRemaining
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['lifecycle', 'remainingTicks'],
        message: 'Active-effect remaining ticks may not exceed its initial definition.'
      })
    }
  })

export type ActiveRuleEffectDefinitionDto = z.infer<typeof activeRuleEffectDefinitionDtoSchema>
export type ActiveRuleEffectLifecycleDto = z.infer<typeof activeRuleEffectLifecycleDtoSchema>
export type ActiveRuleEffectStateDto = z.infer<typeof activeRuleEffectStateDtoSchema>

export const serverRuleIntegerRangeRequestDtoSchema = z
  .strictObject({
    requestId: z.string().min(1).max(256),
    kind: z.literal('INTEGER_RANGE'),
    nodeId: localNodeIdSchema,
    ordinal: z
      .number()
      .int()
      .min(0)
      .max(RULE_GRAPH_LIMITS.NODES - 1),
    min: z.number().int(),
    max: z.number().int()
  })
  .refine((request) => request.min <= request.max, 'Integer-range request bounds must be ordered.')

const initiativeDeclarationOptionDtoSchema = z.strictObject({
  kind: z.enum([
    'CHARACTER_ACTION',
    'CHARACTER_SPELL_CAST',
    'CREATURE_FEATURE_ACTION',
    'GM_ADJUDICATED'
  ]),
  optionId: z.string().trim().min(1).max(1_000),
  label: z.string().trim().min(1).max(500),
  selectionContract: checksumSchema
})

export const serverInitiativeDeclarationRequestDtoSchema = z
  .strictObject({
    requestId: z.string().min(1).max(256),
    kind: z.literal('INITIATIVE_DECLARATION'),
    encounterId: uuidSchema,
    round: z.number().int().positive(),
    actorId: uuidSchema,
    participantExpectedVersion: z.number().int().min(0),
    primaryOptions: z
      .array(initiativeDeclarationOptionDtoSchema)
      .min(1)
      .max(RULE_GRAPH_LIMITS.NODES),
    bonusOptions: z.array(initiativeDeclarationOptionDtoSchema).max(RULE_GRAPH_LIMITS.NODES),
    adjudicationFields: z.array(initiativeDeclarationAdjudicationFieldDtoSchema).max(3),
    controllerUserId: uuidSchema.nullable(),
    sourceOptionsChecksum: checksumSchema
  })
  .superRefine((value, context) => {
    for (const [key, options] of [
      ['primaryOptions', value.primaryOptions],
      ['bonusOptions', value.bonusOptions]
    ] as const) {
      if (
        options.some(
          (option, index) => index > 0 && options[index - 1]!.optionId >= option.optionId
        )
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: 'Declaration options must be sorted and unique.'
        })
      }
    }
  })

export const serverRuleExecutionRequestDtoSchema = z.discriminatedUnion('kind', [
  serverRuleIntegerRangeRequestDtoSchema,
  serverInitiativeDeclarationRequestDtoSchema
])
export type ServerInitiativeDeclarationRequestDto = z.infer<
  typeof serverInitiativeDeclarationRequestDtoSchema
>

export const serverRuleExecutionContinuationDtoSchema = z.strictObject({
  schemaVersion: z.literal(1),
  occurrenceId: uuidSchema,
  graph: compiledRuleGraphDtoSchema,
  facts: z
    .record(capabilityKeySchema, ruleValueDtoSchema)
    .refine((facts) => Object.keys(facts).length <= RULE_GRAPH_LIMITS.RUNTIME_FACTS, {
      message: `Rule continuations support at most ${RULE_GRAPH_LIMITS.RUNTIME_FACTS} runtime facts.`
    }),
  nextNodeIndex: z
    .number()
    .int()
    .min(0)
    .max(RULE_GRAPH_LIMITS.NODES - 1),
  nodeOutputs: z.record(localNodeIdSchema, z.record(portNameSchema, ruleValueDtoSchema)),
  trace: z.array(serverRuleExecutionTraceEntryDtoSchema).max(RULE_GRAPH_LIMITS.NODES),
  // Kernel continuations carry only kernel evidence requests. Aggregate
  // declaration intent is sealed by the aggregate-choice snapshot below.
  request: serverRuleIntegerRangeRequestDtoSchema,
  authority: z.literal('APPLICATION_SERVICE'),
  redaction: z.literal('SERVER_ONLY'),
  seal: checksumSchema
})

/**
 * Server-only domain context retained beside (never inside) the sealed kernel
 * continuation. The kernel remains portable; an owning aggregate service uses
 * this context to re-lock and revalidate its authoritative application seam
 * before a paused execution can complete.
 */
const turnEffectPendingCandidateDtoSchema = z.strictObject({
  ordinal: z
    .number()
    .int()
    .min(0)
    .max(MAX_ENCOUNTER_TURN_ACTIVE_EFFECT_EXECUTIONS - 1),
  boundaryOrdinal: z.number().int().min(0).max(1),
  stage: z.enum(['START_OF_TURN', 'END_OF_TURN']),
  targetActorId: uuidSchema,
  owner: z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('CHARACTER'),
      characterId: uuidSchema,
      streamVersion: z.number().int().min(0),
      projectionChecksum: checksumSchema,
      mechanicalContextChecksum: checksumSchema
    }),
    z.strictObject({ kind: z.literal('ENCOUNTER_ACTOR') })
  ]),
  activeEffectId: uuidSchema,
  createdOrdinal: z.number().int().positive(),
  effectVersion: z.number().int().positive(),
  definitionChecksum: checksumSchema,
  lifecycleChecksum: checksumSchema,
  targetStateChecksum: checksumSchema,
  d20Policy: z.lazy(() => serverRuleExecutionD20PolicyDtoSchema).nullable()
})

export type TurnResolutionCommandDto =
  | {
      kind:
        | 'ENTER_DICE'
        | 'SYSTEM_ROLL'
        | 'LEGENDARY_ENTER_DICE'
        | 'LEGENDARY_SYSTEM_ROLL'
        | 'ENTER_INTEGER'
        | 'INITIATIVE_SYSTEM_ROLL'
        | 'INITIATIVE_ENTITY'
        | 'INITIATIVE_DECLARATION'
      commandId: string
      commandFingerprint: string
      actorUserId: string
      correlationId: string | null
      expectedOccurrenceVersion: number
      requestId: string
      /** Present only for a persisted initiative declaration replay authority check. */
      initiativeActorId?: string | null
    }
  | {
      kind: 'LEGENDARY_DECLINE'
      commandId: string
      commandFingerprint: string
      actorUserId: string
      correlationId: string | null
      expectedOccurrenceVersion: number
      selectionChecksum: string
    }
  | {
      kind: 'LEGENDARY_OPTION'
      commandId: string
      commandFingerprint: string
      actorUserId: string
      correlationId: string | null
      expectedOccurrenceVersion: number
      selectionChecksum: string
      optionId: string
    }

type CompletedTurnRechargePlanDto = z.infer<typeof completedTurnRechargePlanDtoSchema>
type TurnLegendaryActionEvidenceDto = z.infer<typeof turnLegendaryActionEvidenceDtoSchema>

type TurnLegendaryActionRefreshDto = {
  ordinal: number
  actorId: string
  actorCurrentnessChecksum: string
  ownerFeatureId: string
  chargeId: string
  lifecycleDefinitionId: string
  lifecycleDefinitionVersion: number
  lifecycleDefinitionChecksum: string
  beforeUsed: number
  afterUsed: number
}

type TurnActionEconomyRefreshDto = {
  ordinal: number
  actorId: string
  capabilityDefinitionId: string
  definitionVersion: number
  definitionChecksum: string
  beforeUsed: number
  afterUsed: 0
}

const turnLegendaryActionRefreshDtoSchema: z.ZodType<TurnLegendaryActionRefreshDto> =
  z.strictObject({
    ordinal: z
      .number()
      .int()
      .min(0)
      .max(RULE_GRAPH_LIMITS.NODES - 1),
    actorId: uuidSchema,
    actorCurrentnessChecksum: checksumSchema,
    ownerFeatureId: uuidSchema,
    chargeId: uuidSchema,
    lifecycleDefinitionId: uuidSchema,
    lifecycleDefinitionVersion: z.number().int().positive(),
    lifecycleDefinitionChecksum: checksumSchema,
    beforeUsed: z.number().int().positive(),
    afterUsed: z.literal(0)
  })

const turnActionEconomyRefreshDtoSchema: z.ZodType<TurnActionEconomyRefreshDto> = z.strictObject({
  ordinal: z
    .number()
    .int()
    .min(0)
    .max(RULE_GRAPH_LIMITS.NODES - 1),
  actorId: uuidSchema,
  capabilityDefinitionId: uuidSchema,
  definitionVersion: z.number().int().positive(),
  definitionChecksum: checksumSchema,
  beforeUsed: z.number().int().positive(),
  afterUsed: z.literal(0)
})

interface TurnLegendaryActionQueueDto {
  /** Frozen ordered owners; one decision opportunity is issued per owner at most. */
  ownerActorIds: string[]
  /** The owner whose window is presently pending. */
  nextOwnerIndex: number
}

export interface TurnCoordinatorRootDto {
  rootCommandId: string
  commandFingerprint: string
  commandType: 'START' | 'ADVANCE_TURN'
  initiatorUserId: string
  correlationId: string | null
  expectedEncounterVersion: number
  startSystemId: string | null
  frozenActorRuleRevisionId: string | null
  frozenActorRuleRevisionChecksum: string | null
  frozenActorRuleSnapshotChecksum: string | null
  initiative: EncounterInitiativeSettlementDto | null
  initiativeAdvance: EncounterInitiativeAdvancePlanDto | null
  stagedInitiative?: {
    beforePin: InitiativeBeforePinDto
    stagedRoundState: StagedInitiativeRoundStateDto
  }
  outgoingTurn?: PendingCompletedTurnPhaseDto
  /** Sealed ordered owner queue retained only while the turn occurrence is pending. */
  legendaryActionQueue?: TurnLegendaryActionQueueDto
  /** Completed owner decisions retained through later turn pauses and terminal receipt creation. */
  completedLegendaryActions?: TurnLegendaryActionEvidenceDto[]
  /** Owner-start pool recoveries staged with the occurrence and persisted only at terminal commit. */
  stagedLegendaryActionRefreshes?: TurnLegendaryActionRefreshDto[]
  /** System-owned aggregate usage refreshes staged at the authoritative turn boundary. */
  stagedActionEconomyRefreshes?: TurnActionEconomyRefreshDto[]
  completedRechargePlan?: CompletedTurnRechargePlanDto | null
  proposedTerminalTransition: {
    status: 'ACTIVE' | 'COMPLETED'
    round: number
    currentActorId: string | null
  }
  resolutionCommands: TurnResolutionCommandDto[]
}

const turnResolutionCommandDtoSchema: z.ZodType<TurnResolutionCommandDto> = z.discriminatedUnion(
  'kind',
  [
    z.strictObject({
      kind: z.enum([
        'ENTER_DICE',
        'SYSTEM_ROLL',
        'LEGENDARY_ENTER_DICE',
        'LEGENDARY_SYSTEM_ROLL',
        'ENTER_INTEGER',
        'INITIATIVE_SYSTEM_ROLL',
        'INITIATIVE_ENTITY',
        'INITIATIVE_DECLARATION'
      ]),
      commandId: uuidSchema,
      commandFingerprint: checksumSchema,
      actorUserId: uuidSchema,
      correlationId: uuidSchema.nullable(),
      expectedOccurrenceVersion: z.number().int().min(0),
      requestId: z.string().min(1).max(256),
      initiativeActorId: uuidSchema.nullable().default(null)
    }),
    z.strictObject({
      kind: z.literal('LEGENDARY_DECLINE'),
      commandId: uuidSchema,
      commandFingerprint: checksumSchema,
      actorUserId: uuidSchema,
      correlationId: uuidSchema.nullable(),
      expectedOccurrenceVersion: z.number().int().min(0),
      selectionChecksum: checksumSchema
    }),
    z.strictObject({
      kind: z.literal('LEGENDARY_OPTION'),
      commandId: uuidSchema,
      commandFingerprint: checksumSchema,
      actorUserId: uuidSchema,
      correlationId: uuidSchema.nullable(),
      expectedOccurrenceVersion: z.number().int().min(0),
      selectionChecksum: checksumSchema,
      optionId: checksumSchema
    })
  ]
)

const turnCoordinatorRootDtoSchema: z.ZodType<TurnCoordinatorRootDto> = z.strictObject({
  rootCommandId: uuidSchema,
  commandFingerprint: checksumSchema,
  commandType: z.enum(['START', 'ADVANCE_TURN']),
  initiatorUserId: uuidSchema,
  correlationId: uuidSchema.nullable(),
  expectedEncounterVersion: z.number().int().min(0),
  /** Exact original START payload identity; never rules authority. */
  startSystemId: uuidSchema.nullable().default(null),
  /** Server-only transient adapter source, not an Encounter pin. */
  frozenActorRuleRevisionId: uuidSchema.nullable().default(null),
  frozenActorRuleRevisionChecksum: checksumSchema.nullable().default(null),
  frozenActorRuleSnapshotChecksum: checksumSchema.nullable().default(null),
  initiative: z
    .lazy(() => encounterInitiativeSettlementDtoSchema)
    .nullable()
    .default(null),
  initiativeAdvance: z
    .lazy(() => encounterInitiativeAdvancePlanDtoSchema)
    .nullable()
    .default(null),
  /** Pending initiative remains occurrence-owned until this turn terminally commits. */
  stagedInitiative: z
    .lazy(() =>
      z.strictObject({
        beforePin: initiativeBeforePinDtoSchema,
        stagedRoundState: stagedInitiativeRoundStateDtoSchema
      })
    )
    .optional(),
  outgoingTurn: z.lazy(() => pendingCompletedTurnPhaseDtoSchema).optional(),
  /** A pending Legendary Action owner queue remains turn-owned through later pauses. */
  legendaryActionQueue: z
    .strictObject({
      ownerActorIds: z.array(uuidSchema).min(1).max(RULE_GRAPH_LIMITS.NODES),
      nextOwnerIndex: z
        .number()
        .int()
        .min(0)
        .max(RULE_GRAPH_LIMITS.NODES - 1)
    })
    .superRefine((queue, context) => {
      if (
        queue.nextOwnerIndex >= queue.ownerActorIds.length ||
        new Set(queue.ownerActorIds).size !== queue.ownerActorIds.length ||
        queue.ownerActorIds.some(
          (ownerId, index) => index > 0 && queue.ownerActorIds[index - 1]! >= ownerId
        )
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'Legendary Action owner queues must be unique, ordered, and point at one pending owner.'
        })
      }
    })
    .optional(),
  /** Settled Legendary Action windows remain turn-owned through later Recharge/effect pauses. */
  completedLegendaryActions: z
    .array(z.lazy(() => turnLegendaryActionEvidenceDtoSchema))
    .max(RULE_GRAPH_LIMITS.NODES)
    .optional(),
  stagedLegendaryActionRefreshes: z
    .array(turnLegendaryActionRefreshDtoSchema)
    .max(RULE_GRAPH_LIMITS.NODES)
    .superRefine((entries, context) => {
      const identities = new Set<string>()
      for (const [index, entry] of entries.entries()) {
        const identity = `${entry.actorId}:${entry.ownerFeatureId}:${entry.chargeId}`
        if (entry.ordinal !== index || identities.has(identity)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [index],
            message: 'Legendary Action refreshes must be uniquely and deterministically ordered.'
          })
        }
        identities.add(identity)
      }
    })
    .optional(),
  stagedActionEconomyRefreshes: z
    .array(turnActionEconomyRefreshDtoSchema)
    .max(RULE_GRAPH_LIMITS.NODES)
    .superRefine((entries, context) => {
      const identities = new Set<string>()
      for (const [index, entry] of entries.entries()) {
        const identity = `${entry.actorId}:${entry.capabilityDefinitionId}`
        if (entry.ordinal !== index || identities.has(identity)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [index],
            message: 'Action-economy refreshes must be uniquely and deterministically ordered.'
          })
        }
        identities.add(identity)
      }
    })
    .optional(),
  /** Recharge outcomes are staged with the turn and applied only at terminal commit. */
  completedRechargePlan: z
    .lazy(() => completedTurnRechargePlanDtoSchema)
    .nullable()
    .optional(),
  proposedTerminalTransition: z.strictObject({
    status: z.enum(['ACTIVE', 'COMPLETED']),
    round: z.number().int().min(1),
    currentActorId: uuidSchema.nullable()
  }),
  resolutionCommands: z
    .array(turnResolutionCommandDtoSchema)
    .max(MAX_ENCOUNTER_TURN_ACTIVE_EFFECT_EXECUTIONS + RULE_GRAPH_LIMITS.NODES * 20)
    .default([])
})

const turnEffectPendingContextDtoSchema = z
  .strictObject({
    kind: z.literal('ENCOUNTER_TURN_ACTIVE_EFFECTS'),
    schemaVersion: z.literal(1),
    root: turnCoordinatorRootDtoSchema,
    selectionChecksum: checksumSchema,
    currentCandidate: turnEffectPendingCandidateDtoSchema,
    completedExecutions: z
      .array(z.lazy(() => turnEffectExecutionDtoSchema))
      .max(MAX_ENCOUNTER_TURN_ACTIVE_EFFECT_EXECUTIONS),
    remainingCandidates: z
      .array(turnEffectPendingCandidateDtoSchema)
      .max(MAX_ENCOUNTER_TURN_ACTIVE_EFFECT_EXECUTIONS)
  })

  .superRefine((value, context) => {
    const frozenSource = [
      value.root.frozenActorRuleRevisionId,
      value.root.frozenActorRuleRevisionChecksum,
      value.root.frozenActorRuleSnapshotChecksum
    ]
    if (
      frozenSource.some((entry) => entry === null) &&
      frozenSource.some((entry) => entry !== null)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['root'],
        message:
          'A paused turn-effect batch must retain either the complete frozen actor-rule source identity or none of it.'
      })
    }
    const completed = value.completedExecutions
    const current = value.currentCandidate.ordinal
    const remaining = value.remainingCandidates
    const effectIds = new Set<string>()
    const ordinals = new Set<number>()
    for (const [index, execution] of completed.entries()) {
      if (execution.ordinal !== index || execution.ordinal >= current) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['completedExecutions', index],
          message:
            'Completed turn executions must be the canonical prefix before the current candidate.'
        })
      }
      if (effectIds.has(execution.activeEffectId) || ordinals.has(execution.ordinal)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['completedExecutions', index],
          message: 'Turn candidates must have unique effect identities and ordinals.'
        })
      }
      effectIds.add(execution.activeEffectId)
      ordinals.add(execution.ordinal)
    }
    if (
      current !== completed.length ||
      effectIds.has(value.currentCandidate.activeEffectId) ||
      ordinals.has(current)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['currentCandidate'],
        message:
          'Current turn candidate must immediately follow the completed prefix with a unique identity.'
      })
    }
    effectIds.add(value.currentCandidate.activeEffectId)
    ordinals.add(current)
    for (const [index, candidate] of remaining.entries()) {
      if (
        candidate.ordinal !== current + index + 1 ||
        effectIds.has(candidate.activeEffectId) ||
        ordinals.has(candidate.ordinal)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['remainingCandidates', index],
          message:
            'Remaining turn candidates must be the canonical unique suffix after the current candidate.'
        })
      }
      effectIds.add(candidate.activeEffectId)
      ordinals.add(candidate.ordinal)
    }
  })

const turnRechargeCandidateDtoSchema = z.strictObject({
  ordinal: z
    .number()
    .int()
    .min(0)
    .max(MAX_ENCOUNTER_TURN_RECHARGE_CANDIDATES - 1),
  actorId: uuidSchema,
  featureId: uuidSchema,
  featureVersionChecksum: checksumSchema,
  beforeUsed: z.number().int().min(1),
  maximum: z.number().int().positive(),
  policy: z.strictObject({
    gameSystemId: uuidSchema,
    definitionId: uuidSchema,
    definitionVersion: z.number().int().positive(),
    definitionChecksum: checksumSchema,
    graphDefinitionId: uuidSchema,
    graphDefinitionVersion: z.number().int().positive(),
    graphDefinitionChecksum: checksumSchema,
    rechargedOutput: z.string().trim().min(1).max(128)
  })
})

const turnRechargeExecutionDtoSchema = z.strictObject({
  ordinal: z
    .number()
    .int()
    .min(0)
    .max(MAX_ENCOUNTER_TURN_RECHARGE_CANDIDATES - 1),
  candidate: turnRechargeCandidateDtoSchema,
  execution: z.lazy(() => serverCompletedRuleExecutionDtoSchema),
  recharged: z.boolean(),
  beforeUsed: z.number().int().min(1),
  afterUsed: z.number().int().min(0),
  rawDie: z.number().int().min(1).max(6)
})

const completedTurnRechargePlanDtoSchema = z
  .strictObject({
    selectionChecksum: checksumSchema,
    executions: z
      .array(turnRechargeExecutionDtoSchema)
      .min(1)
      .max(MAX_ENCOUNTER_TURN_RECHARGE_CANDIDATES)
  })
  .superRefine((value, context) => {
    const identities = new Set<string>()
    for (const [index, execution] of value.executions.entries()) {
      const candidate = execution.candidate
      const identity = `${candidate.actorId}:${candidate.featureId}`
      if (
        execution.ordinal !== index ||
        candidate.ordinal !== index ||
        identities.has(identity) ||
        execution.beforeUsed !== candidate.beforeUsed ||
        execution.afterUsed > execution.beforeUsed ||
        execution.afterUsed !== (execution.recharged ? 0 : execution.beforeUsed)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['executions', index],
          message:
            'Completed Recharge plans must retain canonical complete Feature execution evidence.'
        })
      }
      identities.add(identity)
    }
  })

const turnRechargePendingContextDtoSchema = z
  .strictObject({
    kind: z.literal('ENCOUNTER_TURN_RECHARGE'),
    schemaVersion: z.literal(1),
    phase: z.literal('START_OF_TURN'),
    root: turnCoordinatorRootDtoSchema,
    selectionChecksum: checksumSchema,
    completedExecutions: z
      .array(turnRechargeExecutionDtoSchema)
      .max(MAX_ENCOUNTER_TURN_RECHARGE_CANDIDATES),
    currentCandidate: turnRechargeCandidateDtoSchema,
    remainingCandidates: z
      .array(turnRechargeCandidateDtoSchema)
      .max(MAX_ENCOUNTER_TURN_RECHARGE_CANDIDATES)
  })
  .superRefine((value, context) => {
    const expectedActorId = value.root.proposedTerminalTransition.currentActorId
    const completed = value.completedExecutions
    const current = value.currentCandidate
    const remaining = value.remainingCandidates
    const identities = new Set<string>()
    const validateCandidate = (
      candidate: z.infer<typeof turnRechargeCandidateDtoSchema>,
      ordinal: number,
      path: (string | number)[]
    ) => {
      if (candidate.ordinal !== ordinal) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...path, 'ordinal'],
          message: 'Recharge candidates must retain contiguous canonical ordinals.'
        })
      }
      if (expectedActorId === null || candidate.actorId !== expectedActorId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...path, 'actorId'],
          message: 'Recharge candidates must belong to the entering current actor.'
        })
      }
      const identity = `${candidate.actorId}:${candidate.featureId}`
      if (identities.has(identity)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path,
          message: 'Recharge candidates must have unique actor and Feature identities.'
        })
      }
      identities.add(identity)
    }
    for (const [index, execution] of completed.entries()) {
      validateCandidate(execution.candidate, index, ['completedExecutions', index, 'candidate'])
      if (
        execution.ordinal !== index ||
        execution.candidate.ordinal !== execution.ordinal ||
        execution.beforeUsed !== execution.candidate.beforeUsed ||
        execution.afterUsed > execution.beforeUsed ||
        execution.afterUsed !== (execution.recharged ? 0 : execution.beforeUsed)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['completedExecutions', index],
          message:
            'Completed Recharge executions must retain exact candidate and recovery evidence.'
        })
      }
    }
    validateCandidate(current, completed.length, ['currentCandidate'])
    for (const [index, candidate] of remaining.entries())
      validateCandidate(candidate, completed.length + index + 1, ['remainingCandidates', index])
  })

const legendaryActionChoiceOptionDtoSchema = z
  .strictObject({
    optionId: checksumSchema,
    ownerActorId: uuidSchema,
    ownerFeatureId: uuidSchema,
    actionId: z.string().trim().min(1).max(240),
    targetActorId: uuidSchema,
    actionSourceChecksum: checksumSchema,
    chargeId: uuidSchema,
    featureCost: z.number().int().positive(),
    poolBefore: z.number().int().nonnegative(),
    poolRemaining: z.number().int().nonnegative(),
    lifecycle: z.strictObject({
      definitionId: uuidSchema,
      definitionVersion: z.number().int().positive(),
      definitionChecksum: checksumSchema,
      eligibilityGraphDefinitionId: uuidSchema,
      eligibilityGraphDefinitionVersion: z.number().int().positive(),
      eligibilityGraphDefinitionChecksum: checksumSchema,
      eligibleOutput: z.string().trim().min(1).max(128)
    }),
    eligibilityEvidenceChecksum: checksumSchema
  })
  .superRefine((option, refinement) => {
    if (
      option.featureCost > option.poolBefore ||
      option.poolRemaining !== option.poolBefore - option.featureCost
    ) {
      refinement.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['poolRemaining'],
        message: 'Legendary Action choice resource evidence must retain exact cost arithmetic.'
      })
    }
  })

const legendaryActionChoiceGroupDtoSchema = z
  .strictObject({
    ownerActorId: uuidSchema,
    options: z
      .array(legendaryActionChoiceOptionDtoSchema)
      .min(1)
      .max(RULE_GRAPH_LIMITS.NODES - 1)
  })
  .superRefine((group, refinement) => {
    const optionIds = new Set<string>()
    let prior = ''
    for (const [index, option] of group.options.entries()) {
      const identity = `${option.ownerFeatureId}:${option.actionId}`
      if (
        option.ownerActorId !== group.ownerActorId ||
        option.targetActorId !== group.ownerActorId ||
        optionIds.has(option.optionId) ||
        (index > 0 && identity <= prior)
      ) {
        refinement.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['options', index],
          message: 'Legendary Action choices must retain one canonical SELF-targeted owner group.'
        })
      }
      optionIds.add(option.optionId)
      prior = identity
    }
  })

const legendaryActionChoicePendingContextDtoSchema = z
  .strictObject({
    kind: z.literal('ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE'),
    schemaVersion: z.literal(1),
    root: turnCoordinatorRootDtoSchema,
    selectionChecksum: checksumSchema,
    choice: legendaryActionChoiceGroupDtoSchema
  })
  .superRefine((value, refinement) => {
    if (checksumRuleDocument(value.choice) !== value.selectionChecksum) {
      refinement.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['selectionChecksum'],
        message: 'Legendary Action selection checksum must bind the exact frozen choice group.'
      })
    }
    if (value.root.commandType !== 'ADVANCE_TURN' || !value.root.outgoingTurn) {
      refinement.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['root'],
        message: 'A Legendary Action choice must retain the completed outgoing ADVANCE_TURN phase.'
      })
    }
  })

/**
 * Server-only evidence boundary after the GM has selected one Legendary
 * Action.  The Kernel continuation remains the only executable payload; this
 * context retains just the exact turn and selected-source pins needed to
 * revalidate it on resume.
 */
const legendaryActionEvidencePendingContextDtoSchema = z
  .strictObject({
    kind: z.literal('ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE'),
    schemaVersion: z.literal(1),
    root: turnCoordinatorRootDtoSchema,
    choiceSelectionChecksum: checksumSchema,
    choice: legendaryActionChoiceGroupDtoSchema,
    selectionChecksum: checksumSchema,
    selectedOption: legendaryActionChoiceOptionDtoSchema,
    d20Policy: z.lazy(() => serverRuleExecutionD20PolicyDtoSchema)
  })
  .superRefine((value, refinement) => {
    if (checksumRuleDocument(value.choice) !== value.choiceSelectionChecksum) {
      refinement.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['choiceSelectionChecksum'],
        message: 'Legendary Action evidence must retain its exact issued choice group.'
      })
    }
    if (checksumRuleDocument(value.selectedOption) !== value.selectionChecksum) {
      refinement.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['selectionChecksum'],
        message: 'Legendary Action evidence must bind its exact selected option.'
      })
    }
    if (value.root.commandType !== 'ADVANCE_TURN' || !value.root.outgoingTurn) {
      refinement.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['root'],
        message: 'Legendary Action evidence must retain the completed outgoing ADVANCE_TURN phase.'
      })
    }
    if (
      value.choice.options.find((option) => option.optionId === value.selectedOption.optionId) ===
      undefined
    ) {
      refinement.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['selectedOption'],
        message: 'Legendary Action evidence must select one exact issued option.'
      })
    }
  })

const legendaryActionCharacterTransitionDtoSchema = z
  .strictObject({
    characterId: uuidSchema,
    beforeStreamVersion: z.number().int().min(0),
    afterStreamVersion: z.number().int().min(0)
  })
  .refine((value) => value.afterStreamVersion === value.beforeStreamVersion + 1, {
    message: 'Legendary Action Character transitions must advance exactly once.'
  })

const turnLegendaryActionEvidenceDtoSchema = z
  .strictObject({
    choice: legendaryActionChoiceGroupDtoSchema,
    selectionChecksum: checksumSchema,
    resolution: z.discriminatedUnion('kind', [
      z.strictObject({ kind: z.literal('DECLINED') }),
      z.strictObject({
        kind: z.literal('EXECUTED'),
        selectedOptionId: checksumSchema,
        execution: z.lazy(() => serverCompletedRuleExecutionDtoSchema),
        application: z.lazy(() => serverRuleExecutionApplicationOutputsDtoSchema),
        characterTransitions: z.array(legendaryActionCharacterTransitionDtoSchema).max(2)
      })
    ])
  })
  .superRefine((value, context) => {
    if (checksumRuleDocument(value.choice) !== value.selectionChecksum) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['selectionChecksum'],
        message: 'Legendary Action terminal evidence must bind its exact issued choice.'
      })
    }
    const resolution = value.resolution
    if (!('selectedOptionId' in resolution)) return
    const option = value.choice.options.find(
      (candidate) => candidate.optionId === resolution.selectedOptionId
    )
    if (!option) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['resolution', 'selectedOptionId'],
        message: 'Legendary Action terminal evidence must select one issued option.'
      })
      return
    }
    if (resolution.kind !== 'EXECUTED') return
    const application = resolution.application
    if (
      application.kind !== 'CHARACTER_MECHANICS_BATCH' &&
      application.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['resolution', 'application'],
        message: 'Legendary Action execution must retain one mechanics application batch.'
      })
      return
    }
    if (
      resolution.execution.evidence.source.checksum !== option.actionSourceChecksum ||
      application.sourceActorId !== option.ownerActorId ||
      application.targetActorId !== option.targetActorId
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['resolution'],
        message:
          'Legendary Action execution evidence must match its exact selected source and target.'
      })
    }
    const feature = application.featureResourceConsumption
    if (
      !feature ||
      feature.ownerActorId !== option.ownerActorId ||
      feature.ownerFeatureId !== option.ownerFeatureId ||
      feature.chargeId !== option.chargeId ||
      feature.cost !== option.featureCost ||
      feature.beforeRemaining !== option.poolBefore ||
      feature.afterRemaining !== option.poolRemaining ||
      feature.afterUsed !== feature.beforeUsed + feature.cost
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['resolution', 'application', 'featureResourceConsumption'],
        message: 'Legendary Action Feature resource evidence must match the selected option.'
      })
    }
    let previous = ''
    for (const [index, transition] of resolution.characterTransitions.entries()) {
      if (transition.characterId <= previous) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['resolution', 'characterTransitions', index],
          message: 'Legendary Action Character transitions must be unique and canonical.'
        })
      }
      previous = transition.characterId
    }
  })

const spatialTargetCurrentnessPinDtoSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('CHARACTER'),
    characterId: uuidSchema,
    streamVersion: z.number().int().min(0),
    projectionChecksum: checksumSchema,
    mechanicalContextChecksum: checksumSchema,
    targetStateChecksum: checksumSchema
  }),
  z.strictObject({
    kind: z.literal('ENCOUNTER_ACTOR'),
    targetStateChecksum: checksumSchema
  })
])

const spatialAggregateVersionSchema = z.number().int().min(0)

const spatialEffectCurrentnessPinDtoSchema = z.strictObject({
  effectId: uuidSchema,
  version: z.number().int().positive(),
  definitionChecksum: checksumSchema,
  lifecycleChecksum: checksumSchema,
  placementChecksum: checksumSchema,
  spatialStateChecksum: checksumSchema,
  authoredEffectId: uuidSchema,
  compiledEntryId: uuidSchema,
  frozenGraphNodeId: localNodeIdSchema,
  frozenSourceChecksum: checksumSchema,
  capabilityContractVersion: contractVersionSchema,
  activation: z.enum(['ONE_SHOT', 'REPEATABLE']),
  revealed: z.boolean(),
  revealOnTrigger: z.boolean()
})

const spatialPendingCandidateDtoSchema = z
  .strictObject({
    ordinal: z
      .number()
      .int()
      .min(0)
      .max(MAX_SPATIAL_CANDIDATES - 1),
    candidate: spatialMovementCandidateDtoSchema,
    effect: spatialEffectCurrentnessPinDtoSchema,
    target: spatialTargetCurrentnessPinDtoSchema,
    d20Policy: z.lazy(() => serverRuleExecutionD20PolicyDtoSchema).nullable()
  })
  .superRefine((value, context) => {
    if (value.candidate.effectId !== value.effect.effectId)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['effect', 'effectId'],
        message: 'Spatial candidate and effect currentness identity must agree.'
      })
  })

const pendingD20FaceSchema = z.number().int().min(1).max(20)

const movementPassageContestParticipantReceiptDtoSchema = z
  .strictObject({
    rollMode: z.enum(['ADVANTAGE', 'DISADVANTAGE', 'NORMAL']),
    rawFaces: z.array(pendingD20FaceSchema).min(1).max(2),
    selectedNatural: pendingD20FaceSchema,
    modifier: z.number().int(),
    total: z.number().int()
  })
  .superRefine((value, context) => {
    const expectedFaces = value.rollMode === 'NORMAL' ? 1 : 2
    const expectedNatural =
      value.rollMode === 'ADVANTAGE'
        ? Math.max(...value.rawFaces)
        : value.rollMode === 'DISADVANTAGE'
          ? Math.min(...value.rawFaces)
          : value.rawFaces[0]
    if (
      value.rawFaces.length !== expectedFaces ||
      value.selectedNatural !== expectedNatural ||
      value.total !== value.selectedNatural + value.modifier
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Movement passage contest evidence must match its sealed d20 policy.'
      })
    }
  })

const movementPassageContestReceiptDtoSchema = z
  .strictObject({
    actionKind: z.enum(['OVERRUN', 'TUMBLE']),
    optionId: checksumSchema,
    outcome: z.enum(['SUCCESS', 'TIE_OR_FAILURE']),
    initiator: movementPassageContestParticipantReceiptDtoSchema,
    defender: movementPassageContestParticipantReceiptDtoSchema,
    actionEconomy: z.strictObject({
      definitionId: uuidSchema,
      definitionVersion: z.number().int().positive(),
      definitionChecksum: checksumSchema,
      maximum: z.number().int().positive(),
      beforeUsed: z.number().int().nonnegative(),
      afterUsed: z.number().int().positive()
    }),
    audit: z.strictObject({
      optionalCombat: z.strictObject({
        definitionId: uuidSchema,
        definitionVersion: z.number().int().positive(),
        definitionChecksum: checksumSchema,
        moduleKey: capabilityKeySchema,
        moduleContractVersion: contractVersionSchema
      }),
      sourceActorId: uuidSchema,
      sourceTokenId: uuidSchema,
      blockerActorId: uuidSchema,
      blockerTokenId: uuidSchema,
      contact: spatialPointDtoSchema,
      contactPathDistance: z.number().finite().nonnegative(),
      blockerCurrentnessChecksum: checksumSchema,
      selectionContractChecksum: checksumSchema,
      resolvedSelectionChecksum: checksumSchema,
      spatialSelectionChecksum: checksumSchema,
      spatialCurrentnessChecksum: checksumSchema,
      originalPath: z.array(spatialPointDtoSchema).min(2).max(MAX_SPATIAL_PATH_POINTS),
      pathChecksum: checksumSchema,
      terminalPassageStop: z
        .strictObject({
          blockerActorId: uuidSchema,
          blockerTokenId: uuidSchema,
          contact: spatialPointDtoSchema,
          contactPathDistance: z.number().finite().nonnegative(),
          blockerCurrentnessChecksum: checksumSchema
        })
        .optional(),
      terminalPosition: spatialPointDtoSchema.optional()
    })
  })
  .superRefine((value, context) => {
    const success = value.initiator.total > value.defender.total
    if (
      value.actionEconomy.afterUsed !== value.actionEconomy.beforeUsed + 1 ||
      value.actionEconomy.afterUsed > value.actionEconomy.maximum ||
      (success ? value.outcome !== 'SUCCESS' : value.outcome !== 'TIE_OR_FAILURE')
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Movement passage settlement must match its contest and economy evidence.'
      })
    }
    const auditedContact = spatialPathPointAtDistance(
      value.audit.originalPath,
      value.audit.contactPathDistance
    )
    if (
      checksumRuleDocument(value.audit.originalPath) !== value.audit.pathChecksum ||
      auditedContact === null ||
      !spatialPointEquals(auditedContact, value.audit.contact)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['audit', 'originalPath'],
        message: 'Movement passage audit contacts must bind the authoritative root path.'
      })
    }
    const terminalPassageStop = value.audit.terminalPassageStop
    const terminalPosition = value.audit.terminalPosition
    const auditedTerminalContact = terminalPassageStop
      ? spatialPathPointAtDistance(
          value.audit.originalPath,
          terminalPassageStop.contactPathDistance
        )
      : null
    if (
      (terminalPassageStop === undefined) !== (terminalPosition === undefined) ||
      (terminalPassageStop !== undefined &&
        (value.outcome !== 'SUCCESS' ||
          terminalPassageStop.contactPathDistance <= value.audit.contactPathDistance + 1e-8 ||
          auditedTerminalContact === null ||
          !spatialPointEquals(auditedTerminalContact, terminalPassageStop.contact) ||
          terminalPosition === undefined ||
          !spatialPointEquals(terminalPosition, terminalPassageStop.contact)))
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['audit', 'terminalPassageStop'],
        message:
          'A terminal passage stop must follow a successful path-bound contact and match the terminal position.'
      })
    }
  })

export const spatialResolutionCommandDtoSchema = z.strictObject({
  commandId: uuidSchema,
  commandFingerprint: checksumSchema,
  actorUserId: uuidSchema,
  correlationId: uuidSchema.nullable(),
  expectedOccurrenceVersion: spatialAggregateVersionSchema,
  requestId: z.string().min(1).max(256),
  kind: z.enum(['ENTER_DICE', 'SYSTEM_ROLL']),
  passageContest: movementPassageContestReceiptDtoSchema.optional()
})

const movementResolutionCommandBaseShape = {
  commandId: uuidSchema,
  commandFingerprint: checksumSchema,
  actorUserId: uuidSchema,
  correlationId: uuidSchema.nullable(),
  expectedOccurrenceVersion: spatialAggregateVersionSchema
}

export const movementReactionResolutionCommandDtoSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    ...movementResolutionCommandBaseShape,
    ...movementReactionChoiceSelectionDtoSchema.options[0].shape
  }),
  z.strictObject({
    ...movementResolutionCommandBaseShape,
    ...movementReactionChoiceSelectionDtoSchema.options[1].shape
  })
])

/** A sealed response to the one movement-passage choice at an occupied contact. */
export const movementPassageResolutionCommandDtoSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    ...movementResolutionCommandBaseShape,
    kind: z.literal('PASSAGE_DECLINE')
  }),
  z.strictObject({
    ...movementResolutionCommandBaseShape,
    kind: z.literal('PASSAGE_OPTION'),
    optionId: checksumSchema,
    passageContest: movementPassageContestReceiptDtoSchema.optional()
  })
])

/**
 * One canonical version history for the complete movement occurrence. Spatial
 * evidence and reaction choices advance the same aggregate-owned occurrence;
 * neither creates a second workflow or receipt stream.
 */
export const movementRuleResolutionCommandDtoSchema = z.union([
  spatialResolutionCommandDtoSchema,
  movementReactionResolutionCommandDtoSchema,
  movementPassageResolutionCommandDtoSchema
])

function validateCanonicalSpatialResolutionHistory(
  commands: readonly z.infer<typeof movementRuleResolutionCommandDtoSchema>[],
  context: z.RefinementCtx,
  path: readonly (string | number)[]
) {
  const commandIds = new Set<string>()
  let passageOptionId: string | null = null
  let passageContestRecorded = false
  for (const [index, command] of commands.entries()) {
    if (commandIds.has(command.commandId))
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, index, 'commandId'],
        message: 'Movement resolution command IDs must be unique.'
      })
    commandIds.add(command.commandId)
    if (command.kind === 'PASSAGE_OPTION') passageOptionId = command.optionId
    const passageContest = 'passageContest' in command ? command.passageContest : undefined
    if (passageContest) {
      if (
        passageContestRecorded ||
        passageOptionId === null ||
        passageContest.optionId !== passageOptionId ||
        (command.kind === 'PASSAGE_OPTION' && command.optionId !== passageContest.optionId)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...path, index, 'passageContest'],
          message: 'Movement passage contest evidence must bind one prior issued option.'
        })
      }
      passageContestRecorded = true
    }
    if (command.expectedOccurrenceVersion !== index)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, index, 'expectedOccurrenceVersion'],
        message:
          'Movement resolution commands must retain contiguous occurrence versions starting at zero.'
      })
  }
}

const spatialPointEquals = (
  left: z.infer<typeof spatialPointDtoSchema>,
  right: z.infer<typeof spatialPointDtoSchema>
): boolean => Math.abs(left.x - right.x) <= 1e-8 && Math.abs(left.y - right.y) <= 1e-8

const spatialPathPointAtDistance = (
  path: readonly z.infer<typeof spatialPointDtoSchema>[],
  distance: number
): z.infer<typeof spatialPointDtoSchema> | null => {
  let remaining = distance
  for (let index = 1; index < path.length; index += 1) {
    const start = path[index - 1]!
    const end = path[index]!
    const length = Math.hypot(end.x - start.x, end.y - start.y)
    if (length === 0) continue
    if (remaining <= length + 1e-8) {
      const ratio = Math.max(0, Math.min(1, remaining / length))
      return {
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio
      }
    }
    remaining -= length
  }
  return remaining <= 1e-8 ? path[path.length - 1]! : null
}

const compareSpatialPendingCandidates = (
  left: z.infer<typeof spatialPendingCandidateDtoSchema>,
  right: z.infer<typeof spatialPendingCandidateDtoSchema>
): number => {
  const keys = [
    left.candidate.pathDistance - right.candidate.pathDistance,
    left.candidate.effectId.localeCompare(right.candidate.effectId),
    left.candidate.targetActorId.localeCompare(right.candidate.targetActorId),
    left.candidate.trigger.localeCompare(right.candidate.trigger)
  ]
  return keys.find((value) => value !== 0) ?? 0
}

const movementPassageStopDtoSchema = z.strictObject({
  blockerActorId: uuidSchema,
  blockerTokenId: uuidSchema,
  contact: spatialPointDtoSchema,
  pathDistance: z.number().finite().nonnegative(),
  blockerCurrentnessChecksum: checksumSchema
})

const spatialMovementPendingRootDtoSchema = z.strictObject({
  commandId: uuidSchema,
  commandFingerprint: checksumSchema,
  initiatorUserId: uuidSchema,
  correlationId: uuidSchema.nullable(),
  encounterId: uuidSchema,
  sceneId: uuidSchema,
  tokenId: uuidSchema,
  expectedEncounterVersion: spatialAggregateVersionSchema,
  expectedSceneVersion: spatialAggregateVersionSchema,
  /** Exact Scene version after the last committed paused contact movement. */
  currentSceneVersion: spatialAggregateVersionSchema,
  movementKind: spatialMovementKindDtoSchema,
  originalPath: z.array(spatialPointDtoSchema).min(2).max(MAX_SPATIAL_PATH_POINTS),
  pathChecksum: checksumSchema,
  pathStartDistance: z.number().finite().nonnegative(),
  currentPosition: spatialPointDtoSchema,
  terminalPassageStop: movementPassageStopDtoSchema.nullable().optional(),
  resolutionCommands: z.array(movementRuleResolutionCommandDtoSchema).max(MAX_SPATIAL_CANDIDATES)
})

function validateSpatialMovementPendingRoot(
  root: z.infer<typeof spatialMovementPendingRootDtoSchema>,
  context: z.RefinementCtx,
  path: readonly (string | number)[]
) {
  if (root.currentSceneVersion < root.expectedSceneVersion)
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [...path, 'currentSceneVersion'],
      message: 'Pending spatial Scene currentness may not precede its immutable root version.'
    })
  if (root.movementKind === 'TELEPORT' && root.originalPath.length !== 2)
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [...path, 'originalPath'],
      message: 'Teleport spatial movement must retain only origin and destination.'
    })
  if (checksumRuleDocument(root.originalPath) !== root.pathChecksum)
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [...path, 'pathChecksum'],
      message: 'Spatial movement path checksum must bind the exact authoritative path.'
    })
  validateCanonicalSpatialResolutionHistory(root.resolutionCommands, context, [
    ...path,
    'resolutionCommands'
  ])
  const committed = spatialPathPointAtDistance(root.originalPath, root.pathStartDistance)
  if (committed === null || !spatialPointEquals(committed, root.currentPosition))
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [...path, 'currentPosition'],
      message:
        'Spatial movement current position must be the authoritative path position at pathStartDistance.'
    })
  if (root.terminalPassageStop) {
    const stop = spatialPathPointAtDistance(
      root.originalPath,
      root.terminalPassageStop.pathDistance
    )
    if (
      root.terminalPassageStop.pathDistance + 1e-8 < root.pathStartDistance ||
      stop === null ||
      !spatialPointEquals(stop, root.terminalPassageStop.contact)
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, 'terminalPassageStop'],
        message: 'A terminal passage stop must be at or after the committed path contact.'
      })
  }
}

const spatialPendingContextDtoSchema = z
  .strictObject({
    kind: z.literal('ENCOUNTER_SPATIAL_MOVEMENT'),
    schemaVersion: z.literal(1),
    root: spatialMovementPendingRootDtoSchema,
    selectionChecksum: checksumSchema,
    completedExecutions: z
      .array(z.lazy(() => spatialMovementExecutionDtoSchema))
      .max(MAX_SPATIAL_CANDIDATES),
    currentCandidate: spatialPendingCandidateDtoSchema,
    remainingCandidates: z.array(spatialPendingCandidateDtoSchema).max(MAX_SPATIAL_CANDIDATES)
  })
  .superRefine((value, context) => {
    validateSpatialMovementPendingRoot(value.root, context, ['root'])

    const candidateKeys = new Set<string>()
    const all = [
      ...value.completedExecutions.map((execution) => execution.candidate),
      value.currentCandidate,
      ...value.remainingCandidates
    ]
    for (const [index, candidate] of all.entries()) {
      const key = `${candidate.candidate.effectId}:${candidate.candidate.targetActorId}:${candidate.candidate.trigger}`
      if (candidateKeys.has(key))
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['currentCandidate'],
          message:
            'Spatial candidates must be unique across completed, current, and remaining sets.'
        })
      candidateKeys.add(key)
      const pathContact = spatialPathPointAtDistance(
        value.root.originalPath,
        candidate.candidate.pathDistance
      )
      if (pathContact === null || !spatialPointEquals(pathContact, candidate.candidate.contact))
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['currentCandidate', 'candidate', 'contact'],
          message: 'Spatial candidate path distance must resolve on the authoritative path.'
        })
      if (index > 0 && compareSpatialPendingCandidates(all[index - 1]!, candidate) >= 0)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['remainingCandidates'],
          message: 'Spatial candidates must retain strict canonical path-contact order.'
        })
    }
    const currentOrdinal = value.currentCandidate.ordinal
    for (const [index, execution] of value.completedExecutions.entries()) {
      if (execution.ordinal !== index || execution.ordinal >= currentOrdinal)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['completedExecutions', index],
          message:
            'Completed spatial executions must be the contiguous prefix before the current candidate.'
        })
      if (execution.candidate.candidate.pathDistance > value.root.pathStartDistance + 1e-8)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['completedExecutions', index, 'candidate', 'candidate', 'pathDistance'],
          message: 'Completed spatial executions may not follow the committed path position.'
        })
    }
    if (currentOrdinal !== value.completedExecutions.length)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['currentCandidate', 'ordinal'],
        message: 'Current spatial candidate must immediately follow completed execution ordinals.'
      })
    if (
      Math.abs(value.currentCandidate.candidate.pathDistance - value.root.pathStartDistance) >
        1e-8 ||
      !spatialPointEquals(value.currentCandidate.candidate.contact, value.root.currentPosition)
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['currentCandidate', 'candidate'],
        message: 'The pending spatial candidate must begin at the committed current path position.'
      })
    for (const [index, candidate] of value.remainingCandidates.entries())
      if (
        candidate.ordinal !== currentOrdinal + index + 1 ||
        candidate.candidate.pathDistance + 1e-8 < value.root.pathStartDistance
      )
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['remainingCandidates', index, 'ordinal'],
          message:
            'Remaining spatial candidates must form the contiguous suffix at or after the committed contact.'
        })
  })

const movementReactionCharacterTransitionDtoSchema = z.strictObject({
  characterId: uuidSchema,
  beforeStreamVersion: z.number().int().min(0),
  afterStreamVersion: z.number().int().min(0)
})

const pendingSpatialCharacterTransitionsDtoSchema = z
  .array(movementReactionCharacterTransitionDtoSchema)
  .max(2)
  .superRefine((transitions, context) => {
    let priorCharacterId = ''
    for (const [index, transition] of transitions.entries()) {
      if (
        transition.afterStreamVersion !== transition.beforeStreamVersion + 1 ||
        transition.characterId <= priorCharacterId
      )
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index],
          message: 'Pending spatial Character transitions must advance once in canonical order.'
        })
      priorCharacterId = transition.characterId
    }
  })

const movementReactionActionExecutionDtoSchema = z.lazy(() =>
  z
    .strictObject({
      ordinal: receiptOrdinalSchema,
      sourceCommandId: uuidSchema,
      option: movementReactionChoiceOptionDtoSchema,
      allowance: z.strictObject({
        definitionId: uuidSchema,
        maximum: z.number().int().positive().max(10_000),
        beforeUsed: z.number().int().nonnegative(),
        afterUsed: z.number().int().positive()
      }),
      execution: z.lazy(() => serverCompletedRuleExecutionDtoSchema),
      application: serverRuleExecutionApplicationOutputsDtoSchema,
      legendaryResistance: z
        .strictObject({
          selectedIndex: z.union([z.literal(0), z.literal(1)]),
          use: z.boolean(),
          lifecycle: z.strictObject({
            definitionId: uuidSchema,
            definitionVersion: z.number().int().positive(),
            definitionChecksum: checksumSchema,
            choiceGraphDefinitionId: uuidSchema,
            choiceGraphDefinitionVersion: z.number().int().positive(),
            choiceGraphDefinitionChecksum: checksumSchema,
            useOutput: portNameSchema,
            interruptedStage: z.literal('AFTER_FAILED_SAVE_BEFORE_OUTCOME'),
            replacement: z.literal('SAVE_SUCCESS')
          }),
          execution: z.lazy(() => serverCompletedRuleExecutionDtoSchema),
          originalD20: z.lazy(() => serverRuleExecutionD20EvidenceDtoSchema)
        })
        .nullable()
        .default(null),
      characterTransitions: z.array(movementReactionCharacterTransitionDtoSchema).max(2)
    })
    .superRefine((value, context) => {
      if (
        value.allowance.afterUsed !== value.allowance.beforeUsed + 1 ||
        value.allowance.afterUsed > value.allowance.maximum
      )
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['allowance'],
          message: 'Movement reaction allowance evidence must consume exactly one available use.'
        })
      let priorCharacterId = ''
      for (const [index, transition] of value.characterTransitions.entries()) {
        if (
          transition.afterStreamVersion !== transition.beforeStreamVersion + 1 ||
          transition.characterId <= priorCharacterId
        )
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['characterTransitions', index],
            message:
              'Movement reaction Character transitions must be unique, ordered, and advance exactly once.'
          })
        priorCharacterId = transition.characterId
      }
    })
)

const movementReactionPendingPhaseDtoSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('SPATIAL_EVIDENCE'),
    currentCandidate: spatialPendingCandidateDtoSchema
  }),
  z.strictObject({ kind: z.literal('CHOICE') }),
  z.strictObject({
    kind: z.literal('ACTION_EVIDENCE'),
    selectedOptionId: checksumSchema,
    d20Policy: z.lazy(() => serverRuleExecutionD20PolicyDtoSchema)
  }),
  z.strictObject({
    kind: z.literal('LEGENDARY_RESISTANCE_CHOICE'),
    selectedOptionId: checksumSchema,
    originalExecution: z.lazy(() => serverCompletedRuleExecutionDtoSchema),
    originalD20: z.lazy(() => serverRuleExecutionD20EvidenceDtoSchema),
    originalExecutionChecksum: checksumSchema,
    targetStateChecksum: checksumSchema,
    resistance: z.strictObject({
      targetActorId: uuidSchema,
      ownerFeatureId: authoredIdentifierSchema,
      chargeId: authoredIdentifierSchema,
      featureCost: z.number().int().positive(),
      poolBefore: z.number().int().nonnegative(),
      poolRemaining: z.number().int().nonnegative(),
      definitionId: uuidSchema,
      definitionVersion: z.number().int().positive(),
      definitionChecksum: checksumSchema,
      choiceGraphDefinitionId: uuidSchema,
      choiceGraphDefinitionVersion: z.number().int().positive(),
      choiceGraphDefinitionChecksum: checksumSchema,
      useOutput: portNameSchema,
      useOptionId: checksumSchema,
      selectionChecksum: checksumSchema
    })
  })
])

const movementReactionPendingContextDtoSchema = z
  .strictObject({
    kind: z.literal('ENCOUNTER_MOVEMENT_REACTION'),
    schemaVersion: z.literal(1),
    root: spatialMovementPendingRootDtoSchema,
    spatialSelectionChecksum: checksumSchema,
    spatialCurrentnessChecksum: checksumSchema,
    reactionSelectionChecksum: checksumSchema,
    completedSpatialExecutions: z
      .array(z.lazy(() => spatialMovementExecutionDtoSchema))
      .max(MAX_SPATIAL_CANDIDATES),
    /** Exact aggregate/effect transition evidence already committed before a reaction boundary. */
    appliedSpatialPrefix: z
      .lazy(() => storedRuleExecutionResultDtoSchema)
      .nullable()
      .default(null),
    completedReactionExecutions: z
      .array(movementReactionActionExecutionDtoSchema)
      .max(RULE_GRAPH_LIMITS.NODES)
      .default([]),
    phase: movementReactionPendingPhaseDtoSchema,
    remainingSpatialCandidates: z
      .array(spatialPendingCandidateDtoSchema)
      .max(MAX_SPATIAL_CANDIDATES),
    reactionTimeline: movementReactionTimelineDtoSchema.min(1)
  })
  .superRefine((value, context) => {
    validateSpatialMovementPendingRoot(value.root, context, ['root'])
    const currentEntry = value.reactionTimeline[0]!
    const currentOption =
      currentEntry.kind === 'AUTOMATIC_ACTION'
        ? currentEntry.option
        : currentEntry.group.options[0]!
    const currentOptions =
      currentEntry.kind === 'AUTOMATIC_ACTION' ? [currentEntry.option] : currentEntry.group.options
    const phaseDistance =
      value.phase.kind === 'SPATIAL_EVIDENCE'
        ? value.phase.currentCandidate.candidate.pathDistance
        : currentOption.candidate.pathDistance
    if (Math.abs(phaseDistance - value.root.pathStartDistance) > 1e-8)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['phase'],
        message: 'The pending movement phase must begin at the committed path position.'
      })
    if (
      value.phase.kind === 'SPATIAL_EVIDENCE' &&
      value.phase.currentCandidate.candidate.pathDistance >
        currentOption.candidate.pathDistance + 1e-8
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['phase', 'currentCandidate'],
        message: 'Pending spatial evidence may not follow the next frozen reaction contact.'
      })
    if (value.phase.kind === 'CHOICE' && currentEntry.kind !== 'CONTROLLER_CHOICE') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['phase'],
        message: 'Only a controller-choice timeline entry may open a movement reaction choice.'
      })
    }
    if (
      value.phase.kind === 'ACTION_EVIDENCE' ||
      value.phase.kind === 'LEGENDARY_RESISTANCE_CHOICE'
    ) {
      const selectedOptionId = value.phase.selectedOptionId
      if (!currentOptions.some((option) => option.optionId === selectedOptionId))
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['phase', 'selectedOptionId'],
          message: 'Reaction action evidence must retain one exact issued choice option.'
        })
    }
    if (value.phase.kind === 'LEGENDARY_RESISTANCE_CHOICE') {
      if (
        checksumRuleDocument(value.phase.originalExecution) !==
          value.phase.originalExecutionChecksum ||
        value.phase.originalD20.resultPath !== 'ON_SAVE_FAIL' ||
        value.phase.originalExecution.outputs.resultPath !== 'ON_SAVE_FAIL' ||
        value.phase.resistance.poolBefore < value.phase.resistance.featureCost ||
        value.phase.resistance.poolRemaining !==
          value.phase.resistance.poolBefore - value.phase.resistance.featureCost
      )
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['phase'],
          message:
            'Legendary Resistance must retain one exact failed-save action and available Feature cost.'
        })
      if (
        checksumRuleDocument({
          targetActorId: value.phase.resistance.targetActorId,
          ownerFeatureId: value.phase.resistance.ownerFeatureId,
          chargeId: value.phase.resistance.chargeId,
          featureCost: value.phase.resistance.featureCost,
          definitionId: value.phase.resistance.definitionId,
          definitionVersion: value.phase.resistance.definitionVersion,
          definitionChecksum: value.phase.resistance.definitionChecksum,
          choiceGraphDefinitionId: value.phase.resistance.choiceGraphDefinitionId,
          choiceGraphDefinitionVersion: value.phase.resistance.choiceGraphDefinitionVersion,
          choiceGraphDefinitionChecksum: value.phase.resistance.choiceGraphDefinitionChecksum
        }) !== value.phase.resistance.selectionChecksum
      )
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['phase', 'resistance', 'selectionChecksum'],
          message: 'Legendary Resistance selection checksum is invalid.'
        })
      if (
        checksumRuleDocument({
          kind: 'USE',
          selectionChecksum: value.phase.resistance.selectionChecksum
        }) !== value.phase.resistance.useOptionId
      )
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['phase', 'resistance', 'useOptionId'],
          message: 'Legendary Resistance use option identity is invalid.'
        })
    }
    if (checksumRuleDocument(value.reactionTimeline) !== value.reactionSelectionChecksum)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reactionSelectionChecksum'],
        message: 'Reaction selection checksum must bind the exact frozen timeline suffix.'
      })
    value.completedReactionExecutions.forEach((execution, index) => {
      if (execution.ordinal !== index)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['completedReactionExecutions', index, 'ordinal'],
          message: 'Completed movement reactions must retain contiguous canonical order.'
        })
    })
    for (const [index, execution] of value.completedSpatialExecutions.entries()) {
      if (
        execution.ordinal !== index ||
        execution.candidate.candidate.pathDistance > phaseDistance + 1e-8
      )
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['completedSpatialExecutions', index],
          message:
            'Completed spatial executions must be the contiguous prefix through the reaction contact.'
        })
    }
    if (value.appliedSpatialPrefix !== null) {
      const prefix = value.appliedSpatialPrefix
      if (
        prefix.status !== 'BATCH_COMPLETE' ||
        prefix.batchKind !== 'ENCOUNTER_SPATIAL_MOVEMENT' ||
        JSON.stringify(prefix.executions) !== JSON.stringify(value.completedSpatialExecutions)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['appliedSpatialPrefix'],
          message:
            'Applied spatial prefix evidence must exactly cover the committed execution prefix.'
        })
      }
    }
    const spatialOrdinalOffset = value.phase.kind === 'SPATIAL_EVIDENCE' ? 1 : 0
    if (
      value.phase.kind === 'SPATIAL_EVIDENCE' &&
      value.phase.currentCandidate.ordinal !== value.completedSpatialExecutions.length
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['phase', 'currentCandidate', 'ordinal'],
        message: 'Pending spatial evidence must immediately follow the completed prefix.'
      })
    let priorSpatial: z.infer<typeof spatialPendingCandidateDtoSchema> | null =
      value.phase.kind === 'SPATIAL_EVIDENCE' ? value.phase.currentCandidate : null
    for (const [index, candidate] of value.remainingSpatialCandidates.entries()) {
      if (
        candidate.ordinal !==
          value.completedSpatialExecutions.length + spatialOrdinalOffset + index ||
        (value.phase.kind !== 'SPATIAL_EVIDENCE' &&
          candidate.candidate.pathDistance <= currentOption.candidate.pathDistance + 1e-8) ||
        (priorSpatial !== null && compareSpatialPendingCandidates(priorSpatial, candidate) >= 0)
      )
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['remainingSpatialCandidates', index],
          message:
            'Remaining spatial candidates must be the strict canonical suffix after same-contact spatial resolution.'
        })
      priorSpatial = candidate
    }
  })

const initiativeEntityIdentityDtoSchema = z.strictObject({
  kind: z.enum(['ACTOR', 'SIDE']),
  id: uuidSchema
})

const initiativeScoreBatchResultDtoSchema = z.strictObject({
  entity: initiativeEntityIdentityDtoSchema,
  result: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('FACTS_UNAVAILABLE') }),
    z.strictObject({ kind: z.literal('EVIDENCE_NOT_ALLOWED') }),
    z.strictObject({
      kind: z.literal('GRAPH_COMPLETE'),
      execution: z.discriminatedUnion('automatic', [
        z.strictObject({
          automatic: z.literal(true),
          score: z.number().finite(),
          sortDirection: z.enum(['ASCENDING', 'DESCENDING']),
          execution: z.lazy(() => serverCompletedRuleExecutionDtoSchema)
        }),
        z.strictObject({
          automatic: z.literal(false),
          score: z.null(),
          sortDirection: z.enum(['ASCENDING', 'DESCENDING']),
          execution: z.lazy(() => serverCompletedRuleExecutionDtoSchema)
        })
      ])
    })
  ])
})

const initiativeScoreGroupDtoSchema = z.strictObject({
  score: z.number().finite(),
  members: z.array(initiativeEntityIdentityDtoSchema).min(1).max(RULE_GRAPH_LIMITS.NODES),
  classification: z.enum(['SETTLED', 'TIED'])
})

const initiativeOrderSegmentDtoSchema = z.strictObject({
  kind: z.enum(['SETTLED', 'ORDER_CHOICE_REQUIRED']),
  score: z.number().finite(),
  members: z.array(initiativeEntityIdentityDtoSchema).min(1).max(RULE_GRAPH_LIMITS.NODES)
})

const initiativePendingScoreBatchDtoSchema = z.strictObject({
  completed: z.array(initiativeScoreBatchResultDtoSchema).max(RULE_GRAPH_LIMITS.NODES),
  current: initiativeEntityIdentityDtoSchema,
  remaining: z.array(initiativeEntityIdentityDtoSchema).max(RULE_GRAPH_LIMITS.NODES - 1)
})

const initiativeTieEvaluationAttemptDtoSchema = z.strictObject({
  originalScore: z.number().finite(),
  attemptOrdinal: z.number().int().min(1).max(20),
  results: z.array(initiativeScoreBatchResultDtoSchema).min(2).max(RULE_GRAPH_LIMITS.NODES)
})

const initiativeOrderChoiceEvidenceDtoSchema = z.strictObject({
  selectedEntity: initiativeEntityIdentityDtoSchema,
  execution: z.lazy(() => serverCompletedRuleExecutionDtoSchema)
})

const initiativeExecutionEvidenceDtoSchema = z.strictObject({
  primaryResults: z.array(initiativeScoreBatchResultDtoSchema).min(1).max(RULE_GRAPH_LIMITS.NODES),
  tieAttempts: z.array(initiativeTieEvaluationAttemptDtoSchema).max(RULE_GRAPH_LIMITS.NODES * 20),
  orderChoices: z.array(initiativeOrderChoiceEvidenceDtoSchema).max(RULE_GRAPH_LIMITS.NODES - 1)
})

export const encounterInitiativeAdvancePlanDtoSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('SAME_ROUND'),
    round: z.number().int().positive(),
    stateChecksum: checksumSchema,
    currentActorId: uuidSchema,
    nextActorId: uuidSchema
  }),
  z
    .strictObject({
      kind: z.literal('ROUND_WRAP'),
      round: z.number().int().positive(),
      nextRound: z.number().int().positive(),
      cadence: z.enum(['ENCOUNTER_START', 'EACH_ROUND']),
      stateChecksum: checksumSchema,
      currentActorId: uuidSchema,
      firstActorId: uuidSchema.nullable(),
      orderedActorIds: z.array(uuidSchema).min(1).max(RULE_GRAPH_LIMITS.NODES),
      orderedSideIds: z.array(uuidSchema).max(RULE_GRAPH_LIMITS.NODES)
    })
    .superRefine((value, context) => {
      if (value.nextRound !== value.round + 1)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['nextRound'],
          message: 'Initiative round wraps must advance exactly one round.'
        })
      if (
        (value.cadence === 'ENCOUNTER_START' && value.firstActorId !== value.orderedActorIds[0]) ||
        (value.cadence === 'EACH_ROUND' && value.firstActorId !== null)
      )
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['firstActorId'],
          message:
            'Encounter-start cadence must retain its first actor; each-round cadence must defer it.'
        })
    })
])

export type EncounterInitiativeAdvancePlanDto = z.infer<
  typeof encounterInitiativeAdvancePlanDtoSchema
>

const encounterInitiativeSettlementBaseShape = {
  round: z.number().int().positive(),
  cadence: z.enum(['ENCOUNTER_START', 'EACH_ROUND']),
  orderedActorIds: z.array(uuidSchema).min(1).max(RULE_GRAPH_LIMITS.NODES),
  orderedSideIds: z.array(uuidSchema).max(RULE_GRAPH_LIMITS.NODES)
}

/** Terminal normalized initiative order plus every graph execution that established it. */
export const encounterInitiativeSettlementDtoSchema = z
  .discriminatedUnion('procedure', [
    z.strictObject({
      ...encounterInitiativeSettlementBaseShape,
      procedure: z.literal('MANUAL'),
      cadence: z.literal('ENCOUNTER_START'),
      policySnapshotChecksum: z.null(),
      evidence: z.strictObject({
        primaryResults: z.tuple([]),
        tieAttempts: z.tuple([]),
        orderChoices: z.tuple([])
      })
    }),
    z.strictObject({
      ...encounterInitiativeSettlementBaseShape,
      procedure: z.enum(['ACTOR_ROLL', 'ACTOR_SCORE', 'SIDE_ROLL', 'DECLARED_ACTION_ROLL']),
      policySnapshotChecksum: checksumSchema,
      evidence: initiativeExecutionEvidenceDtoSchema
    })
  ])
  .superRefine((value, context) => {
    const checkUnique = (ids: readonly string[], path: 'orderedActorIds' | 'orderedSideIds') => {
      if (new Set(ids).size !== ids.length)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [path],
          message: 'Settled initiative identities must be unique.'
        })
    }
    checkUnique(value.orderedActorIds, 'orderedActorIds')
    checkUnique(value.orderedSideIds, 'orderedSideIds')
    if ((value.procedure === 'SIDE_ROLL') !== value.orderedSideIds.length > 0)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['orderedSideIds'],
        message: 'Only Side Initiative settlements retain an ordered side cohort.'
      })
  })

export type EncounterInitiativeSettlementDto = z.infer<
  typeof encounterInitiativeSettlementDtoSchema
>

const initiativePendingOrderDtoSchema = z.strictObject({
  completedEntities: z.array(initiativeEntityIdentityDtoSchema).max(RULE_GRAPH_LIMITS.NODES),
  completedChoices: z
    .array(initiativeOrderChoiceEvidenceDtoSchema)
    .max(RULE_GRAPH_LIMITS.NODES - 1),
  currentSegment: initiativeOrderSegmentDtoSchema.extend({
    kind: z.literal('ORDER_CHOICE_REQUIRED')
  }),
  selectedFromCurrent: z.array(initiativeEntityIdentityDtoSchema).max(RULE_GRAPH_LIMITS.NODES - 1),
  remainingCurrent: z.array(initiativeEntityIdentityDtoSchema).min(2).max(RULE_GRAPH_LIMITS.NODES),
  laterSegments: z.array(initiativeOrderSegmentDtoSchema).max(RULE_GRAPH_LIMITS.NODES - 1)
})

/*
 * Historical pre-canonical paused initiative shape. Pending occurrences now validate
 * exclusively through initiativeState.ts; retain this comment-only source record until
 * the transitional migration packet removes it with its historical snapshots.
 */
/* const legacyStagedInitiativeRoundStateDtoSchema = z
  .strictObject({
    round: z.strictObject({
      encounterId: uuidSchema,
      round: z.number().int().positive(),
      procedure: z.enum([
        'ACTOR_ROLL',
        'ACTOR_SCORE',
        'SIDE_ROLL',
        'DECLARED_ACTION_ROLL',
        'MANUAL'
      ]),
      cadence: z.enum(['ENCOUNTER_START', 'EACH_ROUND']),
      status: z.enum(['PREPARING', 'ACTIVE', 'COMPLETED']),
      policySnapshotChecksum: checksumSchema.nullable(),
      nextTurnOrderOrdinal: z.number().int().min(0),
      version: z.number().int().min(0)
    }),
    participants: z
      .array(
        z.strictObject({
          encounterId: uuidSchema,
          round: z.number().int().positive(),
          actorId: uuidSchema,
          sideId: uuidSchema,
          status: z.enum(['UNRESOLVED', 'PENDING', 'EVALUATED', 'READY', 'ACTIVE', 'ACTED']),
          initiativeScore: z.number().finite().nullable(),
          evaluation: z.strictObject({
            occurrenceId: uuidSchema.nullable(),
            resultChecksum: checksumSchema.nullable()
          }),
          tie: z.strictObject({
            occurrenceId: uuidSchema.nullable(),
            resultChecksum: checksumSchema.nullable()
          }),
          declaration: z
            .strictObject({
              actorSize: z.string().trim().min(1).max(80),
              primary: z.discriminatedUnion('kind', [
                z.strictObject({
                  kind: z.literal('CHARACTER_ACTION'),
                  optionId: z.string().trim().min(1).max(1_000),
                  effectId: uuidSchema,
                  sourceId: z.string().trim().min(1).max(1_000),
                  sourceChecksum: checksumSchema,
                  activationCode: z.string().trim().min(1).max(80).nullable(),
                  equipmentInstanceId: z.string().trim().min(1).max(1_000).nullable(),
                  equipmentProperties: z.array(z.string().trim().min(1).max(80)).max(64)
                }),
                z.strictObject({
                  kind: z.literal('CHARACTER_SPELL_CAST'),
                  optionId: z.string().trim().min(1).max(1_000),
                  spellId: z.string().trim().min(1).max(1_000),
                  spellVersionId: uuidSchema,
                  spellVersion: z.number().int().nonnegative(),
                  spellChecksum: checksumSchema,
                  sourceKind: z.string().trim().min(1).max(80),
                  sourceInstanceId: z.string().trim().min(1).max(1_000),
                  castLevel: z.number().int().min(0).max(99)
                }),
                z.strictObject({
                  kind: z.literal('CREATURE_FEATURE_ACTION'),
                  optionId: z.string().trim().min(1).max(240),
                  actorId: uuidSchema,
                  creatureSourceId: uuidSchema,
                  sourceRevision: z.number().int().positive(),
                  sourceVersionId: uuidSchema,
                  sourceChecksum: checksumSchema,
                  ownerFeatureId: uuidSchema,
                  featureOptionId: uuidSchema.nullable(),
                  effectId: uuidSchema,
                  compiledEffectChecksum: checksumSchema,
                  activationCode: z.string().trim().min(1).max(240).nullable(),
                  featureResourceUse: z
                    .strictObject({ chargeId: uuidSchema, cost: z.number().int().positive() })
                    .nullable()
                }),
                z.strictObject({
                  kind: z.literal('GM_ADJUDICATED'),
                  optionId: z.literal('GM_ADJUDICATED'),
                  actorId: uuidSchema,
                  actionFactors: z
                    .array(
                      z.enum([
                        'MELEE_HEAVY',
                        'MELEE_LIGHT_OR_FINESSE',
                        'MELEE_TWO_HANDED',
                        'RANGED_LOADING'
                      ])
                    )
                    .max(4),
                  spellLevel: z.number().int().min(0).max(99).nullable()
                })
              ]),
              bonus: z
                .discriminatedUnion('kind', [
                  z.strictObject({
                    kind: z.literal('CHARACTER_ACTION'),
                    optionId: z.string().trim().min(1).max(1_000),
                    effectId: uuidSchema,
                    sourceId: z.string().trim().min(1).max(1_000),
                    sourceChecksum: checksumSchema,
                    activationCode: z.string().trim().min(1).max(80).nullable(),
                    equipmentInstanceId: z.string().trim().min(1).max(1_000).nullable(),
                    equipmentProperties: z.array(z.string().trim().min(1).max(80)).max(64)
                  }),
                  z.strictObject({
                    kind: z.literal('CHARACTER_SPELL_CAST'),
                    optionId: z.string().trim().min(1).max(1_000),
                    spellId: z.string().trim().min(1).max(1_000),
                    spellVersionId: uuidSchema,
                    spellVersion: z.number().int().nonnegative(),
                    spellChecksum: checksumSchema,
                    sourceKind: z.string().trim().min(1).max(80),
                    sourceInstanceId: z.string().trim().min(1).max(1_000),
                    castLevel: z.number().int().min(0).max(99)
                  }),
                  z.strictObject({
                    kind: z.literal('CREATURE_FEATURE_ACTION'),
                    optionId: z.string().trim().min(1).max(240),
                    actorId: uuidSchema,
                    creatureSourceId: uuidSchema,
                    sourceRevision: z.number().int().positive(),
                    sourceVersionId: uuidSchema,
                    sourceChecksum: checksumSchema,
                    ownerFeatureId: uuidSchema,
                    featureOptionId: uuidSchema.nullable(),
                    effectId: uuidSchema,
                    compiledEffectChecksum: checksumSchema,
                    activationCode: z.string().trim().min(1).max(240).nullable(),
                    featureResourceUse: z
                      .strictObject({ chargeId: uuidSchema, cost: z.number().int().positive() })
                      .nullable()
                  }),
                  z.strictObject({
                    kind: z.literal('GM_ADJUDICATED'),
                    optionId: z.literal('GM_ADJUDICATED'),
                    actorId: uuidSchema,
                    actionFactors: z
                      .array(
                        z.enum([
                          'MELEE_HEAVY',
                          'MELEE_LIGHT_OR_FINESSE',
                          'MELEE_TWO_HANDED',
                          'RANGED_LOADING'
                        ])
                      )
                      .max(4),
                    spellLevel: z.number().int().min(0).max(99).nullable()
                  })
                ])
                .nullable()
            })
            .nullable(),
          declarationChecksum: checksumSchema.nullable(),
          turnOrderOrdinal: z.number().int().min(0).nullable(),
          version: z.number().int().min(0)
        })
      )
      .min(1)
      .max(RULE_GRAPH_LIMITS.NODES),
    sides: z
      .array(
        z.strictObject({
          encounterId: uuidSchema,
          round: z.number().int().positive(),
          sideId: uuidSchema,
          status: z.enum(['UNRESOLVED', 'PENDING', 'EVALUATED', 'READY', 'ACTIVE', 'COMPLETED']),
          initiativeScore: z.number().finite().nullable(),
          evaluation: z.strictObject({
            occurrenceId: uuidSchema.nullable(),
            resultChecksum: checksumSchema.nullable()
          }),
          tie: z.strictObject({
            occurrenceId: uuidSchema.nullable(),
            resultChecksum: checksumSchema.nullable()
          }),
          sideOrderOrdinal: z.number().int().min(0).nullable(),
          version: z.number().int().min(0)
        })
      )
      .max(RULE_GRAPH_LIMITS.NODES)
  })
  .superRefine((state, context) => {
    const participantIds = state.participants.map((participant) => participant.actorId)
    const sideIds = state.sides.map((side) => side.sideId)
    if (
      new Set(participantIds).size !== participantIds.length ||
      participantIds.some((id, index) => index > 0 && participantIds[index - 1]! >= id) ||
      new Set(sideIds).size !== sideIds.length ||
      sideIds.some((id, index) => index > 0 && sideIds[index - 1]! >= id)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Staged initiative identities must be unique and sorted.'
      })
    }
  })

*/
const initiativeBeforePinDtoSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('INITIAL_START'),
    actorIds: z.array(uuidSchema).min(1).max(RULE_GRAPH_LIMITS.NODES)
  }),
  z.strictObject({
    kind: z.literal('EACH_ROUND'),
    round: z.number().int().positive(),
    version: z.number().int().min(0),
    checksum: checksumSchema,
    actorIds: z.array(uuidSchema).min(1).max(RULE_GRAPH_LIMITS.NODES)
  })
])

const encounterInitiativePendingContextDtoSchema = z
  .strictObject({
    kind: z.literal('ENCOUNTER_INITIATIVE'),
    schemaVersion: z.literal(1),
    root: z.strictObject({
      rootCommandId: uuidSchema,
      commandFingerprint: checksumSchema,
      commandType: z.enum(['START', 'ADVANCE_TURN']),
      initiatorUserId: uuidSchema,
      correlationId: uuidSchema.nullable(),
      expectedEncounterVersion: z.number().int().min(0),
      round: z.number().int().positive(),
      policySnapshotChecksum: checksumSchema,
      initiativeBeforePin: initiativeBeforePinDtoSchema,
      stagedInitiativeRoundState: stagedInitiativeRoundStateDtoSchema,
      startSystemId: uuidSchema.nullable().default(null),
      initiativeAdvance: z.lazy(() => encounterInitiativeAdvancePlanDtoSchema).optional(),
      outgoingTurn: z.lazy(() => pendingCompletedTurnPhaseDtoSchema).optional(),
      legendaryActionQueue: z
        .strictObject({
          ownerActorIds: z.array(uuidSchema).min(1).max(RULE_GRAPH_LIMITS.NODES),
          nextOwnerIndex: z
            .number()
            .int()
            .min(0)
            .max(RULE_GRAPH_LIMITS.NODES - 1)
        })
        .optional(),
      completedLegendaryActions: z
        .array(z.lazy(() => turnLegendaryActionEvidenceDtoSchema))
        .max(RULE_GRAPH_LIMITS.NODES)
        .optional(),
      stagedLegendaryActionRefreshes: z
        .array(turnLegendaryActionRefreshDtoSchema)
        .max(RULE_GRAPH_LIMITS.NODES)
        .optional(),
      stagedActionEconomyRefreshes: z
        .array(turnActionEconomyRefreshDtoSchema)
        .max(RULE_GRAPH_LIMITS.NODES)
        .optional(),
      completedRechargePlan: z
        .lazy(() => completedTurnRechargePlanDtoSchema)
        .nullable()
        .optional(),
      resolutionCommands: z
        .array(turnResolutionCommandDtoSchema)
        .max(RULE_GRAPH_LIMITS.NODES * 20)
        .default([])
    }),
    phase: z.discriminatedUnion('kind', [
      z.strictObject({
        kind: z.literal('INITIATIVE_DECLARATION'),
        actorId: uuidSchema,
        participantVersion: z.number().int().min(0),
        requestId: z.string().trim().min(1).max(256),
        primaryOptions: z
          .array(initiativeDeclarationOptionDtoSchema)
          .min(1)
          .max(RULE_GRAPH_LIMITS.NODES),
        bonusOptions: z.array(initiativeDeclarationOptionDtoSchema).max(RULE_GRAPH_LIMITS.NODES),
        adjudicationFields: z.array(initiativeDeclarationAdjudicationFieldDtoSchema).max(3)
      }),
      z.strictObject({
        kind: z.literal('PRIMARY_SCORE'),
        scoreBatch: initiativePendingScoreBatchDtoSchema
      }),
      z.strictObject({
        kind: z.literal('TIE_RESOLUTION'),
        primaryResults: z
          .array(initiativeScoreBatchResultDtoSchema)
          .min(1)
          .max(RULE_GRAPH_LIMITS.NODES),
        completedAttempts: z
          .array(initiativeTieEvaluationAttemptDtoSchema)
          .max(RULE_GRAPH_LIMITS.NODES * 20),
        completedSegments: z.array(initiativeOrderSegmentDtoSchema).max(RULE_GRAPH_LIMITS.NODES),
        currentOriginalGroup: initiativeScoreGroupDtoSchema.extend({
          classification: z.literal('TIED')
        }),
        attemptOrdinal: z.number().int().min(1).max(20),
        scoreBatch: initiativePendingScoreBatchDtoSchema,
        laterOriginalGroups: z.array(initiativeScoreGroupDtoSchema).max(RULE_GRAPH_LIMITS.NODES - 1)
      }),
      z.strictObject({
        kind: z.literal('ENTITY_ORDER'),
        evidence: initiativeExecutionEvidenceDtoSchema,
        entityKind: z.enum(['ACTOR', 'SIDE']),
        order: initiativePendingOrderDtoSchema
      }),
      z.strictObject({
        kind: z.literal('SIDE_ACTOR_ORDER'),
        evidence: initiativeExecutionEvidenceDtoSchema,
        orderedSideIds: z.array(uuidSchema).min(1).max(RULE_GRAPH_LIMITS.NODES),
        order: initiativePendingOrderDtoSchema
      })
    ])
  })
  .superRefine((context, refinement) => {
    const hasAdvance = context.root.initiativeAdvance !== undefined
    const hasOutgoingTurn = context.root.outgoingTurn !== undefined
    if (hasAdvance !== hasOutgoingTurn) {
      refinement.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['root'],
        message: 'Each-round initiative must retain both advancement and outgoing-turn evidence.'
      })
      return
    }
    if (!hasAdvance) return
    const advance = context.root.initiativeAdvance!
    if (
      context.root.commandType !== 'ADVANCE_TURN' ||
      advance.kind !== 'ROUND_WRAP' ||
      advance.cadence !== 'EACH_ROUND' ||
      advance.nextRound !== context.root.round
    )
      refinement.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['root', 'initiativeAdvance'],
        message: 'Pending each-round initiative must match its exact round-wrap command.'
      })
  })

/** Server-only interstitial control evidence retained when a failed TEST uses Legendary Resistance. */
const directActionLegendaryResistanceOutcomeAuditDtoSchema = z.strictObject({
  choiceExecution: z.lazy(() => serverCompletedRuleExecutionDtoSchema),
  selection: z.enum(['DECLINE', 'USE']),
  originalExecutionChecksum: checksumSchema,
  targetStateChecksum: checksumSchema,
  resistance: z.strictObject({
    targetActorId: uuidSchema,
    ownerFeatureId: authoredIdentifierSchema,
    chargeId: authoredIdentifierSchema,
    featureCost: z.number().int().positive(),
    poolBefore: z.number().int().nonnegative(),
    poolRemaining: z.number().int().nonnegative(),
    definitionId: uuidSchema,
    definitionVersion: z.number().int().positive(),
    definitionChecksum: checksumSchema,
    choiceGraphDefinitionId: uuidSchema,
    choiceGraphDefinitionVersion: z.number().int().positive(),
    choiceGraphDefinitionChecksum: checksumSchema,
    useOutput: portNameSchema,
    useOptionId: checksumSchema,
    selectionChecksum: checksumSchema
  }),
  d20: z.lazy(() => serverRuleExecutionD20PolicyDtoSchema)
})

/** Server-sealed direct-action phase identity. Legacy pending actions retain null. */
const directActionTwoPhaseDtoSchema = z
  .discriminatedUnion('phase', [
    z.strictObject({
      phase: z.literal('TEST'),
      compilerSourceChecksum: checksumSchema,
      testTemplateChecksum: checksumSchema,
      boundFactsChecksum: checksumSchema
    }),
    z.strictObject({
      phase: z.literal('OUTCOME'),
      compilerSourceChecksum: checksumSchema,
      testTemplateChecksum: checksumSchema,
      outcomeTemplateChecksum: checksumSchema,
      boundFactsChecksum: checksumSchema,
      testExecution: z.lazy(() => serverCompletedRuleExecutionDtoSchema),
      testExecutionChecksum: checksumSchema,
      /**
       * The one exact nested save request allowed inside a direct-action OUTCOME.
       * Dice evidence remains ungoverned by this d20 policy.
       */
      nestedOutcomeD20: z
        .lazy(() => serverRuleExecutionD20PolicyDtoSchema)
        .nullable()
        .default(null),
      /** Server-sealed evidence for the nested OUTCOME d20, retained through terminal replay. */
      nestedOutcomeD20Evidence: z
        .lazy(() => serverRuleExecutionNestedD20EvidenceDtoSchema)
        .nullable()
        .default(null),
      /** Null unless an interstitial Legendary Resistance choice preceded this OUTCOME. */
      legendaryResistance: directActionLegendaryResistanceOutcomeAuditDtoSchema
        .nullable()
        .default(null),
      /** Server-sealed d20 evidence from the completed TEST phase. */
      testRollEvidence: z
        .strictObject({
          requestId: z.string().min(1).max(256),
          rollMode: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE']),
          rawFaces: z.array(pendingD20FaceSchema).min(1).max(2),
          selectedNatural: pendingD20FaceSchema
        })
        .superRefine((value, context) => {
          const expectedFaces = value.rollMode === 'NORMAL' ? 1 : 2
          const expectedSelected =
            value.rollMode === 'ADVANTAGE'
              ? Math.max(...value.rawFaces)
              : value.rollMode === 'DISADVANTAGE'
                ? Math.min(...value.rawFaces)
                : value.rawFaces[0]
          if (value.rawFaces.length !== expectedFaces || value.selectedNatural !== expectedSelected)
            context.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'TEST roll evidence does not match its pinned roll mode.'
            })
        })
    })
  ])
  .superRefine((value, context) => {
    if (value.phase !== 'OUTCOME') return
    const policy = value.nestedOutcomeD20
    const evidence = value.nestedOutcomeD20Evidence
    if (policy === null && evidence !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['nestedOutcomeD20Evidence'],
        message: 'Nested OUTCOME d20 evidence requires a sealed policy.'
      })
      return
    }
    if (
      policy !== null &&
      evidence !== null &&
      (evidence.requestNodeId !== policy.requestNodeId ||
        evidence.rollMode !== policy.rollMode ||
        evidence.contributorChecksum !== policy.contributorChecksum ||
        evidence.modifier !== policy.modifier ||
        evidence.defenseOrDc !== policy.dc)
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['nestedOutcomeD20Evidence'],
        message: 'Nested OUTCOME d20 evidence does not match its sealed policy.'
      })
  })

/**
 * Immutable pending evidence context for an optional-combat contested action.
 * It retains identities and currentness pins only; the executable contest graph
 * is re-created from its sealed System policy pin when the request resumes.
 */
const optionalCombatContestD20ContributorDtoSchema = z.strictObject({
  sourceId: z.string().trim().min(1).max(240),
  grantId: z.string().trim().min(1).max(240).nullable(),
  domainKey: z.string().trim().min(1).max(240).nullable(),
  influence: z.enum(['ADVANTAGE', 'DISADVANTAGE'])
})

const optionalCombatContestD20PolicyDtoSchema = z
  .strictObject({
    actorId: uuidSchema,
    requestNodeId: localNodeIdSchema,
    rollMode: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE']),
    contributors: z
      .array(optionalCombatContestD20ContributorDtoSchema)
      .max(RULE_GRAPH_LIMITS.NODES),
    contributorChecksum: checksumSchema,
    modifier: z.number().int()
  })
  .superRefine((value, context) => {
    if (
      value.contributors.some(
        (contributor, index) =>
          index > 0 &&
          compareCanonicalD20Contributors(value.contributors[index - 1]!, contributor) >= 0
      )
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contributors'],
        message: 'Optional-combat contest contributors must be strictly sorted and unique.'
      })
    }
    if (checksumRuleDocument(value.contributors) !== value.contributorChecksum) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contributorChecksum'],
        message: 'Optional-combat contest contributor checksum is invalid.'
      })
    }
  })

const optionalCombatContestActionEconomyReceiptDtoSchema = z
  .strictObject({
    definitionId: uuidSchema,
    definitionVersion: z.number().int().positive(),
    definitionChecksum: checksumSchema,
    maximum: z.number().int().positive(),
    beforeUsed: z.number().int().nonnegative()
  })
  .nullable()

const optionalCombatContestRollEvidenceDtoSchema = z
  .strictObject({
    requestId: z.string().trim().min(1).max(256),
    rawFaces: z.array(pendingD20FaceSchema).min(1).max(2)
  })
  .nullable()

/**
 * Frozen movement suffix retained while a selected Overrun or Tumble contest
 * awaits evidence. It is factual continuation state, never executable graph
 * data; the application resumes the existing spatial/reaction pipeline from it.
 */
const optionalCombatPassageContinuationDtoSchema = z
  .strictObject({
    root: spatialMovementPendingRootDtoSchema,
    blockerActorId: uuidSchema,
    blockerTokenId: uuidSchema,
    contact: spatialPointDtoSchema,
    contactPathDistance: z.number().finite().nonnegative(),
    blockerCurrentnessChecksum: checksumSchema,
    nextPassageStop: movementPassageStopDtoSchema.nullable().optional(),
    spatialSelectionChecksum: checksumSchema,
    spatialCurrentnessChecksum: checksumSchema,
    completedSpatialExecutions: z
      .array(z.lazy(() => spatialMovementExecutionDtoSchema))
      .max(MAX_SPATIAL_CANDIDATES),
    appliedSpatialPrefix: z.lazy(() => storedRuleExecutionResultDtoSchema).nullable(),
    completedReactionExecutions: z
      .array(movementReactionActionExecutionDtoSchema)
      .max(RULE_GRAPH_LIMITS.NODES)
      .default([]),
    remainingSpatialCandidates: z
      .array(spatialPendingCandidateDtoSchema)
      .max(MAX_SPATIAL_CANDIDATES),
    reactionTimeline: movementReactionTimelineDtoSchema
  })
  .superRefine((value, context) => {
    validateSpatialMovementPendingRoot(value.root, context, ['root'])
    if (Math.abs(value.root.pathStartDistance - value.contactPathDistance) > 1e-8) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contactPathDistance'],
        message: 'Passage continuation must begin at its sealed contact distance.'
      })
    }
    if (!spatialPointEquals(value.root.currentPosition, value.contact)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contact'],
        message: 'Passage continuation contact must match the committed movement position.'
      })
    }
    if (value.nextPassageStop) {
      const stop = spatialPathPointAtDistance(
        value.root.originalPath,
        value.nextPassageStop.pathDistance
      )
      if (
        value.nextPassageStop.pathDistance <= value.contactPathDistance + 1e-8 ||
        stop === null ||
        !spatialPointEquals(stop, value.nextPassageStop.contact)
      )
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['nextPassageStop'],
          message: 'A remaining hostile passage stop must retain canonical path order.'
        })
    }
  })

const optionalCombatPassageSelectionDtoSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('OVERRUN'),
    economy: z.enum(['ACTION', 'BONUS_ACTION']),
    defenderCheckDefinitionId: uuidSchema
  }),
  z.strictObject({
    kind: z.literal('TUMBLE'),
    economy: z.enum(['ACTION', 'BONUS_ACTION']),
    defenderCheckDefinitionId: uuidSchema
  }),
  z.strictObject({
    kind: z.literal('DISARM'),
    heldItemId: uuidSchema,
    defenderCheckDefinitionId: uuidSchema,
    heldItemStateChecksum: checksumSchema
  }),
  z.strictObject({
    kind: z.literal('SHOVE_ASIDE'),
    defenderCheckDefinitionId: uuidSchema,
    destination: z.strictObject({ x: z.number().finite(), y: z.number().finite() }),
    displacement: z.strictObject({
      amount: z.literal(5),
      unit: z.literal('FEET'),
      sceneUnits: z.number().finite().positive()
    }),
    sceneId: uuidSchema,
    sceneVersion: z.number().int().nonnegative(),
    targetTokenId: uuidSchema,
    stateChecksum: checksumSchema
  })
])

export const serverOptionalCombatContestPendingContextDtoSchema = z
  .strictObject({
    kind: z.literal('ENCOUNTER_OPTIONAL_COMBAT_CONTEST'),
    schemaVersion: z.literal(1),
    actionKind: z.enum(['DISARM', 'SHOVE_ASIDE', 'OVERRUN', 'TUMBLE']),
    actionId: z.string().trim().min(1).max(240),
    sourceActorId: uuidSchema,
    targetActorId: uuidSchema,
    /** Sealed controller identity for the initiator evidence request. */
    initiatorControllerCharacterId: uuidSchema.nullable(),
    sceneContext: z
      .strictObject({
        sceneId: uuidSchema,
        sceneVersion: z.number().int().nonnegative(),
        sourceTokenId: uuidSchema,
        targetTokenId: uuidSchema
      })
      .nullable(),
    positionalDependencyChecksum: checksumSchema.nullable(),
    optionalCombat: z.strictObject({
      snapshotChecksum: checksumSchema,
      definitionId: uuidSchema,
      definitionVersion: z.number().int().positive(),
      definitionChecksum: checksumSchema,
      moduleKey: capabilityKeySchema,
      moduleContractVersion: contractVersionSchema
    }),
    contestGraph: z.strictObject({
      definitionId: uuidSchema,
      checksum: checksumSchema,
      identityChecksum: checksumSchema
    }),
    optionId: checksumSchema,
    selectionContractChecksum: checksumSchema,
    resolvedSelectionChecksum: checksumSchema,
    source: z.discriminatedUnion('kind', [
      z.strictObject({
        kind: z.literal('CHARACTER_ACTION'),
        characterId: uuidSchema,
        streamVersion: z.number().int().nonnegative(),
        projectionChecksum: checksumSchema,
        mechanicalContextChecksum: checksumSchema,
        publishedDefinitionId: uuidSchema,
        publishedDefinitionChecksum: checksumSchema
      }),
      z.strictObject({
        kind: z.literal('ENCOUNTER_FEATURE'),
        creatureSourceId: uuidSchema,
        sourceRevision: z.number().int().positive(),
        sourceVersionId: uuidSchema,
        sourceChecksum: checksumSchema,
        ownerFeatureId: uuidSchema,
        featureOptionId: uuidSchema.nullable(),
        effectId: uuidSchema,
        authoredEffectChecksum: checksumSchema,
        compiledEffectChecksum: checksumSchema,
        publishedDefinitionId: uuidSchema,
        publishedDefinitionChecksum: checksumSchema
      }),
      z.strictObject({
        kind: z.literal('OPTIONAL_COMBAT_DEFINITION'),
        definitionId: uuidSchema,
        definitionVersion: z.number().int().positive(),
        definitionChecksum: checksumSchema,
        moduleKey: capabilityKeySchema,
        moduleContractVersion: contractVersionSchema
      })
    ]),
    target: z.discriminatedUnion('kind', [
      z.strictObject({
        kind: z.literal('CHARACTER'),
        characterId: uuidSchema,
        streamVersion: z.number().int().nonnegative(),
        projectionChecksum: checksumSchema,
        mechanicalContextChecksum: checksumSchema,
        stateChecksum: checksumSchema
      }),
      z.strictObject({ kind: z.literal('ENCOUNTER_ACTOR'), currentnessChecksum: checksumSchema })
    ]),
    initiator: optionalCombatContestD20PolicyDtoSchema,
    defender: optionalCombatContestD20PolicyDtoSchema.extend({ checkDefinitionId: uuidSchema }),
    rollEvidence: z
      .strictObject({
        initiator: optionalCombatContestRollEvidenceDtoSchema.default(null),
        defender: optionalCombatContestRollEvidenceDtoSchema.default(null)
      })
      .default({ initiator: null, defender: null }),
    selection: optionalCombatPassageSelectionDtoSchema,
    actionEconomy: optionalCombatContestActionEconomyReceiptDtoSchema,
    movementContinuation: optionalCombatPassageContinuationDtoSchema.nullable().optional()
  })
  .superRefine((value, context) => {
    if (value.sourceActorId === value.targetActorId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetActorId'],
        message: 'Optional-combat contest participants must be distinct.'
      })
    }
    if (
      value.initiator.actorId !== value.sourceActorId ||
      value.defender.actorId !== value.targetActorId
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['initiator', 'actorId'],
        message: 'Optional-combat contest policy participants must match the selected actors.'
      })
    }
    if (value.defender.checkDefinitionId !== value.selection.defenderCheckDefinitionId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['selection'],
        message: 'Optional-combat contest selection does not match its sealed defender check.'
      })
    }
    if (
      (value.actionKind === 'DISARM' && value.selection.kind !== 'DISARM') ||
      (value.actionKind === 'SHOVE_ASIDE' && value.selection.kind !== 'SHOVE_ASIDE') ||
      (value.actionKind === 'OVERRUN' && value.selection.kind !== 'OVERRUN') ||
      (value.actionKind === 'TUMBLE' && value.selection.kind !== 'TUMBLE')
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['selection'],
        message: 'Optional-combat contest action and selection kinds must match.'
      })
    }
    const passageAction = value.actionKind === 'OVERRUN' || value.actionKind === 'TUMBLE'
    if (
      passageAction !==
      (value.movementContinuation !== null && value.movementContinuation !== undefined)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['movementContinuation'],
        message: 'Only passage contests retain a frozen movement continuation.'
      })
    }
    const requireRollEvidence = (
      evidence: z.infer<typeof optionalCombatContestRollEvidenceDtoSchema>,
      policy: z.infer<typeof optionalCombatContestD20PolicyDtoSchema>,
      path: 'initiator' | 'defender'
    ) => {
      if (evidence === null) return
      const expectedFaces = policy.rollMode === 'NORMAL' ? 1 : 2
      if (evidence.rawFaces.length !== expectedFaces) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['rollEvidence', path, 'rawFaces'],
          message: 'Optional-combat contest evidence does not match its sealed roll mode.'
        })
      }
      if (evidence.requestId.length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['rollEvidence', path, 'requestId'],
          message: 'Optional-combat contest evidence request is invalid.'
        })
      }
    }
    requireRollEvidence(value.rollEvidence.initiator, value.initiator, 'initiator')
    requireRollEvidence(value.rollEvidence.defender, value.defender, 'defender')
    if (value.rollEvidence.defender !== null && value.rollEvidence.initiator === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rollEvidence', 'defender'],
        message: 'Optional-combat contest defender evidence requires initiator evidence.'
      })
    }
  })

const encounterCharacterRuleActionPendingContextDtoSchema = z.strictObject({
  kind: z.literal('ENCOUNTER_CHARACTER_RULE_ACTION'),
  schemaVersion: z.literal(1),
  actionId: z.string().trim().min(1).max(240),
  /** Exact frozen Scene dependency when this action was positional. */
  sceneContext: z
    .strictObject({
      sceneId: uuidSchema,
      sceneVersion: z.number().int().nonnegative(),
      sourceTokenId: uuidSchema,
      targetTokenId: uuidSchema
    })
    .nullable()
    .optional()
    .default(null),
  /** Server-derived bounded positional currentness for a paused action. */
  positionalDependencyChecksum: checksumSchema.nullable().optional().default(null),
  sourceActorId: uuidSchema,
  targetActorId: uuidSchema,
  sourceCharacterId: uuidSchema,
  targetCharacterId: uuidSchema,
  sourceCharacterStreamVersion: z.number().int().min(0),
  targetCharacterStreamVersion: z.number().int().min(0),
  sourceProjectionChecksum: checksumSchema,
  targetProjectionChecksum: checksumSchema,
  sourceMechanicalContextChecksum: checksumSchema,
  targetMechanicalContextChecksum: checksumSchema,
  publishedDefinitionId: uuidSchema,
  publishedDefinitionChecksum: checksumSchema,
  /**
   * Exact authored attack/range facts retained for post-action rules such
   * as Cleaving. Legacy paused actions deliberately retain null.
   */
  postActionTriggerFacts: z
    .strictObject({
      attackKind: z.enum(['MELEE', 'RANGED', 'OTHER']),
      range: rangeDtoSchema
    })
    .nullable()
    .optional()
    .default(null),
  actionEconomy: z
    .strictObject({
      definitionId: uuidSchema,
      definitionVersion: z.number().int().positive(),
      definitionChecksum: checksumSchema,
      maximum: z.number().int().positive(),
      beforeUsed: z.number().int().nonnegative()
    })
    .nullable()
    .default(null),
  /** Sealed TEST/OUTCOME identity for a v3 Character action; legacy actions retain null. */
  twoPhase: directActionTwoPhaseDtoSchema.nullable().optional().default(null),
  targetStateChecksum: checksumSchema,
  d20: z
    .strictObject({
      rollMode: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE']),
      contributors: z
        .array(
          z.strictObject({
            sourceId: z.string().trim().min(1).max(240),
            grantId: z.string().trim().min(1).max(240).nullable(),
            domainKey: z.string().trim().min(1).max(240).nullable(),
            influence: z.enum(['ADVANTAGE', 'DISADVANTAGE'])
          })
        )
        .max(RULE_GRAPH_LIMITS.NODES),
      contributorChecksum: checksumSchema,
      modifier: z.number().int(),
      defenseOrDc: z.number().int()
    })
    .nullable()
})

/**
 * Character-authored direct action against a mutable Creature or Custom
 * Encounter actor. Character targets retain the established Character lane.
 */
const encounterActorRuleActionPendingContextDtoSchema = z.strictObject({
  kind: z.literal('ENCOUNTER_ACTOR_RULE_ACTION'),
  schemaVersion: z.literal(1),
  actionId: z.string().trim().min(1).max(240),
  /** Exact frozen Scene dependency when this action was positional. */
  sceneContext: z
    .strictObject({
      sceneId: uuidSchema,
      sceneVersion: z.number().int().nonnegative(),
      sourceTokenId: uuidSchema,
      targetTokenId: uuidSchema
    })
    .nullable()
    .optional()
    .default(null),
  /** Server-derived bounded positional currentness for a paused action. */
  positionalDependencyChecksum: checksumSchema.nullable().optional().default(null),
  sourceActorId: uuidSchema,
  targetActorId: uuidSchema,
  sourceCharacterId: uuidSchema,
  sourceCharacterStreamVersion: z.number().int().min(0),
  sourceProjectionChecksum: checksumSchema,
  sourceMechanicalContextChecksum: checksumSchema,
  targetCurrentnessChecksum: checksumSchema,
  publishedDefinitionId: uuidSchema,
  publishedDefinitionChecksum: checksumSchema,
  actionEconomy: z
    .strictObject({
      definitionId: uuidSchema,
      definitionVersion: z.number().int().positive(),
      definitionChecksum: checksumSchema,
      maximum: z.number().int().positive(),
      beforeUsed: z.number().int().nonnegative()
    })
    .nullable()
    .default(null),
  twoPhase: directActionTwoPhaseDtoSchema.nullable().optional().default(null),
  phase: z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('ACTION_EVIDENCE'),
      d20: z
        .strictObject({
          rollMode: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE']),
          contributors: z
            .array(
              z.strictObject({
                sourceId: z.string().trim().min(1).max(240),
                grantId: z.string().trim().min(1).max(240).nullable(),
                domainKey: z.string().trim().min(1).max(240).nullable(),
                influence: z.enum(['ADVANTAGE', 'DISADVANTAGE'])
              })
            )
            .max(RULE_GRAPH_LIMITS.NODES),
          contributorChecksum: checksumSchema,
          modifier: z.number().int(),
          defenseOrDc: z.number().int()
        })
        .nullable()
    }),
    z.strictObject({
      kind: z.literal('LEGENDARY_RESISTANCE_CHOICE'),
      originalExecution: z.lazy(() => serverCompletedRuleExecutionDtoSchema),
      originalD20: z.lazy(() => serverRuleExecutionD20EvidenceDtoSchema),
      /** Exact TEST policy retained for a later sealed OUTCOME continuation. */
      d20: z.lazy(() => serverRuleExecutionD20PolicyDtoSchema),
      originalExecutionChecksum: checksumSchema,
      targetStateChecksum: checksumSchema,
      resistance: z.strictObject({
        targetActorId: uuidSchema,
        ownerFeatureId: authoredIdentifierSchema,
        chargeId: authoredIdentifierSchema,
        featureCost: z.number().int().positive(),
        poolBefore: z.number().int().nonnegative(),
        poolRemaining: z.number().int().nonnegative(),
        definitionId: uuidSchema,
        definitionVersion: z.number().int().positive(),
        definitionChecksum: checksumSchema,
        choiceGraphDefinitionId: uuidSchema,
        choiceGraphDefinitionVersion: z.number().int().positive(),
        choiceGraphDefinitionChecksum: checksumSchema,
        useOutput: portNameSchema,
        useOptionId: checksumSchema,
        selectionChecksum: checksumSchema
      })
    })
  ])
})

/**
 * Sealed Character spell-cast source.  It deliberately does not reuse the
 * Character-action arm: spell provenance and CAST_SPELL economy must survive
 * an Assisted pause without becoming optional action fields.
 */
const encounterActorSpellCastPendingContextDtoSchema =
  encounterActorRuleActionPendingContextDtoSchema.extend({
    kind: z.literal('ENCOUNTER_ACTOR_SPELL_CAST'),
    spell: z.strictObject({
      spellId: uuidSchema,
      versionId: uuidSchema,
      version: z.number().int().positive(),
      checksum: checksumSchema,
      sourceKind: z.enum([
        'BACKGROUND',
        'CLASS',
        'FEAT',
        'FEATURE',
        'ITEM',
        'OPTION',
        'RACE',
        'SUBCLASS'
      ]),
      sourceInstanceId: uuidSchema,
      castLevel: z.number().int().min(0).max(9),
      castMode: z.enum(['SPELL_SLOT', 'AT_WILL', 'RITUAL', 'FIXED_LEVEL', 'LIMITED_USE']),
      slotKey: z.string().trim().min(1).max(1_000).nullable(),
      resourceOwnerKey: z.string().trim().min(1).max(1_000).nullable(),
      effectId: uuidSchema
    })
  })

/**
 * Immutable Creature Feature action. This is intentionally distinct from
 * ENCOUNTER_ACTOR_RULE_ACTION so existing Character occurrences retain
 * their byte-compatible source/currentness contract.
 */
const encounterCreatureRuleActionPendingContextDtoSchema = z.strictObject({
  kind: z.literal('ENCOUNTER_CREATURE_RULE_ACTION'),
  schemaVersion: z.literal(1),
  actionId: z.string().trim().min(1).max(240),
  sceneContext: z
    .strictObject({
      sceneId: uuidSchema,
      sceneVersion: z.number().int().nonnegative(),
      sourceTokenId: uuidSchema,
      targetTokenId: uuidSchema
    })
    .nullable()
    .optional()
    .default(null),
  positionalDependencyChecksum: checksumSchema.nullable().optional().default(null),
  sourceActorId: uuidSchema,
  targetActorId: uuidSchema,
  creatureSourceId: uuidSchema,
  sourceRevision: z.number().int().positive(),
  sourceVersionId: uuidSchema,
  sourceChecksum: checksumSchema,
  ownerFeatureId: uuidSchema,
  featureOptionId: uuidSchema.nullable(),
  effectId: uuidSchema,
  authoredEffectChecksum: checksumSchema,
  compiledEffectChecksum: checksumSchema,
  targetCurrentnessChecksum: checksumSchema,
  publishedDefinitionId: uuidSchema,
  publishedDefinitionChecksum: checksumSchema,
  actionEconomy: z
    .strictObject({
      definitionId: uuidSchema,
      definitionVersion: z.number().int().positive(),
      definitionChecksum: checksumSchema,
      maximum: z.number().int().positive(),
      beforeUsed: z.number().int().nonnegative()
    })
    .nullable()
    .default(null),
  twoPhase: directActionTwoPhaseDtoSchema.nullable().optional().default(null),
  phase: z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('ACTION_EVIDENCE'),
      d20: z
        .strictObject({
          rollMode: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE']),
          contributors: z
            .array(
              z.strictObject({
                sourceId: z.string().trim().min(1).max(240),
                grantId: z.string().trim().min(1).max(240).nullable(),
                domainKey: z.string().trim().min(1).max(240).nullable(),
                influence: z.enum(['ADVANTAGE', 'DISADVANTAGE'])
              })
            )
            .max(RULE_GRAPH_LIMITS.NODES),
          contributorChecksum: checksumSchema,
          modifier: z.number().int(),
          defenseOrDc: z.number().int()
        })
        .nullable()
    }),
    z.strictObject({
      kind: z.literal('LEGENDARY_RESISTANCE_CHOICE'),
      originalExecution: z.lazy(() => serverCompletedRuleExecutionDtoSchema),
      originalD20: z.lazy(() => serverRuleExecutionD20EvidenceDtoSchema),
      d20: z.lazy(() => serverRuleExecutionD20PolicyDtoSchema),
      originalExecutionChecksum: checksumSchema,
      targetStateChecksum: checksumSchema,
      resistance: z.strictObject({
        targetActorId: uuidSchema,
        ownerFeatureId: authoredIdentifierSchema,
        chargeId: authoredIdentifierSchema,
        featureCost: z.number().int().positive(),
        poolBefore: z.number().int().nonnegative(),
        poolRemaining: z.number().int().nonnegative(),
        definitionId: uuidSchema,
        definitionVersion: z.number().int().positive(),
        definitionChecksum: checksumSchema,
        choiceGraphDefinitionId: uuidSchema,
        choiceGraphDefinitionVersion: z.number().int().positive(),
        choiceGraphDefinitionChecksum: checksumSchema,
        useOutput: portNameSchema,
        useOptionId: checksumSchema,
        selectionChecksum: checksumSchema
      })
    })
  ])
})

const encounterConcentrationDamageCheckPendingContextDtoSchema = z
  .strictObject({
    kind: z.literal('ENCOUNTER_CONCENTRATION_DAMAGE_CHECK'),
    schemaVersion: z.literal(1),
    parentOccurrenceId: uuidSchema,
    parentCommandFingerprint: checksumSchema,
    finalizedDamageEnvelopeChecksum: checksumSchema,
    application: z.strictObject({
      ordinal: z
        .number()
        .int()
        .min(0)
        .max(RULE_GRAPH_LIMITS.NODES - 1),
      sourceNodeId: z.string().trim().min(1).max(240),
      sourceOperationKey: z.string().trim().min(1).max(240),
      targetActorId: uuidSchema,
      appliedAmount: z.number().int().positive(),
      damageTypeId: uuidSchema
    }),
    maintainedState: z.strictObject({
      id: uuidSchema,
      version: z.number().int().min(0),
      maintenanceDefinitionId: uuidSchema,
      descriptorChecksum: checksumSchema
    }),
    concentrationDefinition: z.strictObject({
      id: uuidSchema,
      checksum: checksumSchema
    }),
    save: z.strictObject({
      savingThrowAbilityDefinitionId: uuidSchema,
      modifier: z.number().int(),
      rollMode: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE']),
      contributors: canonicalConcentrationContributorsDtoSchema,
      contributorChecksum: checksumSchema
    }),
    targetCharacter: z.strictObject({
      streamVersion: z.number().int().min(0),
      baseProjectionChecksum: checksumSchema,
      campaignOverlayChecksum: checksumSchema,
      mechanicalContextChecksum: checksumSchema
    }),
    systemVocabularySnapshot: z.strictObject({
      id: uuidSchema,
      version: z.number().int().min(1),
      checksum: checksumSchema
    }),
    contextChecksum: checksumSchema,
    remaining: z
      .array(
        z.strictObject({
          ordinal: z
            .number()
            .int()
            .min(0)
            .max(RULE_GRAPH_LIMITS.NODES - 1),
          sourceNodeId: z.string().trim().min(1).max(240),
          sourceOperationKey: z.string().trim().min(1).max(240),
          targetActorId: uuidSchema,
          appliedAmount: z.number().int().positive(),
          damageTypeId: uuidSchema,
          maintainedStateId: uuidSchema
        })
      )
      .max(RULE_GRAPH_LIMITS.NODES)
  })
  .superRefine((value, context) => {
    let prior = `${value.application.ordinal.toString().padStart(4, '0')}:${value.application.sourceNodeId}:${value.application.sourceOperationKey}`
    for (const [index, remaining] of value.remaining.entries()) {
      const current = `${remaining.ordinal.toString().padStart(4, '0')}:${remaining.sourceNodeId}:${remaining.sourceOperationKey}`
      if (current <= prior)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['remaining', index],
          message: 'Remaining concentration checks must use canonical application order.'
        })
      prior = current
    }
  })

const noPendingApplicationContextDtoSchema = z.strictObject({ kind: z.literal('NONE') })

export type ServerRuleExecutionPendingApplicationContextDto =
  | z.infer<typeof noPendingApplicationContextDtoSchema>
  | z.infer<typeof turnEffectPendingContextDtoSchema>
  | z.infer<typeof turnRechargePendingContextDtoSchema>
  | z.infer<typeof spatialPendingContextDtoSchema>
  | z.infer<typeof movementReactionPendingContextDtoSchema>
  | z.infer<typeof legendaryActionEvidencePendingContextDtoSchema>
  | z.infer<typeof encounterInitiativePendingContextDtoSchema>
  | z.infer<typeof serverOptionalCombatContestPendingContextDtoSchema>
  | z.infer<typeof encounterCharacterRuleActionPendingContextDtoSchema>
  | z.infer<typeof encounterActorRuleActionPendingContextDtoSchema>
  | z.infer<typeof encounterActorSpellCastPendingContextDtoSchema>
  | z.infer<typeof encounterCreatureRuleActionPendingContextDtoSchema>
  | z.infer<typeof encounterConcentrationDamageCheckPendingContextDtoSchema>

const serverRuleExecutionPendingApplicationContextDtoSchemaImpl: z.ZodType<ServerRuleExecutionPendingApplicationContextDto> =
  z
    .discriminatedUnion('kind', [
      noPendingApplicationContextDtoSchema,
      turnEffectPendingContextDtoSchema,
      turnRechargePendingContextDtoSchema,
      spatialPendingContextDtoSchema,
      movementReactionPendingContextDtoSchema,
      legendaryActionEvidencePendingContextDtoSchema,
      encounterInitiativePendingContextDtoSchema,
      serverOptionalCombatContestPendingContextDtoSchema,
      encounterCharacterRuleActionPendingContextDtoSchema,
      encounterActorRuleActionPendingContextDtoSchema,
      encounterActorSpellCastPendingContextDtoSchema,
      encounterCreatureRuleActionPendingContextDtoSchema,
      encounterConcentrationDamageCheckPendingContextDtoSchema
    ])

    .superRefine((value, context) => {
      if (
        (value.kind !== 'ENCOUNTER_ACTOR_RULE_ACTION' &&
          value.kind !== 'ENCOUNTER_ACTOR_SPELL_CAST' &&
          value.kind !== 'ENCOUNTER_CREATURE_RULE_ACTION') ||
        value.phase.kind !== 'LEGENDARY_RESISTANCE_CHOICE'
      )
        return
      const { originalExecution, originalD20, originalExecutionChecksum } = value.phase
      const d20RequestTraces = originalExecution.evidence.trace.filter(
        (trace) =>
          trace.operation.key === 'evidence.integer-range' &&
          trace.operation.contractVersion === 1 &&
          trace.inputs.min === 1 &&
          trace.inputs.max === 20 &&
          trace.evidence?.kind === 'INTEGER_RANGE'
      )
      const d20ResultTraces = originalExecution.evidence.trace.filter(
        (trace) =>
          typeof trace.inputs.naturalD20 === 'number' &&
          typeof trace.inputs.modifier === 'number' &&
          typeof trace.inputs.threshold === 'number' &&
          typeof trace.inputs.contributorChecksum === 'string' &&
          typeof trace.outputs.contributorChecksum === 'string' &&
          typeof trace.outputs.total === 'number' &&
          typeof trace.outputs.resultPath === 'string'
      )
      const hasExactD20Evidence =
        d20RequestTraces.length === 1 &&
        d20ResultTraces.length === 1 &&
        d20RequestTraces.filter(
          (trace) =>
            trace.evidence?.requestId === originalD20.requestId &&
            trace.evidence.value === originalD20.selectedNatural
        ).length === 1 &&
        d20ResultTraces.filter(
          (trace) =>
            trace.inputs.naturalD20 === originalD20.selectedNatural &&
            trace.inputs.modifier === originalD20.modifier &&
            trace.inputs.threshold === originalD20.defenseOrDc &&
            trace.inputs.contributorChecksum === originalD20.contributorChecksum &&
            trace.outputs.contributorChecksum === originalD20.contributorChecksum &&
            trace.outputs.total === originalD20.total &&
            trace.outputs.resultPath === originalD20.resultPath
        ).length === 1
      if (
        checksumRuleDocument(originalExecution) !== originalExecutionChecksum ||
        originalExecution.outputs.resultPath !== 'ON_SAVE_FAIL' ||
        originalExecution.evidence.outputs.resultPath !== 'ON_SAVE_FAIL' ||
        originalD20.resultPath !== 'ON_SAVE_FAIL' ||
        !hasExactD20Evidence
      )
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['phase'],
          message: 'Legendary Resistance pending action evidence is invalid.'
        })
    })

export const serverRuleExecutionPendingApplicationContextDtoSchema: z.ZodType<
  z.infer<typeof serverRuleExecutionPendingApplicationContextDtoSchemaImpl>
> = serverRuleExecutionPendingApplicationContextDtoSchemaImpl

export type ServerKernelRuleExecutionPendingSnapshotDto = ServerRuleExecutionContinuationDto & {
  snapshotKind: 'KERNEL_EVIDENCE'
  optionalCombatSnapshotChecksum?: string | null
  applicationContext: ServerRuleExecutionPendingApplicationContextDto
  phaseReceipts?: RuleExecutionPhaseReceiptsDto
}

/**
 * Aggregate-owned intent choice for Speed Factor initiative.  It retains the
 * same frozen Encounter root/staged participant snapshot as subsequent score
 * evaluation, but intentionally carries no executable graph or dice evidence.
 */
const initiativeDeclarationAggregateChoicePendingContextDtoSchema = z
  .strictObject({
    kind: z.literal('ENCOUNTER_INITIATIVE_DECLARATION'),
    schemaVersion: z.literal(1),
    root: encounterInitiativePendingContextDtoSchema.shape.root,
    request: serverInitiativeDeclarationRequestDtoSchema
  })
  .superRefine((value, context) => {
    const participant = value.root.stagedInitiativeRoundState.participants.find(
      (candidate) => candidate.actorId === value.request.actorId
    )
    if (
      value.request.encounterId !== value.root.stagedInitiativeRoundState.round.encounterId ||
      value.request.round !== value.root.round ||
      !participant ||
      participant.version !== value.request.participantExpectedVersion
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['request'],
        message: 'Initiative declaration request must bind its exact staged Encounter participant.'
      })
    }
  })

/**
 * A completed action may expose one bounded, human-confirmed Cleaving step.
 * It retains facts only: the original action receipt is terminal and neither
 * executable graphs nor damage formulas cross this aggregate-choice boundary.
 */
type OptionalCombatCleavingChoicePendingContextDto = {
  kind: 'ENCOUNTER_OPTIONAL_COMBAT_CLEAVING'
  schemaVersion: 1
  parentOccurrenceId: string
  parentResultChecksum: string
  sourceActorId: string
  sourceControllerCharacterId: string | null
  action: {
    actionId: string
    publishedDefinitionId: string
    publishedDefinitionChecksum: string
    attackKind: 'MELEE' | 'RANGED' | 'OTHER'
    range: RangeDto
  }
  sourceCurrentness:
    | {
        kind: 'CHARACTER'
        actorId: string
        characterId: string
        streamVersion: number
        projectionChecksum: string
        mechanicalContextChecksum: string
      }
    | {
        kind: 'ENCOUNTER_ACTOR'
        actorId: string
        sourceRevision: number
        sourceVersionId: string
        sourceChecksum: string
        stateChecksum: string
      }
  initialTargetActorId: string
  chainStep: number
  optionalCombat: { definitionId: string; definitionVersion: number; definitionChecksum: string }
  scene: {
    sceneId: string
    sceneVersion: number
    effectiveGridChecksum: string
    sourceTokenId: string
  }
  originalAttack: { total: number; naturalRoll: number }
  damage: {
    sourceNodeId: string
    sourceOperationKey: string
    damageTypeId: string
    resolvedAmount: number
    appliedAmount: number
    remainingAmount: number
    envelopeChecksum: string
  }
  visitedTargetActorIds: string[]
  options: {
    optionId: string
    targetActorId: string
    targetTokenId: string
    targetActorVersion: number
    /** Exact mutable target state sealed when this option was offered. */
    targetStateChecksum: string
    armorClass: number
    footprintChecksum: string
  }[]
}

const optionalCombatCleavingChoicePendingContextDtoSchema = z
  .strictObject({
    kind: z.literal('ENCOUNTER_OPTIONAL_COMBAT_CLEAVING'),
    schemaVersion: z.literal(1),
    parentOccurrenceId: uuidSchema,
    parentResultChecksum: checksumSchema,
    sourceActorId: uuidSchema,
    sourceControllerCharacterId: uuidSchema.nullable(),
    /** Exact authored action facts revalidated before a Cleaving choice applies. */
    action: z.strictObject({
      actionId: z.string().trim().min(1).max(240),
      publishedDefinitionId: uuidSchema,
      publishedDefinitionChecksum: checksumSchema,
      attackKind: z.enum(['MELEE', 'RANGED', 'OTHER']),
      range: z.custom<RangeDto>((value) => rangeDtoSchema.safeParse(value).success)
    }),
    /**
     * Source facts are deliberately separate from the offered target options:
     * an old choice can never authorize a changed Character or Creature action.
     */
    sourceCurrentness: z.discriminatedUnion('kind', [
      z.strictObject({
        kind: z.literal('CHARACTER'),
        actorId: uuidSchema,
        characterId: uuidSchema,
        streamVersion: z.number().int().nonnegative(),
        projectionChecksum: checksumSchema,
        mechanicalContextChecksum: checksumSchema
      }),
      z.strictObject({
        kind: z.literal('ENCOUNTER_ACTOR'),
        actorId: uuidSchema,
        sourceRevision: z.number().int().positive(),
        sourceVersionId: uuidSchema,
        sourceChecksum: checksumSchema,
        stateChecksum: checksumSchema
      })
    ]),
    initialTargetActorId: uuidSchema,
    chainStep: z
      .number()
      .int()
      .min(1)
      .max(RULE_GRAPH_LIMITS.NODES - 1),
    optionalCombat: z.strictObject({
      definitionId: uuidSchema,
      definitionVersion: z.number().int().positive(),
      definitionChecksum: checksumSchema
    }),
    scene: z.strictObject({
      sceneId: uuidSchema,
      sceneVersion: z.number().int().nonnegative(),
      effectiveGridChecksum: checksumSchema,
      sourceTokenId: uuidSchema
    }),
    originalAttack: z.strictObject({
      total: z.number().int(),
      naturalRoll: z.number().int().min(1).max(20)
    }),
    damage: z
      .strictObject({
        sourceNodeId: localNodeIdSchema,
        sourceOperationKey: capabilityKeySchema,
        damageTypeId: uuidSchema,
        resolvedAmount: z.number().int().positive(),
        appliedAmount: z.number().int().nonnegative(),
        remainingAmount: z.number().int().positive(),
        envelopeChecksum: checksumSchema
      })
      .superRefine((damage, context) => {
        if (damage.resolvedAmount - damage.appliedAmount !== damage.remainingAmount) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['remainingAmount'],
            message: 'Cleaving must retain the exact finalized excess damage.'
          })
        }
      }),
    visitedTargetActorIds: z
      .array(uuidSchema)
      .min(1)
      .max(RULE_GRAPH_LIMITS.NODES - 1),
    options: z
      .array(
        z.strictObject({
          optionId: checksumSchema,
          targetActorId: uuidSchema,
          targetTokenId: uuidSchema,
          targetActorVersion: z.number().int().nonnegative(),
          targetStateChecksum: checksumSchema,
          armorClass: z.number().int().nonnegative(),
          footprintChecksum: checksumSchema
        })
      )
      .min(1)
      .max(RULE_GRAPH_LIMITS.NODES - 1)
  })
  .superRefine((value, context) => {
    if (
      value.sourceCurrentness.actorId !== value.sourceActorId ||
      value.action.attackKind !== 'MELEE'
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sourceCurrentness'],
        message: 'Cleaving must retain the exact melee action source currentness.'
      })
    }
    const visited = new Set<string>()
    for (const [index, actorId] of value.visitedTargetActorIds.entries()) {
      if (visited.has(actorId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['visitedTargetActorIds', index],
          message: 'Cleaving visited targets must be unique.'
        })
      }
      visited.add(actorId)
    }
    if (value.visitedTargetActorIds[0] !== value.initialTargetActorId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['visitedTargetActorIds', 0],
        message: 'Cleaving must retain its original defeated target as the chain root.'
      })
    }
    const options = new Set<string>()
    for (const [index, option] of value.options.entries()) {
      if (
        options.has(option.optionId) ||
        visited.has(option.targetActorId) ||
        option.targetActorId === value.sourceActorId
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['options', index],
          message: 'Cleaving options must be unique, unvisited, and non-self targets.'
        })
      }
      options.add(option.optionId)
    }
  })

const serverKernelRuleExecutionPendingSnapshotDtoSchemaImpl: z.ZodType<ServerKernelRuleExecutionPendingSnapshotDto> =
  serverRuleExecutionContinuationDtoSchema
    .extend({
      snapshotKind: z.literal('KERNEL_EVIDENCE'),
      optionalCombatSnapshotChecksum: checksumSchema.nullable().optional(),
      applicationContext: serverRuleExecutionPendingApplicationContextDtoSchema,
      /**
       * Completed TEST evidence retained only while the bounded OUTCOME phase is
       * pending. This is receipt material, never an executable graph.
       */
      phaseReceipts: z.lazy(() => ruleExecutionPhaseReceiptsDtoSchema).optional()
    })
    .superRefine((snapshot, context) => {
      if (
        snapshot.phaseReceipts &&
        (snapshot.phaseReceipts.length !== 1 || snapshot.phaseReceipts[0]?.phase !== 'TEST')
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['phaseReceipts'],
          message: 'A pending phased occurrence may retain only its completed TEST receipt.'
        })
      }
      const twoPhase =
        (snapshot.applicationContext.kind === 'ENCOUNTER_CHARACTER_RULE_ACTION' ||
          snapshot.applicationContext.kind === 'ENCOUNTER_ACTOR_RULE_ACTION' ||
          snapshot.applicationContext.kind === 'ENCOUNTER_CREATURE_RULE_ACTION') &&
        snapshot.applicationContext.twoPhase?.phase === 'OUTCOME'
          ? snapshot.applicationContext.twoPhase
          : null
      if (!twoPhase) return
      const receipt = snapshot.phaseReceipts?.[0]
      if (
        !receipt ||
        receipt.phase !== 'TEST' ||
        checksumRuleDocument(receipt.execution) !== twoPhase.testExecutionChecksum ||
        checksumRuleDocument(twoPhase.testExecution) !== twoPhase.testExecutionChecksum ||
        receipt.template.checksum !== twoPhase.testTemplateChecksum ||
        receipt.specializedChecksum !== receipt.execution.evidence.source.checksum ||
        checksumRuleDocument(receipt.execution) !== checksumRuleDocument(twoPhase.testExecution)
      )
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['phaseReceipts'],
          message: 'Pending OUTCOME must retain its exact sealed TEST receipt.'
        })
    })

const optionalCombatPassageChoiceOptionDtoSchema = z.strictObject({
  optionId: checksumSchema,
  ruleKind: z.enum(['OVERRUN', 'TUMBLE']),
  economy: z.enum(['ACTION', 'BONUS_ACTION']),
  definitionId: uuidSchema,
  definitionVersion: z.number().int().positive(),
  definitionChecksum: checksumSchema,
  moduleKey: capabilityKeySchema,
  moduleContractVersion: contractVersionSchema
})

const optionalCombatPassageChoicePendingContextDtoSchema = z
  .strictObject({
    kind: z.literal('ENCOUNTER_MOVEMENT_PASSAGE_CHOICE'),
    schemaVersion: z.literal(1),
    movement: optionalCombatPassageContinuationDtoSchema,
    sourceActorId: uuidSchema,
    sourceTokenId: uuidSchema,
    sourceControllerCharacterId: uuidSchema.nullable(),
    options: z.array(optionalCombatPassageChoiceOptionDtoSchema).min(1).max(4),
    optionsChecksum: checksumSchema
  })
  .superRefine((value, context) => {
    if (value.movement.root.tokenId !== value.sourceTokenId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sourceTokenId'],
        message: 'Passage choice source token must own the sealed movement root.'
      })
    }
    const ids = new Set<string>()
    for (const [index, option] of value.options.entries()) {
      if (ids.has(option.optionId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['options', index, 'optionId'],
          message: 'Passage choice options must have unique deterministic identities.'
        })
      }
      ids.add(option.optionId)
    }
    if (checksumRuleDocument(value.options) !== value.optionsChecksum) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['optionsChecksum'],
        message: 'Passage choice options checksum must bind the complete issued option set.'
      })
    }
  })

export type OptionalCombatPassageChoicePendingContextDto = z.infer<
  typeof optionalCombatPassageChoicePendingContextDtoSchema
>

export type ServerAggregateChoicePendingSnapshotDto = {
  snapshotKind: 'AGGREGATE_CHOICE'
  schemaVersion: 1
  occurrenceId: string
  optionalCombatSnapshotChecksum?: string | null
  applicationContext:
    | z.infer<typeof legendaryActionChoicePendingContextDtoSchema>
    | z.infer<typeof initiativeDeclarationAggregateChoicePendingContextDtoSchema>
    | OptionalCombatCleavingChoicePendingContextDto
    | OptionalCombatPassageChoicePendingContextDto
}

export const serverAggregateChoicePendingSnapshotDtoSchema: z.ZodType<ServerAggregateChoicePendingSnapshotDto> =
  z.strictObject({
    snapshotKind: z.literal('AGGREGATE_CHOICE'),
    schemaVersion: z.literal(1),
    occurrenceId: uuidSchema,
    optionalCombatSnapshotChecksum: checksumSchema.nullable().optional(),
    applicationContext: z.discriminatedUnion('kind', [
      legendaryActionChoicePendingContextDtoSchema,
      initiativeDeclarationAggregateChoicePendingContextDtoSchema,
      optionalCombatCleavingChoicePendingContextDtoSchema,
      optionalCombatPassageChoicePendingContextDtoSchema
    ])
  })
export type ServerRuleExecutionPendingSnapshotDto =
  | ServerKernelRuleExecutionPendingSnapshotDto
  | ServerAggregateChoicePendingSnapshotDto

export const serverKernelRuleExecutionPendingSnapshotDtoSchema =
  serverKernelRuleExecutionPendingSnapshotDtoSchemaImpl

/** Persisted occurrence snapshots are either sealed kernel evidence or an aggregate tactical choice. */
export const serverRuleExecutionPendingSnapshotDtoSchema: z.ZodType<ServerRuleExecutionPendingSnapshotDto> =
  z.union([
    serverKernelRuleExecutionPendingSnapshotDtoSchemaImpl,
    serverAggregateChoicePendingSnapshotDtoSchema
  ])

export const serverRuleEvidenceResponseDtoSchema = z.strictObject({
  requestId: z.string().min(1).max(256),
  value: z.number().int()
})

const aggregateVersionSchema = z.number().int().min(0)
const resolvedIntentKeySchema = z.string().regex(/^[a-z][a-zA-Z0-9_-]{0,79}$/)
const resolvedIntentValueSchema = z.union([z.boolean(), z.number().finite(), z.string().max(256)])
export const resolvedStartIntentRecordDtoSchema = z
  .record(resolvedIntentKeySchema, resolvedIntentValueSchema)
  .refine((intent) => Object.keys(intent).length <= RULE_GRAPH_LIMITS.RUNTIME_FACTS, {
    message: `Resolved rule execution intents support at most ${RULE_GRAPH_LIMITS.RUNTIME_FACTS} values.`
  })
const receiptOrdinalSchema = z
  .number()
  .int()
  .min(0)
  .max(RULE_GRAPH_LIMITS.NODES - 1)
const receiptD20FaceSchema = z.number().int().min(1).max(20)
/** One bounded TEST/OUTCOME execution may consume no more than this many server evidence requests. */
export const MAX_RULE_EXECUTION_AUTOMATIC_EVIDENCE_REQUESTS = 32
const receiptD20ContributorSchema = z.strictObject({
  sourceId: z.string().trim().min(1).max(240),
  grantId: z.string().trim().min(1).max(240).nullable(),
  domainKey: z.string().trim().min(1).max(240).nullable(),
  influence: z.enum(['ADVANTAGE', 'DISADVANTAGE'])
})

/** Server-only policy for one frozen d20 evidence node. */
export const serverRuleExecutionD20PolicyDtoSchema = z
  .strictObject({
    requestNodeId: localNodeIdSchema,
    rollMode: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE']),
    contributors: z.array(receiptD20ContributorSchema).max(RULE_GRAPH_LIMITS.NODES),
    contributorChecksum: checksumSchema,
    modifier: z.number().int(),
    dc: z.number().int()
  })
  .superRefine((value, context) => {
    if (
      value.contributors.some(
        (contributor, index) =>
          index > 0 &&
          compareCanonicalD20Contributors(value.contributors[index - 1]!, contributor) >= 0
      )
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contributors'],
        message: 'd20 policy contributors must be strictly sorted and unique.'
      })
    }
  })
const serverRuleExecutionD20EvidenceShape = z.strictObject({
  requestId: z.string().min(1).max(256),
  rollMode: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE']),
  rawFaces: z.array(receiptD20FaceSchema).min(1).max(2),
  selectedNatural: receiptD20FaceSchema,
  contributors: z.array(receiptD20ContributorSchema).max(RULE_GRAPH_LIMITS.NODES),
  contributorChecksum: checksumSchema,
  modifier: z.number().int(),
  total: z.number().int(),
  defenseOrDc: z.number().int(),
  resultPath: z.string().trim().min(1).max(240)
})

function validateServerRuleExecutionD20Evidence(
  value: z.infer<typeof serverRuleExecutionD20EvidenceShape>,
  context: z.RefinementCtx
): void {
  const expectedFaces = value.rollMode === 'NORMAL' ? 1 : 2
  if (value.rawFaces.length !== expectedFaces)
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['rawFaces'],
      message: 'd20 evidence face count is invalid.'
    })
  const expectedSelected =
    value.rollMode === 'ADVANTAGE'
      ? Math.max(...value.rawFaces)
      : value.rollMode === 'DISADVANTAGE'
        ? Math.min(...value.rawFaces)
        : value.rawFaces[0]
  if (value.selectedNatural !== expectedSelected)
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['selectedNatural'],
      message: 'd20 evidence selected face is invalid.'
    })
  if (value.total !== value.selectedNatural + value.modifier)
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['total'],
      message: 'd20 evidence total is invalid.'
    })
  if (
    value.contributors.some(
      (contributor, index) =>
        index > 0 &&
        compareCanonicalD20Contributors(value.contributors[index - 1]!, contributor) >= 0
    )
  )
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['contributors'],
      message: 'd20 evidence contributors must be strictly sorted and unique.'
    })
  if (checksumRuleDocument(value.contributors) !== value.contributorChecksum)
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['contributorChecksum'],
      message: 'd20 evidence contributor checksum is invalid.'
    })
}

export const serverRuleExecutionD20EvidenceDtoSchema =
  serverRuleExecutionD20EvidenceShape.superRefine(validateServerRuleExecutionD20Evidence)

/** Exact graph binding retained only for a direct-action OUTCOME nested d20. */
export const serverRuleExecutionNestedD20EvidenceDtoSchema = serverRuleExecutionD20EvidenceShape
  .extend({ requestNodeId: localNodeIdSchema })
  .superRefine(validateServerRuleExecutionD20Evidence)
  .superRefine((value, context) => {
    const influences = new Set(value.contributors.map((contributor) => contributor.influence))
    const expectedRollMode =
      influences.size === 1
        ? [...influences][0] === 'ADVANTAGE'
          ? 'ADVANTAGE'
          : 'DISADVANTAGE'
        : 'NORMAL'
    if (value.rollMode !== expectedRollMode)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rollMode'],
        message: 'Nested d20 evidence roll mode must match its contributors.'
      })
  })

const characterMechanicsApplicationTraceDtoSchema = z.strictObject({
  sourceNodeId: z.string().trim().min(1).max(240),
  sourceOperationKey: z.string().trim().min(1).max(240),
  authoredPath: z.string().trim().min(1).max(240).nullable(),
  resolvedPath: z.string().trim().min(1).max(240).nullable()
})
const characterMechanicsApplicationDtoSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    ordinal: receiptOrdinalSchema,
    kind: z.enum(['HEAL', 'TEMPORARY_HIT_POINTS']),
    requestedAmount: z.number().int().min(1),
    resolvedAmount: z.number().int().min(0),
    appliedAmount: z.number().int().min(0),
    beforeCurrentHitPoints: z.number().int().min(0),
    afterCurrentHitPoints: z.number().int().min(0),
    beforeTemporaryHitPoints: z.number().int().min(0),
    afterTemporaryHitPoints: z.number().int().min(0),
    maximumHitPoints: z.number().int().min(0),
    ...characterMechanicsApplicationTraceDtoSchema.shape
  }),
  z.strictObject({
    ordinal: receiptOrdinalSchema,
    kind: z.literal('DAMAGE'),
    requestedAmount: z.number().int().min(1),
    resolvedAmount: z.number().int().min(0),
    appliedAmount: z.number().int().min(0),
    beforeCurrentHitPoints: z.number().int().min(0),
    afterCurrentHitPoints: z.number().int().min(0),
    beforeTemporaryHitPoints: z.number().int().min(0),
    afterTemporaryHitPoints: z.number().int().min(0),
    maximumHitPoints: z.number().int().min(0),
    damageTypeId: uuidSchema,
    damageDisposition: z.enum(['NORMAL', 'IMMUNE', 'RESISTANT', 'VULNERABLE', 'CANCELLED']),
    ...characterMechanicsApplicationTraceDtoSchema.shape
  }),
  z.strictObject({
    ordinal: receiptOrdinalSchema,
    kind: z.literal('CONDITION_APPLY'),
    conditionId: uuidSchema,
    beforePresent: z.boolean(),
    afterPresent: z.literal(true),
    applied: z.boolean(),
    ...characterMechanicsApplicationTraceDtoSchema.shape
  }),
  z.strictObject({
    ordinal: receiptOrdinalSchema,
    kind: z.literal('CONDITION_REMOVE'),
    conditionId: uuidSchema,
    sourceActiveEffectId: uuidSchema,
    beforePresent: z.boolean(),
    /** A source-bound removal can be retained by another active contribution. */
    afterPresent: z.boolean(),
    applied: z.boolean(),
    ...characterMechanicsApplicationTraceDtoSchema.shape
  }),
  z.strictObject({
    ordinal: receiptOrdinalSchema,
    kind: z.literal('HIT_POINT_MAXIMUM_REDUCTION'),
    reductionAmount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    sourceDamageOutcomeId: uuidSchema,
    sourceDamageNodeId: z.string().trim().min(1).max(240),
    sourceDamageOperationKey: z.string().trim().min(1).max(240),
    recoveryTags: z.tuple([z.literal('RESTORE_HIT_POINT_MAXIMUM')]),
    requestedAmount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    resolvedAmount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    appliedAmount: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    beforeMaximumHitPoints: z.number().int().min(0),
    afterMaximumHitPoints: z.number().int().min(0),
    beforeCurrentHitPoints: z.number().int().min(0),
    afterCurrentHitPoints: z.number().int().min(0),
    beforeTemporaryHitPoints: z.number().int().min(0),
    afterTemporaryHitPoints: z.number().int().min(0),
    maximumHitPoints: z.number().int().min(0),
    ...characterMechanicsApplicationTraceDtoSchema.shape
  }),
  z.strictObject({
    ordinal: receiptOrdinalSchema,
    kind: z.literal('SCALAR_REDUCTION'),
    valueDefinitionId: uuidSchema,
    reductionAmount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    stacking: z.literal('ADDITIVE'),
    floor: z.literal(0),
    recoveryTriggers: z
      .array(z.enum(['SHORT_REST', 'LONG_REST']))
      .min(1)
      .max(2),
    terminalConsequence: z.literal('TARGET_DIED'),
    sourceOutcomeId: uuidSchema,
    beforeValue: z.number().int().min(0),
    afterValue: z.number().int().min(0),
    targetDied: z.boolean(),
    ...characterMechanicsApplicationTraceDtoSchema.shape
  })
])
const characterMechanicsTargetStateDtoSchema = z
  .strictObject({
    currentHitPoints: z.number().int().min(0),
    temporaryHitPoints: z.number().int().min(0),
    maximumHitPoints: z.number().int().min(0),
    scalarValues: z.record(uuidSchema, z.number().int().min(0)).default({}),
    conditionIds: z.array(uuidSchema).max(200)
  })
  .superRefine((value, context) => {
    if (value.currentHitPoints > value.maximumHitPoints)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Target hit points exceed maximum.'
      })
    if (new Set(value.conditionIds).size !== value.conditionIds.length)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Target condition identities must be unique.'
      })
  })
const characterMechanicsResourceReceiptDtoSchema = z.strictObject({
  poolId: z.string().trim().min(1).max(240),
  chargeId: z.string().trim().min(1).max(240),
  cost: z.number().int().min(1),
  beforeUsed: z.number().int().min(0),
  afterUsed: z.number().int().min(0),
  beforeRemaining: z.number().int().min(0),
  afterRemaining: z.number().int().min(0)
})
const encounterFeatureResourceReceiptDtoSchema = z.strictObject({
  ownerActorId: uuidSchema,
  ownerFeatureId: authoredIdentifierSchema,
  chargeId: authoredIdentifierSchema,
  cost: z.number().int().min(1),
  beforeUsed: z.number().int().min(0),
  afterUsed: z.number().int().min(0),
  beforeRemaining: z.number().int().min(0),
  afterRemaining: z.number().int().min(0)
})
const characterActiveEffectCreateReceiptDtoSchema = z.strictObject({
  kind: z.literal('CREATE'),
  activeEffectId: uuidSchema,
  characterId: uuidSchema,
  sourceEncounterId: uuidSchema,
  createdOrdinal: z.number().int().positive(),
  afterVersion: aggregateVersionSchema,
  authoredEffectId: uuidSchema,
  compiledEntryId: uuidSchema,
  frozenGraphNodeId: localNodeIdSchema,
  definitionChecksum: checksumSchema,
  lifecycleChecksum: checksumSchema,
  frozenSourceChecksum: checksumSchema,
  capabilityContractVersion: contractVersionSchema,
  recurrenceStage: z.enum(['NONE', 'START_OF_TURN', 'END_OF_TURN']),
  remainingTicks: z.number().int().min(1).max(10_000).nullable(),
  maintainedEffectStateId: uuidSchema.nullable()
})
/** One target-owned recurring effect created by an Encounter Feature settlement. */
const encounterActorActiveEffectCreateReceiptDtoSchema = z.strictObject({
  kind: z.literal('CREATE'),
  activeEffectId: uuidSchema,
  targetActorId: uuidSchema,
  createdOrdinal: z.number().int().positive(),
  afterVersion: aggregateVersionSchema,
  authoredEffectId: uuidSchema,
  compiledEntryId: uuidSchema,
  frozenGraphNodeId: localNodeIdSchema,
  definitionChecksum: checksumSchema,
  lifecycleChecksum: checksumSchema,
  frozenSourceChecksum: checksumSchema,
  capabilityContractVersion: contractVersionSchema,
  recurrenceStage: z.enum(['NONE', 'START_OF_TURN', 'END_OF_TURN']),
  remainingTicks: z.number().int().min(1).max(10_000).nullable()
})
/** Immutable receipt for a target-owned state contribution created by an immediate outcome. */
const stateEffectCreateReceiptDtoSchema = z.strictObject({
  kind: z.literal('CREATE'),
  owner: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('CHARACTER'), characterId: uuidSchema }),
    z.strictObject({
      kind: z.literal('ENCOUNTER_ACTOR'),
      encounterId: uuidSchema,
      targetActorId: uuidSchema
    })
  ]),
  activeEffectId: uuidSchema,
  createdOrdinal: z.number().int().positive(),
  afterVersion: aggregateVersionSchema,
  authoredEffectId: uuidSchema,
  compiledEntryId: uuidSchema,
  frozenGraphNodeId: localNodeIdSchema,
  definitionChecksum: checksumSchema,
  lifecycleChecksum: checksumSchema,
  frozenSourceChecksum: checksumSchema,
  capabilityContractVersion: contractVersionSchema,
  contribution: z.discriminatedUnion('kind', [
    activeRuleEffectStateContributionDtoSchema,
    activeRuleEffectScalarReductionContributionDtoSchema
  ])
})

function validateStateEffectTransitions(input: {
  applications: readonly z.infer<typeof characterMechanicsApplicationDtoSchema>[]
  transitions: readonly z.infer<typeof stateEffectCreateReceiptDtoSchema>[]
  expectedOwnerKind: 'CHARACTER' | 'ENCOUNTER_ACTOR'
  expectedTargetActorId?: string
  context: z.RefinementCtx
}) {
  const reductions = input.applications.filter(
    (application) =>
      application.kind === 'HIT_POINT_MAXIMUM_REDUCTION' || application.kind === 'SCALAR_REDUCTION'
  )
  if (reductions.length !== input.transitions.length) {
    input.context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['stateEffectTransitions'],
      message: 'Each target state reduction requires one matching state-effect receipt.'
    })
    return
  }
  for (const [index, reduction] of reductions.entries()) {
    const transition = input.transitions[index]
    if (!transition) continue
    const contribution = transition.contribution
    const ownerMatches =
      input.expectedOwnerKind === 'CHARACTER'
        ? transition.owner.kind === 'CHARACTER'
        : transition.owner.kind === 'ENCOUNTER_ACTOR' &&
          transition.owner.targetActorId === input.expectedTargetActorId
    const contributionMatches =
      reduction.kind === 'HIT_POINT_MAXIMUM_REDUCTION'
        ? contribution.kind === 'HIT_POINT_MAXIMUM_REDUCTION' &&
          contribution.amount === reduction.reductionAmount &&
          contribution.sourceDamageOutcomeId === reduction.sourceDamageOutcomeId &&
          contribution.sourceDamageNodeId === reduction.sourceDamageNodeId &&
          contribution.sourceDamageOperationKey === reduction.sourceDamageOperationKey &&
          contribution.recoveryTags[0] === reduction.recoveryTags[0]
        : contribution.kind === 'SCALAR_REDUCTION' &&
          contribution.amount === reduction.reductionAmount &&
          contribution.valueDefinitionId === reduction.valueDefinitionId &&
          contribution.sourceOutcomeId === reduction.sourceOutcomeId &&
          contribution.sourceNodeId === reduction.sourceNodeId &&
          contribution.sourceOperationKey === reduction.sourceOperationKey
    if (
      !ownerMatches ||
      transition.frozenGraphNodeId !== reduction.sourceNodeId ||
      !contributionMatches
    )
      input.context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['stateEffectTransitions', index],
        message: 'State-effect receipt does not match its target state reduction.'
      })
  }
}
const maintainedEffectTransitionDtoSchema = z
  .strictObject({
    kind: z.literal('REPLACE_SAME_DEFINITION'),
    priorState: z
      .strictObject({
        id: uuidSchema,
        version: aggregateVersionSchema,
        maintenanceDefinitionId: uuidSchema,
        descriptorChecksum: checksumSchema,
        sourceActionId: z.string().min(1).max(240),
        sourceOccurrenceId: uuidSchema,
        sourceActorId: uuidSchema
      })
      .nullable(),
    removedDependentEffects: z
      .array(
        z.discriminatedUnion('kind', [
          z.strictObject({
            kind: z.literal('CHARACTER'),
            characterId: uuidSchema,
            activeEffectId: uuidSchema,
            createdOrdinal: z.number().int().positive(),
            expectedVersion: aggregateVersionSchema,
            definitionChecksum: checksumSchema,
            lifecycleChecksum: checksumSchema
          }),
          z.strictObject({
            kind: z.literal('ENCOUNTER_ACTOR'),
            targetActorId: uuidSchema,
            activeEffectId: uuidSchema,
            createdOrdinal: z.number().int().positive(),
            expectedVersion: aggregateVersionSchema,
            definitionChecksum: checksumSchema,
            lifecycleChecksum: checksumSchema
          })
        ])
      )
      .max(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER * 2),
    createdState: z.strictObject({
      id: uuidSchema,
      version: aggregateVersionSchema,
      maintenanceDefinitionId: uuidSchema,
      descriptorChecksum: checksumSchema,
      definitionChecksum: checksumSchema,
      sourceActionId: z.string().min(1).max(240),
      sourceOccurrenceId: uuidSchema,
      sourceActorId: uuidSchema
    }),
    characterOwnerTransitions: z
      .array(
        z.strictObject({
          characterId: uuidSchema,
          beforeStreamVersion: aggregateVersionSchema,
          afterStreamVersion: aggregateVersionSchema
        })
      )
      .max(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER * 2),
    createdDependentEffectIds: z.array(uuidSchema).min(1).max(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER)
  })
  .superRefine((value, context) => {
    const removed = new Set<string>()
    let previousTuple = ''
    for (const [index, effect] of value.removedDependentEffects.entries()) {
      const owner =
        effect.kind === 'CHARACTER' ? `0:${effect.characterId}` : `1:${effect.targetActorId}`
      if (removed.has(effect.activeEffectId))
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Removed maintained dependent effects must be unique.'
        })
      const tuple = `${owner}:${effect.createdOrdinal.toString().padStart(10, '0')}:${effect.activeEffectId}`
      if (tuple <= previousTuple)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['removedDependentEffects', index],
          message: 'Removed maintained dependent effects must use canonical owner order.'
        })
      previousTuple = tuple
      removed.add(effect.activeEffectId)
    }
    if (new Set(value.createdDependentEffectIds).size !== value.createdDependentEffectIds.length)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Created maintained dependent effects must be unique.'
      })
    if ((value.priorState === null) !== (value.removedDependentEffects.length === 0))
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Maintained replacement prior state and removals are inconsistent.'
      })
    if (
      value.priorState &&
      (value.priorState.maintenanceDefinitionId !== value.createdState.maintenanceDefinitionId ||
        value.priorState.sourceActorId !== value.createdState.sourceActorId)
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Maintained replacement state identity is invalid.'
      })
    const characterOwners = [
      ...new Set(
        value.removedDependentEffects
          .filter((effect) => effect.kind === 'CHARACTER')
          .map((effect) => effect.characterId)
      )
    ].sort()
    const transitions = value.characterOwnerTransitions
    if (
      transitions.length !== characterOwners.length ||
      transitions.some(
        (transition, index) =>
          transition.characterId !== characterOwners[index] ||
          transition.afterStreamVersion !== transition.beforeStreamVersion + 1
      )
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Maintained Character owner transitions are invalid.'
      })
  })
const concentrationCheckApplicationIdentityDtoSchema = z.strictObject({
  ordinal: receiptOrdinalSchema,
  sourceNodeId: z.string().trim().min(1).max(240),
  sourceOperationKey: z.string().trim().min(1).max(240),
  targetActorId: uuidSchema,
  appliedAmount: z.number().int().positive(),
  damageTypeId: uuidSchema,
  maintainedStateId: uuidSchema
})

const concentrationCheckApplicationOutputDtoSchema = z
  .strictObject({
    kind: z.literal('CONCENTRATION_CHECK'),
    schemaVersion: z.literal(1),
    occurrenceId: uuidSchema,
    parentOccurrenceId: uuidSchema,
    concentrationDefinition: z.strictObject({
      id: uuidSchema,
      checksum: checksumSchema
    }),
    savingThrowAbilityDefinitionId: uuidSchema,
    systemVocabularySnapshot: z.strictObject({
      id: uuidSchema,
      version: z.number().int().min(1),
      checksum: checksumSchema
    }),
    targetCharacter: z.strictObject({
      streamVersion: aggregateVersionSchema,
      baseProjectionChecksum: checksumSchema,
      campaignOverlayChecksum: checksumSchema,
      mechanicalContextChecksum: checksumSchema
    }),
    application: concentrationCheckApplicationIdentityDtoSchema,
    outcome: z.enum(['SAVE_SUCCESS', 'SAVE_FAILURE']),
    d20: z
      .strictObject({
        requestId: z.string().min(1).max(256),
        rollMode: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE']),
        rawFaces: z.array(z.number().int().min(1).max(20)).min(1).max(2),
        selectedNatural: z.number().int().min(1).max(20),
        modifier: z.number().int(),
        total: z.number().int(),
        dc: z.number().int().positive(),
        contributors: canonicalConcentrationContributorsDtoSchema,
        contributorChecksum: checksumSchema
      })
      .superRefine((value, context) => {
        if (
          value.rawFaces.length !== (value.rollMode === 'NORMAL' ? 1 : 2) ||
          value.selectedNatural !==
            (value.rollMode === 'ADVANTAGE'
              ? Math.max(...value.rawFaces)
              : value.rollMode === 'DISADVANTAGE'
                ? Math.min(...value.rawFaces)
                : value.rawFaces[0]) ||
          value.total !== value.selectedNatural + value.modifier
        )
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['rawFaces'],
            message: 'Concentration d20 evidence does not match its pinned roll mode.'
          })
      }),
    contextChecksum: checksumSchema,
    cleanup: z
      .strictObject({
        maintainedStateId: uuidSchema,
        removedDependentEffectIds: z.array(uuidSchema).max(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER * 2),
        characterOwnerTransitions: z
          .array(
            z.strictObject({
              characterId: uuidSchema,
              beforeStreamVersion: aggregateVersionSchema,
              afterStreamVersion: aggregateVersionSchema
            })
          )
          .max(MAX_ACTIVE_RULE_EFFECTS_PER_OWNER * 2)
      })
      .nullable(),
    nextOccurrenceId: uuidSchema.nullable(),
    skipped: z
      .array(
        concentrationCheckApplicationIdentityDtoSchema.extend({
          reason: z.literal('MAINTAINED_STATE_ENDED')
        })
      )
      .max(RULE_GRAPH_LIMITS.NODES)
  })
  .superRefine((value, context) => {
    if ((value.outcome === 'SAVE_FAILURE') !== (value.cleanup !== null))
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cleanup'],
        message: 'Concentration cleanup must occur exactly on a failed save.'
      })
    if (
      value.cleanup?.maintainedStateId !== undefined &&
      value.cleanup.maintainedStateId !== value.application.maintainedStateId
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cleanup', 'maintainedStateId'],
        message: 'Concentration cleanup must target the checked maintained state.'
      })
    let prior = `${value.application.ordinal.toString().padStart(4, '0')}:${value.application.sourceNodeId}:${value.application.sourceOperationKey}`
    for (const [index, skipped] of value.skipped.entries()) {
      const current = `${skipped.ordinal.toString().padStart(4, '0')}:${skipped.sourceNodeId}:${skipped.sourceOperationKey}`
      if (current <= prior)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['skipped', index],
          message: 'Skipped concentration checks must use canonical application order.'
        })
      if (skipped.maintainedStateId !== value.application.maintainedStateId)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['skipped', index, 'maintainedStateId'],
          message: 'Only checks for the ended maintained state may be skipped.'
        })
      prior = current
    }
  })

const encounterActorMechanicsBatchApplicationOutputDtoSchema = z
  .strictObject({
    kind: z.literal('ENCOUNTER_ACTOR_MECHANICS_BATCH'),
    schemaVersion: z.literal(1),
    occurrenceId: uuidSchema,
    sourceActorId: uuidSchema,
    targetActorId: uuidSchema,
    sourceCharacterStreamVersion: aggregateVersionSchema.nullable(),
    resourceConsumption: characterMechanicsResourceReceiptDtoSchema.nullable(),
    spellCastConsumption: z
      .strictObject({
        spellId: uuidSchema,
        spellVersionId: uuidSchema,
        spellVersion: z.number().int().positive(),
        spellChecksum: checksumSchema,
        candidateId: z.string().trim().min(1).max(1_000),
        slotKey: z.string().trim().min(1).max(1_000).nullable(),
        beforeUsed: z.number().int().nonnegative().nullable(),
        afterUsed: z.number().int().nonnegative().nullable()
      })
      .nullable()
      .default(null),
    featureResourceConsumption: encounterFeatureResourceReceiptDtoSchema.nullable().default(null),
    targetFeatureResourceConsumption: encounterFeatureResourceReceiptDtoSchema
      .nullable()
      .default(null),
    legendaryResistance: z
      .strictObject({
        selectedIndex: z.union([z.literal(0), z.literal(1)]),
        use: z.boolean(),
        ownerFeatureId: authoredIdentifierSchema,
        chargeId: authoredIdentifierSchema,
        featureCost: z.number().int().positive(),
        lifecycle: z.strictObject({
          definitionId: uuidSchema,
          definitionVersion: z.number().int().positive(),
          definitionChecksum: checksumSchema,
          choiceGraphDefinitionId: uuidSchema,
          choiceGraphDefinitionVersion: z.number().int().positive(),
          choiceGraphDefinitionChecksum: checksumSchema,
          useOutput: portNameSchema,
          interruptedStage: z.literal('AFTER_FAILED_SAVE_BEFORE_OUTCOME'),
          replacement: z.literal('SAVE_SUCCESS')
        }),
        /** The choice-graph completion is nested evidence, never the action receipt root. */
        execution: z.lazy(() => serverCompletedRuleExecutionDtoSchema),
        originalExecution: z.lazy(() => serverCompletedRuleExecutionDtoSchema),
        originalExecutionChecksum: checksumSchema,
        originalD20: z.lazy(() => serverRuleExecutionD20EvidenceDtoSchema)
      })
      .nullable()
      .default(null),
    d20: serverRuleExecutionD20EvidenceDtoSchema.nullable(),
    nestedD20: serverRuleExecutionNestedD20EvidenceDtoSchema.nullable().default(null),
    activeEffectTransitions: z
      .array(encounterActorActiveEffectCreateReceiptDtoSchema)
      .max(1)
      .default([]),
    stateEffectTransitions: z.array(stateEffectCreateReceiptDtoSchema).max(1).default([]),
    targetTransition: z.strictObject({
      checksum: checksumSchema,
      before: characterMechanicsTargetStateDtoSchema,
      after: characterMechanicsTargetStateDtoSchema
    }),
    applications: z.array(characterMechanicsApplicationDtoSchema).max(RULE_GRAPH_LIMITS.NODES)
  })
  .superRefine((value, context) => {
    validateStateEffectTransitions({
      applications: value.applications,
      transitions: value.stateEffectTransitions,
      expectedOwnerKind: 'ENCOUNTER_ACTOR',
      expectedTargetActorId: value.targetActorId,
      context
    })
    let current = value.targetTransition.before.currentHitPoints
    let temporary = value.targetTransition.before.temporaryHitPoints
    let maximum = value.targetTransition.before.maximumHitPoints
    const conditions = new Set(value.targetTransition.before.conditionIds)
    const scalarValues = { ...value.targetTransition.before.scalarValues }
    for (const [index, application] of value.applications.entries()) {
      if (application.ordinal !== index)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['applications', index, 'ordinal'],
          message: 'Encounter actor mechanics application ordinals must be contiguous.'
        })
      if (application.kind === 'CONDITION_APPLY' || application.kind === 'CONDITION_REMOVE') {
        const present = conditions.has(application.conditionId)
        const validTransition =
          application.kind === 'CONDITION_APPLY'
            ? application.afterPresent && application.applied === !present
            : application.applied
              ? present && !application.afterPresent
              : application.afterPresent === present
        if (application.beforePresent !== present || !validTransition)
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['applications', index],
            message: 'Condition receipt presence is invalid.'
          })
        if (application.afterPresent) conditions.add(application.conditionId)
        else conditions.delete(application.conditionId)
        continue
      }
      if (application.kind === 'HIT_POINT_MAXIMUM_REDUCTION') {
        const afterMaximum = Math.max(
          0,
          application.beforeMaximumHitPoints - application.reductionAmount
        )
        if (
          application.beforeMaximumHitPoints !== maximum ||
          application.afterMaximumHitPoints !== afterMaximum ||
          application.appliedAmount !== application.beforeMaximumHitPoints - afterMaximum ||
          application.requestedAmount !== application.reductionAmount ||
          application.resolvedAmount !== application.reductionAmount ||
          application.maximumHitPoints !== maximum ||
          application.beforeCurrentHitPoints !== current ||
          application.afterCurrentHitPoints !== Math.min(current, afterMaximum) ||
          application.beforeTemporaryHitPoints !== temporary ||
          application.afterTemporaryHitPoints !== temporary
        )
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['applications', index],
            message: 'Hit point maximum reduction receipt arithmetic is invalid.'
          })
        current = application.afterCurrentHitPoints
        maximum = application.afterMaximumHitPoints
        continue
      }
      if (application.kind === 'SCALAR_REDUCTION') {
        const beforeValue = scalarValues[application.valueDefinitionId]
        const afterValue = Math.max(application.floor, beforeValue - application.reductionAmount)
        if (
          !Number.isSafeInteger(beforeValue) ||
          beforeValue < 0 ||
          application.stacking !== 'ADDITIVE' ||
          application.floor !== 0 ||
          application.afterValue !== afterValue ||
          application.beforeValue !== beforeValue ||
          application.targetDied !== (afterValue === application.floor)
        )
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['applications', index],
            message: 'Scalar reduction receipt arithmetic is invalid.'
          })
        scalarValues[application.valueDefinitionId] = afterValue
        if (application.targetDied) current = 0
        continue
      }
      if (
        application.beforeCurrentHitPoints > application.maximumHitPoints ||
        application.afterCurrentHitPoints > application.maximumHitPoints ||
        application.beforeCurrentHitPoints !== current ||
        application.beforeTemporaryHitPoints !== temporary ||
        application.maximumHitPoints !== maximum
      )
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['applications', index],
          message: 'Encounter actor hit-point application chain is invalid.'
        })
      if (application.kind === 'HEAL') {
        const applied = Math.min(
          application.resolvedAmount,
          application.maximumHitPoints - application.beforeCurrentHitPoints
        )
        if (
          application.resolvedAmount !== application.requestedAmount ||
          application.afterTemporaryHitPoints !== application.beforeTemporaryHitPoints ||
          application.appliedAmount !== applied ||
          application.afterCurrentHitPoints !== application.beforeCurrentHitPoints + applied
        )
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['applications', index],
            message: 'Heal receipt arithmetic is invalid.'
          })
      } else if (application.kind === 'TEMPORARY_HIT_POINTS') {
        const afterTemporary = Math.max(
          application.beforeTemporaryHitPoints,
          application.resolvedAmount
        )
        if (
          application.resolvedAmount !== application.requestedAmount ||
          application.afterCurrentHitPoints !== application.beforeCurrentHitPoints ||
          application.appliedAmount !== afterTemporary - application.beforeTemporaryHitPoints ||
          application.afterTemporaryHitPoints !== afterTemporary
        )
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['applications', index],
            message: 'Temporary hit-point receipt arithmetic is invalid.'
          })
      } else if (application.kind === 'DAMAGE') {
        const resolved =
          application.damageDisposition === 'IMMUNE'
            ? 0
            : application.damageDisposition === 'RESISTANT'
              ? Math.floor(application.requestedAmount / 2)
              : application.damageDisposition === 'VULNERABLE'
                ? application.requestedAmount * 2
                : application.requestedAmount
        const temporaryLost = Math.min(application.beforeTemporaryHitPoints, resolved)
        const currentLost = Math.min(application.beforeCurrentHitPoints, resolved - temporaryLost)
        if (
          application.resolvedAmount !== resolved ||
          application.appliedAmount !== temporaryLost + currentLost ||
          application.afterCurrentHitPoints !== application.beforeCurrentHitPoints - currentLost ||
          application.afterTemporaryHitPoints !==
            application.beforeTemporaryHitPoints - temporaryLost
        )
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['applications', index],
            message: 'Damage receipt arithmetic is invalid.'
          })
      }
      current = application.afterCurrentHitPoints
      temporary = application.afterTemporaryHitPoints
    }
    const after = value.targetTransition.after
    if (
      after.currentHitPoints !== current ||
      after.temporaryHitPoints !== temporary ||
      after.maximumHitPoints !== maximum ||
      after.conditionIds.length !== conditions.size ||
      after.conditionIds.some((conditionId, index) => [...conditions][index] !== conditionId) ||
      JSON.stringify(after.scalarValues) !== JSON.stringify(scalarValues)
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetTransition', 'after'],
        message: 'Encounter actor target transition is invalid.'
      })
    const resource = value.resourceConsumption
    const featureResource = value.featureResourceConsumption
    const targetFeatureResource = value.targetFeatureResourceConsumption
    if (
      resource &&
      (resource.afterUsed !== resource.beforeUsed + resource.cost ||
        resource.beforeRemaining < resource.cost ||
        resource.afterRemaining !== resource.beforeRemaining - resource.cost)
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['resourceConsumption'],
        message: 'Resource receipt is invalid.'
      })
    if ((value.sourceCharacterStreamVersion === null) !== (resource === null))
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sourceCharacterStreamVersion'],
        message: 'Source Character stream version presence is invalid.'
      })
    if (
      featureResource &&
      (featureResource.ownerActorId !== value.sourceActorId ||
        featureResource.afterUsed !== featureResource.beforeUsed + featureResource.cost ||
        featureResource.beforeRemaining < featureResource.cost ||
        featureResource.afterRemaining !== featureResource.beforeRemaining - featureResource.cost)
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['featureResourceConsumption'],
        message: 'Encounter feature resource receipt is invalid.'
      })
    if (resource !== null && featureResource !== null)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['featureResourceConsumption'],
        message: 'Character and Encounter feature resource receipts are mutually exclusive.'
      })
    if (
      targetFeatureResource &&
      (targetFeatureResource.ownerActorId !== value.targetActorId ||
        targetFeatureResource.afterUsed !==
          targetFeatureResource.beforeUsed + targetFeatureResource.cost ||
        targetFeatureResource.beforeRemaining < targetFeatureResource.cost ||
        targetFeatureResource.afterRemaining !==
          targetFeatureResource.beforeRemaining - targetFeatureResource.cost)
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetFeatureResourceConsumption'],
        message: 'Target Encounter feature resource receipt is invalid.'
      })
    const legendaryResistance = value.legendaryResistance
    if (legendaryResistance) {
      const expectedUse = legendaryResistance.selectedIndex === 1
      if (
        legendaryResistance.use !== expectedUse ||
        legendaryResistance.originalExecution.outputs.resultPath !== 'ON_SAVE_FAIL' ||
        checksumRuleDocument(legendaryResistance.originalExecution) !==
          legendaryResistance.originalExecutionChecksum
      )
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['legendaryResistance'],
          message: 'Legendary Resistance action evidence is invalid.'
        })
      const consumptionMatches =
        targetFeatureResource !== null &&
        targetFeatureResource.ownerActorId === value.targetActorId &&
        targetFeatureResource.ownerFeatureId === legendaryResistance.ownerFeatureId &&
        targetFeatureResource.chargeId === legendaryResistance.chargeId &&
        targetFeatureResource.cost === legendaryResistance.featureCost
      if (
        (legendaryResistance.use && !consumptionMatches) ||
        (!legendaryResistance.use && targetFeatureResource !== null)
      )
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['targetFeatureResourceConsumption'],
          message: 'Legendary Resistance charge consumption does not match the selected choice.'
        })
    } else if (targetFeatureResource !== null)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetFeatureResourceConsumption'],
        message: 'Target Feature resource consumption requires Legendary Resistance evidence.'
      })
    const contributorKeys = new Set<string>()
    for (const contributor of value.d20?.contributors ?? []) {
      const key = canonicalD20ContributorKey(contributor)
      if (contributorKeys.has(key))
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['d20', 'contributors'],
          message: 'd20 contributors must be unique.'
        })
      contributorKeys.add(key)
    }
    const influences = new Set(
      (value.d20?.contributors ?? []).map((contributor) => contributor.influence)
    )
    const expectedRollMode = influences.size === 1 ? [...influences][0] : 'NORMAL'
    if (value.d20 && value.d20.rollMode !== expectedRollMode)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['d20', 'rollMode'],
        message: 'd20 contributor mode is invalid.'
      })
  })

const contestedActionRollDtoSchema = z
  .strictObject({
    actorId: uuidSchema,
    requestNodeId: localNodeIdSchema,
    rollMode: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE']),
    rawFaces: z.array(receiptD20FaceSchema).min(1).max(2),
    selectedNatural: receiptD20FaceSchema,
    contributors: z.array(receiptD20ContributorSchema).max(RULE_GRAPH_LIMITS.NODES),
    contributorChecksum: checksumSchema,
    modifier: z.number().int(),
    total: z.number().int()
  })
  .superRefine((value, context) => {
    const expectedFaces = value.rollMode === 'NORMAL' ? 1 : 2
    const expectedSelected =
      value.rollMode === 'ADVANTAGE'
        ? Math.max(...value.rawFaces)
        : value.rollMode === 'DISADVANTAGE'
          ? Math.min(...value.rawFaces)
          : value.rawFaces[0]
    if (value.rawFaces.length !== expectedFaces || value.selectedNatural !== expectedSelected)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Contested-action d20 faces do not match the sealed roll mode.'
      })
    if (value.total !== value.selectedNatural + value.modifier)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['total'],
        message: 'Contested-action d20 total is invalid.'
      })
    if (
      value.contributors.some(
        (contributor, index) =>
          index > 0 &&
          compareCanonicalD20Contributors(value.contributors[index - 1]!, contributor) >= 0
      )
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contributors'],
        message: 'Contested-action contributors must be strictly sorted and unique.'
      })
    if (checksumRuleDocument(value.contributors) !== value.contributorChecksum)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contributorChecksum'],
        message: 'Contested-action contributor checksum is invalid.'
      })
  })

const contestedActionApplicationOutputDtoSchema = z
  .strictObject({
    kind: z.literal('CONTESTED_ACTION'),
    schemaVersion: z.literal(1),
    occurrenceId: uuidSchema,
    sourceActorId: uuidSchema,
    targetActorId: uuidSchema,
    sealedContextChecksum: checksumSchema,
    policy: z.strictObject({
      definitionId: uuidSchema,
      definitionVersion: z.number().int().positive(),
      definitionChecksum: checksumSchema,
      moduleKey: capabilityKeySchema,
      moduleContractVersion: contractVersionSchema
    }),
    contestGraph: z.strictObject({
      definitionId: uuidSchema,
      checksum: checksumSchema,
      identityChecksum: checksumSchema
    }),
    sourceRoll: contestedActionRollDtoSchema,
    targetRoll: contestedActionRollDtoSchema,
    outcome: z.enum(['SOURCE_WIN', 'TARGET_WIN_OR_TIE']),
    stateTransition: z.discriminatedUnion('kind', [
      z.strictObject({ kind: z.literal('NONE') }),
      z.strictObject({
        kind: z.literal('CHARACTER_ITEM_USE_STATE'),
        characterId: uuidSchema,
        itemInstanceId: uuidSchema,
        fromState: z.literal('EQUIPPED'),
        toState: z.literal('CARRIED'),
        beforeStreamVersion: aggregateVersionSchema,
        afterStreamVersion: aggregateVersionSchema,
        beforeStateChecksum: checksumSchema,
        afterStateChecksum: checksumSchema
      }),
      z.strictObject({
        kind: z.literal('ENCOUNTER_ACTOR_ITEM_USE_STATE'),
        actorId: uuidSchema,
        loadoutEntryId: uuidSchema,
        equipmentId: uuidSchema,
        fromState: z.literal('HELD'),
        toState: z.literal('CARRIED'),
        beforeStateChecksum: checksumSchema,
        afterStateChecksum: checksumSchema
      }),
      z.strictObject({
        kind: z.literal('SCENE_TOKEN_MOVED'),
        tokenId: uuidSchema,
        destination: z.strictObject({ x: z.number().finite(), y: z.number().finite() })
      })
    ]),
    actionEconomyTransition: z
      .strictObject({
        definitionId: uuidSchema,
        definitionVersion: z.number().int().positive(),
        definitionChecksum: checksumSchema,
        maximum: z.number().int().positive(),
        beforeUsed: z.number().int().nonnegative(),
        afterUsed: z.number().int().positive()
      })
      .nullable()
  })
  .superRefine((value, context) => {
    if (value.sourceActorId === value.targetActorId)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetActorId'],
        message: 'Contested-action participants must be distinct.'
      })
    if (
      value.sourceRoll.actorId !== value.sourceActorId ||
      value.targetRoll.actorId !== value.targetActorId ||
      value.sourceRoll.requestNodeId === value.targetRoll.requestNodeId
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sourceRoll'],
        message: 'Contested-action roll participants or request nodes are invalid.'
      })
    const sourceWon = value.sourceRoll.total > value.targetRoll.total
    if ((value.outcome === 'SOURCE_WIN') !== sourceWon)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['outcome'],
        message: 'Contested-action outcome does not match roll totals.'
      })
    if (value.outcome === 'SOURCE_WIN' && value.stateTransition.kind === 'NONE')
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['stateTransition'],
        message: 'A contested-action source win requires one state transition.'
      })
    if (value.outcome === 'TARGET_WIN_OR_TIE' && value.stateTransition.kind !== 'NONE')
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['stateTransition'],
        message: 'A contested-action target win or tie cannot mutate item state.'
      })
    if (
      value.stateTransition.kind === 'CHARACTER_ITEM_USE_STATE' &&
      (value.stateTransition.afterStreamVersion !== value.stateTransition.beforeStreamVersion + 1 ||
        value.stateTransition.beforeStateChecksum === value.stateTransition.afterStateChecksum)
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['stateTransition'],
        message: 'Character contested-action item state transition is invalid.'
      })
    if (
      value.stateTransition.kind === 'ENCOUNTER_ACTOR_ITEM_USE_STATE' &&
      (value.stateTransition.actorId !== value.targetActorId ||
        value.stateTransition.beforeStateChecksum === value.stateTransition.afterStateChecksum)
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['stateTransition'],
        message: 'Encounter-actor contested-action item state transition is invalid.'
      })
    if (
      value.stateTransition.kind === 'SCENE_TOKEN_MOVED' &&
      value.stateTransition.tokenId.length === 0
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['stateTransition'],
        message: 'Contested-action Scene transition is invalid.'
      })
    if (
      value.actionEconomyTransition &&
      (value.actionEconomyTransition.beforeUsed >= value.actionEconomyTransition.maximum ||
        value.actionEconomyTransition.afterUsed !== value.actionEconomyTransition.beforeUsed + 1)
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['actionEconomyTransition'],
        message: 'Contested-action economy transition is invalid.'
      })
  })

const cleavingDamageApplicationOutputDtoSchema = z
  .strictObject({
    kind: z.literal('CLEAVING_DAMAGE'),
    schemaVersion: z.literal(1),
    occurrenceId: uuidSchema,
    parentOccurrenceId: uuidSchema,
    sourceActorId: uuidSchema,
    targetActorId: uuidSchema.nullable(),
    selectedOptionId: checksumSchema.nullable(),
    sealedContextChecksum: checksumSchema,
    outcome: z.enum(['DECLINED', 'APPLIED']),
    damage: z.strictObject({
      sourceNodeId: localNodeIdSchema,
      sourceOperationKey: capabilityKeySchema,
      damageTypeId: uuidSchema,
      requestedAmount: z.number().int().positive(),
      resolvedAmount: z.number().int().positive(),
      appliedAmount: z.number().int().nonnegative()
    }),
    targetTransition: z
      .strictObject({
        checksum: checksumSchema,
        before: characterMechanicsTargetStateDtoSchema,
        after: characterMechanicsTargetStateDtoSchema
      })
      .nullable()
  })
  .superRefine((value, context) => {
    const applied = value.outcome === 'APPLIED'
    if (
      (applied &&
        (value.targetActorId === null ||
          value.selectedOptionId === null ||
          value.targetTransition === null)) ||
      (!applied &&
        (value.targetActorId !== null ||
          value.selectedOptionId !== null ||
          value.targetTransition !== null)) ||
      value.damage.requestedAmount !== value.damage.resolvedAmount
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Cleaving settlement evidence is inconsistent.'
      })
    }
  })

export const serverRuleExecutionApplicationOutputsDtoSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('NONE') }),
  cleavingDamageApplicationOutputDtoSchema,
  contestedActionApplicationOutputDtoSchema,
  concentrationCheckApplicationOutputDtoSchema,
  encounterActorMechanicsBatchApplicationOutputDtoSchema,
  z
    .strictObject({
      kind: z.literal('CHARACTER_MECHANICS_BATCH'),
      schemaVersion: z.literal(1),
      occurrenceId: uuidSchema,
      sourceActorId: uuidSchema,
      /** Immutable Character identity for Character-originated receipts; never inferred on replay. */
      sourceCharacterId: uuidSchema.nullable(),
      targetActorId: uuidSchema,
      sourceCharacterStreamVersion: aggregateVersionSchema.nullable(),
      targetCharacterStreamVersion: aggregateVersionSchema.nullable(),
      resourceConsumption: characterMechanicsResourceReceiptDtoSchema.nullable(),
      spellCastConsumption: z
        .strictObject({
          spellId: uuidSchema,
          spellVersionId: uuidSchema,
          spellVersion: z.number().int().positive(),
          spellChecksum: checksumSchema,
          candidateId: z.string().trim().min(1).max(1_000),
          slotKey: z.string().trim().min(1).max(1_000).nullable(),
          beforeUsed: z.number().int().nonnegative().nullable(),
          afterUsed: z.number().int().nonnegative().nullable()
        })
        .nullable()
        .default(null),
      featureResourceConsumption: encounterFeatureResourceReceiptDtoSchema.nullable().default(null),
      targetFeatureResourceConsumption: encounterFeatureResourceReceiptDtoSchema
        .nullable()
        .default(null),
      activeEffectTransitions: z.array(characterActiveEffectCreateReceiptDtoSchema).max(1),
      maintenanceTransition: maintainedEffectTransitionDtoSchema.nullable().optional(),
      d20: serverRuleExecutionD20EvidenceDtoSchema.nullable(),
      nestedD20: serverRuleExecutionNestedD20EvidenceDtoSchema.nullable().default(null),
      stateEffectTransitions: z.array(stateEffectCreateReceiptDtoSchema).max(1).default([]),
      targetTransition: z.strictObject({
        checksum: checksumSchema,
        before: characterMechanicsTargetStateDtoSchema,
        after: characterMechanicsTargetStateDtoSchema
      }),
      applications: z.array(characterMechanicsApplicationDtoSchema).max(RULE_GRAPH_LIMITS.NODES)
    })
    .superRefine((value, context) => {
      validateStateEffectTransitions({
        applications: value.applications,
        transitions: value.stateEffectTransitions,
        expectedOwnerKind: 'CHARACTER',
        context
      })
      const maintenance = value.maintenanceTransition ?? null
      if (maintenance) {
        if (
          maintenance.createdState.sourceOccurrenceId !== value.occurrenceId ||
          maintenance.createdState.sourceActorId !== value.sourceActorId
        )
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['maintenanceTransition'],
            message: 'Maintained replacement root binding is invalid.'
          })
        const dependentIds = new Set(maintenance.createdDependentEffectIds)
        if (
          value.activeEffectTransitions.length !== dependentIds.size ||
          value.activeEffectTransitions.some(
            (transition) =>
              transition.maintainedEffectStateId !== maintenance.createdState.id ||
              !dependentIds.has(transition.activeEffectId)
          )
        )
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['maintenanceTransition'],
            message: 'Maintained replacement created dependencies are invalid.'
          })
      } else if (
        value.activeEffectTransitions.some(
          (transition) => transition.maintainedEffectStateId !== null
        )
      )
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['activeEffectTransitions'],
          message: 'Unbound maintained active effects are invalid.'
        })
      let current = value.targetTransition.before.currentHitPoints
      let temporary = value.targetTransition.before.temporaryHitPoints
      let maximum = value.targetTransition.before.maximumHitPoints
      const conditions = new Set(value.targetTransition.before.conditionIds)
      const scalarValues = { ...value.targetTransition.before.scalarValues }
      for (const [index, application] of value.applications.entries()) {
        if (application.ordinal !== index)
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['applications', index, 'ordinal'],
            message: 'Character mechanics application ordinals must be contiguous.'
          })
        if (application.kind === 'CONDITION_APPLY' || application.kind === 'CONDITION_REMOVE') {
          const present = conditions.has(application.conditionId)
          const validTransition =
            application.kind === 'CONDITION_APPLY'
              ? application.afterPresent && application.applied === !present
              : application.applied
                ? present && !application.afterPresent
                : application.afterPresent === present
          if (application.beforePresent !== present || !validTransition)
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['applications', index],
              message: 'Condition receipt presence is invalid.'
            })
          if (application.afterPresent) conditions.add(application.conditionId)
          else conditions.delete(application.conditionId)
          continue
        }
        if (application.kind === 'HIT_POINT_MAXIMUM_REDUCTION') {
          const afterMaximum = Math.max(
            0,
            application.beforeMaximumHitPoints - application.reductionAmount
          )
          if (
            application.beforeMaximumHitPoints !== maximum ||
            application.afterMaximumHitPoints !== afterMaximum ||
            application.appliedAmount !== application.beforeMaximumHitPoints - afterMaximum ||
            application.requestedAmount !== application.reductionAmount ||
            application.resolvedAmount !== application.reductionAmount ||
            application.maximumHitPoints !== maximum ||
            application.beforeCurrentHitPoints !== current ||
            application.afterCurrentHitPoints !== Math.min(current, afterMaximum) ||
            application.beforeTemporaryHitPoints !== temporary ||
            application.afterTemporaryHitPoints !== temporary
          )
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['applications', index],
              message: 'Hit point maximum reduction receipt arithmetic is invalid.'
            })
          current = application.afterCurrentHitPoints
          maximum = application.afterMaximumHitPoints
          continue
        }
        if (application.kind === 'SCALAR_REDUCTION') {
          const beforeValue = scalarValues[application.valueDefinitionId]
          const afterValue = Math.max(application.floor, beforeValue - application.reductionAmount)
          if (
            !Number.isSafeInteger(beforeValue) ||
            beforeValue < 0 ||
            application.stacking !== 'ADDITIVE' ||
            application.floor !== 0 ||
            application.afterValue !== afterValue ||
            application.beforeValue !== beforeValue ||
            application.targetDied !== (afterValue === application.floor)
          )
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['applications', index],
              message: 'Scalar reduction receipt arithmetic is invalid.'
            })
          scalarValues[application.valueDefinitionId] = afterValue
          if (application.targetDied) current = 0
          continue
        }
        if (
          application.beforeCurrentHitPoints > application.maximumHitPoints ||
          application.afterCurrentHitPoints > application.maximumHitPoints ||
          application.beforeCurrentHitPoints !== current ||
          application.beforeTemporaryHitPoints !== temporary ||
          application.maximumHitPoints !== maximum
        )
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['applications', index],
            message: 'Character mechanics hit-point application chain is invalid.'
          })
        if (application.kind === 'HEAL') {
          const expectedApplied = Math.min(
            application.resolvedAmount,
            application.maximumHitPoints - application.beforeCurrentHitPoints
          )
          if (
            application.resolvedAmount !== application.requestedAmount ||
            application.afterTemporaryHitPoints !== application.beforeTemporaryHitPoints ||
            application.appliedAmount !== expectedApplied ||
            application.afterCurrentHitPoints !==
              application.beforeCurrentHitPoints + expectedApplied
          )
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['applications', index],
              message: 'Heal receipt arithmetic is invalid.'
            })
        } else if (application.kind === 'TEMPORARY_HIT_POINTS') {
          const expectedAfter = Math.max(
            application.beforeTemporaryHitPoints,
            application.resolvedAmount
          )
          if (
            application.resolvedAmount !== application.requestedAmount ||
            application.afterCurrentHitPoints !== application.beforeCurrentHitPoints ||
            application.appliedAmount !== expectedAfter - application.beforeTemporaryHitPoints ||
            application.afterTemporaryHitPoints !== expectedAfter
          )
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['applications', index],
              message: 'Temporary hit-point receipt arithmetic is invalid.'
            })
        } else if (application.kind === 'DAMAGE') {
          const expectedResolved =
            application.damageDisposition === 'IMMUNE'
              ? 0
              : application.damageDisposition === 'RESISTANT'
                ? Math.floor(application.requestedAmount / 2)
                : application.damageDisposition === 'VULNERABLE'
                  ? application.requestedAmount * 2
                  : application.requestedAmount
          const temporaryLost = Math.min(application.beforeTemporaryHitPoints, expectedResolved)
          const currentLost = Math.min(
            application.beforeCurrentHitPoints,
            expectedResolved - temporaryLost
          )
          if (
            application.resolvedAmount !== expectedResolved ||
            application.appliedAmount !== temporaryLost + currentLost ||
            application.afterCurrentHitPoints !==
              application.beforeCurrentHitPoints - currentLost ||
            application.afterTemporaryHitPoints !==
              application.beforeTemporaryHitPoints - temporaryLost
          )
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['applications', index],
              message: 'Damage receipt arithmetic is invalid.'
            })
        }
        current = application.afterCurrentHitPoints
        temporary = application.afterTemporaryHitPoints
      }
      const transitionAfter = value.targetTransition.after
      if (
        transitionAfter.currentHitPoints !== current ||
        transitionAfter.temporaryHitPoints !== temporary ||
        transitionAfter.maximumHitPoints !== maximum ||
        transitionAfter.conditionIds.length !== conditions.size ||
        transitionAfter.conditionIds.some(
          (conditionId, index) => [...conditions][index] !== conditionId
        ) ||
        JSON.stringify(transitionAfter.scalarValues) !== JSON.stringify(scalarValues)
      )
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Target transition is invalid.'
        })
      const resource = value.resourceConsumption
      const featureResource = value.featureResourceConsumption
      const targetFeatureResource = value.targetFeatureResourceConsumption
      if (
        resource &&
        (resource.afterUsed !== resource.beforeUsed + resource.cost ||
          resource.beforeRemaining < resource.cost ||
          resource.afterRemaining !== resource.beforeRemaining - resource.cost)
      )
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Resource receipt is invalid.'
        })
      if (
        featureResource &&
        (featureResource.ownerActorId !== value.sourceActorId ||
          featureResource.afterUsed !== featureResource.beforeUsed + featureResource.cost ||
          featureResource.beforeRemaining < featureResource.cost ||
          featureResource.afterRemaining !== featureResource.beforeRemaining - featureResource.cost)
      )
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['featureResourceConsumption'],
          message: 'Encounter feature resource receipt is invalid.'
        })
      if (resource !== null && featureResource !== null)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['featureResourceConsumption'],
          message: 'Character and Encounter feature resource receipts are mutually exclusive.'
        })
      if (
        targetFeatureResource &&
        (targetFeatureResource.ownerActorId !== value.targetActorId ||
          targetFeatureResource.afterUsed !==
            targetFeatureResource.beforeUsed + targetFeatureResource.cost ||
          targetFeatureResource.beforeRemaining < targetFeatureResource.cost ||
          targetFeatureResource.afterRemaining !==
            targetFeatureResource.beforeRemaining - targetFeatureResource.cost)
      )
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['targetFeatureResourceConsumption'],
          message: 'Target Encounter feature resource receipt is invalid.'
        })
      const contributorKeys = new Set<string>()
      for (const contributor of value.d20?.contributors ?? []) {
        const key = canonicalD20ContributorKey(contributor)
        if (contributorKeys.has(key))
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'd20 contributors must be unique.'
          })
        contributorKeys.add(key)
      }
      const influences = new Set(
        (value.d20?.contributors ?? []).map((contributor) => contributor.influence)
      )
      const expectedRollMode = influences.size === 1 ? [...influences][0] : 'NORMAL'
      if (value.d20 && value.d20.rollMode !== expectedRollMode)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'd20 contributor mode is invalid.'
        })
      const transitionChanged =
        value.targetTransition.before.currentHitPoints !==
          value.targetTransition.after.currentHitPoints ||
        value.targetTransition.before.temporaryHitPoints !==
          value.targetTransition.after.temporaryHitPoints ||
        value.targetTransition.before.maximumHitPoints !==
          value.targetTransition.after.maximumHitPoints ||
        value.targetTransition.before.conditionIds.some(
          (conditionId, index) => value.targetTransition.after.conditionIds[index] !== conditionId
        ) ||
        value.targetTransition.before.conditionIds.length !==
          value.targetTransition.after.conditionIds.length
      const hasResource = value.resourceConsumption !== null
      const hasActiveEffectCreation = value.activeEffectTransitions.length > 0
      if (value.maintenanceTransition && !hasActiveEffectCreation)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['maintenanceTransition'],
          message: 'Maintained state requires a created dependent effect.'
        })
      if (
        value.targetCharacterStreamVersion !==
        (transitionChanged ||
        (value.sourceActorId === value.targetActorId && hasResource) ||
        hasActiveEffectCreation
          ? value.targetCharacterStreamVersion
          : null)
      )
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Target stream version presence is invalid.'
        })
      if (
        (value.targetCharacterStreamVersion === null) !==
        !(
          transitionChanged ||
          (value.sourceActorId === value.targetActorId && hasResource) ||
          hasActiveEffectCreation
        )
      )
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Target stream version presence is invalid.'
        })
      const sourceCharacterMutation =
        value.sourceActorId !== value.targetActorId &&
        (hasResource || (maintenance?.characterOwnerTransitions.length ?? 0) > 0)
      if (sourceCharacterMutation === (value.sourceCharacterStreamVersion === null))
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Source stream version presence is invalid.'
        })
    })
])

/** Trusted parent-command correlation retained as canonical audit identity. */
export const serverRuleExecutionCorrelationIdDtoSchema = serverUuidIdentityDtoSchema.nullable()

const spatialMovementChangedAggregateDtoSchema = z.strictObject({
  aggregateKind: z.enum(['CHARACTER', 'ENCOUNTER', 'SCENE']),
  aggregateId: uuidSchema,
  beforeVersion: aggregateVersionSchema,
  version: aggregateVersionSchema
})

/** Server-only, non-executable command metadata retained with a rule receipt. */
export const serverRuleExecutionReceiptCommandMetadataDtoSchema = z
  .discriminatedUnion('transition', [
    z.strictObject({
      schemaVersion: z.literal(1),
      transition: z.literal('START'),
      definitionId: uuidSchema,
      expectedAggregateVersion: aggregateVersionSchema,
      factsChecksum: checksumSchema,
      optionalCombatSnapshotChecksum: checksumSchema.nullable().optional()
    }),
    z.strictObject({
      schemaVersion: z.literal(1),
      transition: z.literal('RESUME'),
      expectedAggregateVersion: aggregateVersionSchema,
      expectedOccurrenceVersion: aggregateVersionSchema,
      response: serverRuleEvidenceResponseDtoSchema,
      optionalCombatSnapshotChecksum: checksumSchema.nullable().optional()
    }),
    z.strictObject({
      schemaVersion: z.literal(1),
      transition: z.literal('OPTIONAL_COMBAT_CLEAVING'),
      commandType: z.literal('RESOLVE_RULE_OCCURRENCE'),
      expectedAggregateVersion: aggregateVersionSchema,
      expectedOccurrenceVersion: aggregateVersionSchema,
      response: z.discriminatedUnion('kind', [
        z.strictObject({ kind: z.literal('DECLINE') }),
        z.strictObject({ kind: z.literal('OPTION'), optionId: checksumSchema })
      ]),
      optionalCombatSnapshotChecksum: checksumSchema.nullable().optional()
    }),
    z.strictObject({
      schemaVersion: z.literal(1),
      transition: z.literal('TURN_EFFECTS'),
      commandType: z.enum(['START', 'ADVANCE_TURN']),
      expectedAggregateVersion: aggregateVersionSchema,
      selectionChecksum: checksumSchema.nullable(),
      initiativeChecksum: checksumSchema.nullable().default(null),
      initiativeAdvanceChecksum: checksumSchema.nullable().default(null),
      optionalCombatSnapshotChecksum: checksumSchema.nullable().optional(),
      terminalOccurrenceVersion: aggregateVersionSchema,
      resolutionCommands: z
        .array(turnResolutionCommandDtoSchema)
        .max(MAX_ENCOUNTER_TURN_ACTIVE_EFFECT_EXECUTIONS + RULE_GRAPH_LIMITS.NODES * 20)
    }),
    z.strictObject({
      schemaVersion: z.literal(1),
      transition: z.literal('TURN_EFFECTS_PENDING'),
      commandType: z.literal('RESOLVE_RULE_OCCURRENCE'),
      rootCommandId: uuidSchema,
      rootCommandFingerprint: checksumSchema,
      rootInitiatorUserId: uuidSchema,
      rootCorrelationId: uuidSchema.nullable(),
      expectedAggregateVersion: aggregateVersionSchema,
      optionalCombatSnapshotChecksum: checksumSchema.nullable().optional(),
      occurrenceVersion: aggregateVersionSchema,
      resolutionCommand: turnResolutionCommandDtoSchema
    }),
    z.strictObject({
      schemaVersion: z.literal(1),
      transition: z.literal('SPATIAL_MOVEMENT'),
      commandType: z.enum(['MOVE_SCENE_TOKEN', 'RESOLVE_RULE_OCCURRENCE']),
      rootCommandId: uuidSchema,
      rootCommandFingerprint: checksumSchema,
      rootInitiatorUserId: uuidSchema,
      rootCorrelationId: uuidSchema.nullable(),
      encounterId: uuidSchema,
      sceneId: uuidSchema,
      tokenId: uuidSchema,
      movementKind: spatialMovementKindDtoSchema,
      expectedEncounterVersion: aggregateVersionSchema,
      expectedSceneVersion: aggregateVersionSchema,
      rootExpectedEncounterVersion: aggregateVersionSchema,
      rootExpectedSceneVersion: aggregateVersionSchema,
      encounterVersionTransition: z.enum(['UNCHANGED', 'ADVANCED']),
      sceneVersionTransition: z.enum(['UNCHANGED', 'ADVANCED']),
      currentnessChecksum: checksumSchema.nullable(),
      selectionChecksum: checksumSchema,
      optionalCombatSnapshotChecksum: checksumSchema.nullable().optional(),
      occurrenceVersion: aggregateVersionSchema,
      changedAggregates: z
        .array(spatialMovementChangedAggregateDtoSchema)
        .max(MAX_SPATIAL_CANDIDATES + 4),
      resolutionCommands: z
        .array(movementRuleResolutionCommandDtoSchema)
        .max(MAX_SPATIAL_CANDIDATES)
    }),
    z.strictObject({
      schemaVersion: z.literal(1),
      transition: z.literal('MAINTENANCE_CLEANUP'),
      commandType: z.literal('REMOVE_ACTOR'),
      expectedAggregateVersion: aggregateVersionSchema,
      expectedOccurrenceVersion: aggregateVersionSchema.nullable().default(null),
      optionalCombatSnapshotChecksum: checksumSchema.nullable().optional(),
      removedActorId: uuidSchema
    })
  ])
  .superRefine((value, context) => {
    if (value.transition !== 'SPATIAL_MOVEMENT') return
    let priorAggregateKey = ''
    for (const [index, aggregate] of value.changedAggregates.entries()) {
      const key = `${aggregate.aggregateKind}:${aggregate.aggregateId}`
      if (
        key <= priorAggregateKey ||
        (aggregate.aggregateKind === 'ENCOUNTER' && aggregate.aggregateId !== value.encounterId) ||
        (aggregate.aggregateKind === 'SCENE' && aggregate.aggregateId !== value.sceneId) ||
        aggregate.version <= aggregate.beforeVersion
      )
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['changedAggregates', index],
          message:
            'Spatial changed aggregates must be unique, canonically ordered, and bound to the receipt roots.'
        })
      priorAggregateKey = key
    }
    const encounterChange = value.changedAggregates.find(
      (aggregate) => aggregate.aggregateKind === 'ENCOUNTER'
    )
    const sceneChange = value.changedAggregates.find(
      (aggregate) => aggregate.aggregateKind === 'SCENE'
    )
    const expectedEncounterChange =
      value.encounterVersionTransition === 'ADVANCED' ? value.expectedEncounterVersion + 1 : null
    const expectedSceneChange =
      value.sceneVersionTransition === 'ADVANCED' ? value.expectedSceneVersion + 1 : null
    if (
      (expectedEncounterChange === null) !== (encounterChange === undefined) ||
      (encounterChange !== undefined &&
        (encounterChange.beforeVersion !== value.expectedEncounterVersion ||
          encounterChange.version !== expectedEncounterChange))
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['changedAggregates'],
        message: 'Spatial changed aggregates must retain the exact Encounter transition.'
      })
    if (
      (expectedSceneChange === null) !== (sceneChange === undefined) ||
      (sceneChange !== undefined &&
        (sceneChange.beforeVersion !== value.expectedSceneVersion ||
          sceneChange.version !== expectedSceneChange))
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['changedAggregates'],
        message: 'Spatial changed aggregates must retain the exact Scene transition.'
      })
    if (
      value.changedAggregates.some((aggregate) => aggregate.aggregateKind === 'CHARACTER') &&
      value.encounterVersionTransition !== 'ADVANCED'
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['changedAggregates'],
        message: 'A spatial Character transition must advance the owning Encounter.'
      })
    validateCanonicalSpatialResolutionHistory(value.resolutionCommands, context, [
      'resolutionCommands'
    ])
    if (value.resolutionCommands.length !== value.occurrenceVersion)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['resolutionCommands'],
        message: 'Spatial terminal resolution history must match the occurrence version.'
      })
    if (
      value.commandType === 'MOVE_SCENE_TOKEN' &&
      (value.occurrenceVersion !== 0 ||
        value.resolutionCommands.length !== 0 ||
        value.expectedEncounterVersion !== value.rootExpectedEncounterVersion ||
        value.expectedSceneVersion !== value.rootExpectedSceneVersion)
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['commandType'],
        message: 'A root spatial movement receipt must be a fresh occurrence without resolutions.'
      })
    if (
      value.commandType === 'MOVE_SCENE_TOKEN' &&
      value.encounterVersionTransition === 'UNCHANGED' &&
      value.changedAggregates.some(
        (aggregate) =>
          aggregate.aggregateKind === 'CHARACTER' || aggregate.aggregateKind === 'ENCOUNTER'
      )
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['changedAggregates'],
        message: 'An unchanged root spatial receipt cannot retain Encounter or Character mechanics.'
      })
    if (value.commandType === 'RESOLVE_RULE_OCCURRENCE' && value.resolutionCommands.length === 0)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['resolutionCommands'],
        message: 'A spatial resolution receipt must retain its exact resolution history.'
      })
  })

export const serverRuleExecutionResumeInputDtoSchema = z.strictObject({
  continuation: serverRuleExecutionContinuationDtoSchema,
  response: serverRuleEvidenceResponseDtoSchema
})

/**
 * Server-only evidence. It may contain private consumed facts and operation values. Product services
 * must project/redact domain results before returning anything to a browser or live-session client.
 */
export const serverCompletedRuleExecutionDtoSchema = z.strictObject({
  status: z.literal('COMPLETE'),
  outputs: z.record(portNameSchema, ruleValueDtoSchema),
  /** Evaluator-owned movement directive. Non-movement coordinators reject STOP. */
  movementInterruption: z.union([z.null(), z.strictObject({ kind: z.literal('STOP') })]).optional(),
  evidence: z.strictObject({
    source: ruleGraphSourceIdentityDtoSchema,
    capabilityContractVersion: contractVersionSchema,
    facts: z.record(capabilityKeySchema, ruleValueDtoSchema),
    sourceEntryBindings: sourceEntryBindingsDtoSchema.optional(),
    vocabularyBindings: vocabularyBindingsDtoSchema.optional(),
    trace: z.array(serverRuleExecutionTraceEntryDtoSchema).max(RULE_GRAPH_LIMITS.NODES),
    outputs: z.record(portNameSchema, ruleValueDtoSchema)
  })
})

/**
 * A bounded action occurrence may execute an authored TEST phase and then one
 * selected OUTCOME phase. The executable plan itself is retained only by a
 * pending occurrence; this receipt records immutable identities and evidence.
 */
export const ruleExecutionPhaseReceiptDtoSchema = z
  .strictObject({
    phase: z.enum(['TEST', 'OUTCOME']),
    template: ruleGraphSourceIdentityDtoSchema,
    boundFactsChecksum: checksumSchema,
    specializedChecksum: checksumSchema,
    execution: serverCompletedRuleExecutionDtoSchema
  })
  .superRefine((value, context) => {
    const source = value.execution.evidence.source
    if (
      source.definitionId !== value.template.definitionId ||
      source.gameSystemId !== value.template.gameSystemId ||
      source.definitionFamilyKey !== value.template.definitionFamilyKey ||
      source.checksum !== value.specializedChecksum
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['execution', 'evidence', 'source'],
        message: 'Phase receipt execution must match its sealed source identity.'
      })
  })

export const ruleExecutionPhaseReceiptsDtoSchema = z
  .array(ruleExecutionPhaseReceiptDtoSchema)
  .min(1)
  .max(2)
  .superRefine((phases, context) => {
    if (phases[0]?.phase !== 'TEST') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [0, 'phase'],
        message: 'A phased action receipt must begin with its TEST phase.'
      })
    }
    if (phases.length === 2 && phases[1]?.phase !== 'OUTCOME') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [1, 'phase'],
        message: 'A phased action may retain only one OUTCOME phase after TEST.'
      })
    }
  })

export const serverRuleExecutionResultDtoSchema = z.discriminatedUnion('status', [
  serverCompletedRuleExecutionDtoSchema,
  z.strictObject({
    status: z.literal('PAUSED'),
    continuation: serverRuleExecutionContinuationDtoSchema
  })
])

/** Server-only receipt result with no executable continuation. */
export const manualRuleExecutionReminderDtoSchema = z.strictObject({
  kind: z.literal('MANUAL_RULE_REVIEW')
})

const turnEffectExecutionOwnerDtoSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('CHARACTER'), characterId: uuidSchema }),
  z.strictObject({ kind: z.literal('ENCOUNTER_ACTOR') })
])

const turnEffectTargetTransitionDtoSchema = z.strictObject({
  checksum: checksumSchema,
  before: characterMechanicsTargetStateDtoSchema,
  after: characterMechanicsTargetStateDtoSchema
})

const turnEffectCharacterTransitionDtoSchema = z.strictObject({
  characterId: uuidSchema,
  targetActorId: uuidSchema,
  beforeStreamVersion: aggregateVersionSchema,
  afterStreamVersion: aggregateVersionSchema,
  before: characterMechanicsTargetStateDtoSchema,
  after: characterMechanicsTargetStateDtoSchema
})

const turnEffectEncounterActorTransitionDtoSchema = z.strictObject({
  targetActorId: uuidSchema,
  before: characterMechanicsTargetStateDtoSchema,
  after: characterMechanicsTargetStateDtoSchema
})

const spatialEffectTransitionDtoSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('DELETE'),
    expectedVersion: aggregateVersionSchema,
    definitionChecksum: checksumSchema,
    lifecycleChecksum: checksumSchema,
    placementChecksum: checksumSchema,
    spatialStateChecksum: checksumSchema
  }),
  z.strictObject({
    kind: z.literal('UPDATE'),
    expectedVersion: aggregateVersionSchema,
    afterVersion: aggregateVersionSchema,
    definitionChecksum: checksumSchema,
    lifecycleChecksum: checksumSchema,
    placementChecksum: checksumSchema,
    beforeSpatialStateChecksum: checksumSchema,
    afterSpatialStateChecksum: checksumSchema,
    beforeRevealed: z.literal(false),
    afterRevealed: z.literal(true)
  }),
  z.strictObject({
    kind: z.literal('UNCHANGED'),
    expectedVersion: aggregateVersionSchema,
    definitionChecksum: checksumSchema,
    lifecycleChecksum: checksumSchema,
    placementChecksum: checksumSchema,
    spatialStateChecksum: checksumSchema
  })
])

const spatialEffectTransitionEntryDtoSchema = z.strictObject({
  effectId: uuidSchema,
  transition: spatialEffectTransitionDtoSchema
})

const refineSpatialEffectTransition = (
  effect: z.infer<typeof spatialEffectCurrentnessPinDtoSchema>,
  transition: z.infer<typeof spatialEffectTransitionDtoSchema>,
  context: z.RefinementCtx,
  path: (string | number)[]
) => {
  if (
    transition.expectedVersion !== effect.version ||
    transition.definitionChecksum !== effect.definitionChecksum ||
    transition.lifecycleChecksum !== effect.lifecycleChecksum ||
    transition.placementChecksum !== effect.placementChecksum
  )
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path,
      message: 'Spatial root transition must bind exact locked currentness.'
    })
  if (
    (transition.kind === 'DELETE' && effect.activation !== 'ONE_SHOT') ||
    (transition.kind === 'UPDATE' &&
      (effect.activation !== 'REPEATABLE' ||
        !effect.revealOnTrigger ||
        effect.revealed ||
        transition.afterVersion !== transition.expectedVersion + 1 ||
        transition.beforeSpatialStateChecksum !== effect.spatialStateChecksum ||
        transition.afterSpatialStateChecksum !==
          checksumRuleDocument({ schemaVersion: 1, revealed: true }))) ||
    (transition.kind === 'UNCHANGED' &&
      (effect.activation !== 'REPEATABLE' ||
        (!effect.revealed && effect.revealOnTrigger) ||
        transition.spatialStateChecksum !== effect.spatialStateChecksum)) ||
    (transition.kind === 'DELETE' &&
      transition.spatialStateChecksum !== effect.spatialStateChecksum)
  )
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path,
      message: 'Spatial root transition must use the closed one-shot or reveal-state lifecycle.'
    })
}

/** One target-bound execution of an Encounter/Scene-owned spatial root. */
const spatialMovementExecutionDtoSchema = z
  .strictObject({
    ordinal: z
      .number()
      .int()
      .min(0)
      .max(MAX_SPATIAL_CANDIDATES - 1),
    candidate: spatialPendingCandidateDtoSchema,
    execution: z.lazy(() => serverCompletedRuleExecutionDtoSchema),
    d20: serverRuleExecutionD20EvidenceDtoSchema.nullable(),
    targetTransition: z.strictObject({
      checksum: checksumSchema,
      before: characterMechanicsTargetStateDtoSchema,
      after: characterMechanicsTargetStateDtoSchema
    }),
    applications: z.array(characterMechanicsApplicationDtoSchema).max(RULE_GRAPH_LIMITS.NODES)
  })
  .superRefine((value, context) => {
    const effect = value.candidate.effect
    const evidence = value.execution.evidence
    if (
      evidence.source.definitionId !== effect.authoredEffectId ||
      evidence.source.checksum !== effect.frozenSourceChecksum ||
      evidence.capabilityContractVersion !== effect.capabilityContractVersion ||
      JSON.stringify(value.execution.outputs) !== JSON.stringify(evidence.outputs)
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['execution', 'evidence'],
        message: 'Spatial execution evidence must bind the frozen effect graph identity.'
      })
    const bindings =
      evidence.sourceEntryBindings?.filter(
        (binding) =>
          binding.sourceEntryId === effect.compiledEntryId &&
          binding.nodeId === effect.frozenGraphNodeId
      ) ?? []
    const sourceTraces = evidence.trace.filter((trace) => trace.nodeId === effect.frozenGraphNodeId)
    if (bindings.length !== 1 || sourceTraces.length !== 1)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['execution', 'evidence', 'sourceEntryBindings'],
        message: 'Spatial execution evidence must retain one frozen source-entry binding.'
      })
    if (value.targetTransition.checksum !== value.candidate.target.targetStateChecksum)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetTransition', 'checksum'],
        message: 'Spatial target transition must bind the exact frozen target currentness checksum.'
      })
    const d20RequestTraces = evidence.trace.filter(
      (trace) =>
        trace.operation.key === 'evidence.integer-range' &&
        trace.operation.contractVersion === 1 &&
        trace.inputs.min === 1 &&
        trace.inputs.max === 20 &&
        trace.evidence?.kind === 'INTEGER_RANGE'
    )
    const d20ResultTraces = evidence.trace.filter(
      (trace) =>
        typeof trace.inputs.naturalD20 === 'number' &&
        typeof trace.inputs.modifier === 'number' &&
        typeof trace.inputs.threshold === 'number' &&
        typeof trace.inputs.contributorChecksum === 'string' &&
        typeof trace.outputs.contributorChecksum === 'string' &&
        typeof trace.outputs.total === 'number' &&
        typeof trace.outputs.resultPath === 'string'
    )
    const hasD20Trace = d20RequestTraces.length > 0 || d20ResultTraces.length > 0
    if (
      (value.d20 === null && hasD20Trace) ||
      (value.d20 !== null && (d20RequestTraces.length !== 1 || d20ResultTraces.length !== 1))
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['d20'],
        message: 'Spatial d20 receipt presence must match its completed trace.'
      })
    if (value.d20 !== null) {
      const d20 = value.d20
      const requestMatches = d20RequestTraces.filter(
        (trace) =>
          trace.evidence?.requestId === d20.requestId &&
          trace.evidence?.value === d20.selectedNatural
      )
      const resultMatches = d20ResultTraces.filter(
        (trace) =>
          trace.outputs.targetActorId === value.candidate.candidate.targetActorId &&
          trace.inputs.naturalD20 === d20.selectedNatural &&
          trace.inputs.modifier === d20.modifier &&
          trace.inputs.threshold === d20.defenseOrDc &&
          trace.inputs.contributorChecksum === d20.contributorChecksum &&
          trace.outputs.contributorChecksum === d20.contributorChecksum &&
          trace.outputs.total === d20.total &&
          trace.outputs.resultPath === d20.resultPath
      )
      if (requestMatches.length !== 1 || resultMatches.length !== 1)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['d20'],
          message: 'Spatial d20 evidence must bind the exact completed trace.'
        })
    }
    const authorizedCandidates = evidence.trace
      .map((trace, traceIndex) => ({ trace, traceIndex }))
      .filter(
        ({ trace }) =>
          trace.outputs.applicationCandidate === true && trace.outputs.authorized === true
      )
    if (
      authorizedCandidates.some(
        ({ trace }) => trace.outputs.targetStateChecksum !== value.targetTransition.checksum
      )
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['applications'],
        message: 'Spatial application candidate checksum is invalid.'
      })
    const boundTraceIndexes = new Set<number>()
    let priorTraceIndex = -1
    for (const application of value.applications) {
      const matches = authorizedCandidates.filter(
        ({ trace }) =>
          trace.nodeId === application.sourceNodeId &&
          trace.operation.key === application.sourceOperationKey &&
          trace.outputs.targetActorId === value.candidate.candidate.targetActorId &&
          (trace.outputs.authoredPath ?? null) === application.authoredPath &&
          (trace.outputs.resolvedPath ?? null) === application.resolvedPath &&
          (application.kind === 'CONDITION_APPLY' || application.kind === 'CONDITION_REMOVE'
            ? trace.outputs.conditionId === application.conditionId
            : application.kind === 'SCALAR_REDUCTION'
              ? trace.outputs.amount === application.reductionAmount
              : trace.outputs.amount === application.requestedAmount &&
                (application.kind !== 'DAMAGE' ||
                  trace.outputs.damageTypeId === application.damageTypeId))
      )
      if (
        application.sourceNodeId !== effect.frozenGraphNodeId ||
        matches.length !== 1 ||
        matches[0]!.traceIndex <= priorTraceIndex ||
        boundTraceIndexes.has(matches[0]!.traceIndex)
      )
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['applications'],
          message: 'Spatial applications must bind ordered authorized effect trace candidates.'
        })
      else {
        priorTraceIndex = matches[0]!.traceIndex
        boundTraceIndexes.add(matches[0]!.traceIndex)
      }
    }
    if (
      authorizedCandidates.length !== boundTraceIndexes.size ||
      authorizedCandidates.some(({ traceIndex }) => !boundTraceIndexes.has(traceIndex))
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['applications'],
        message: 'Spatial applications must cover every authorized effect trace candidate.'
      })
  })

const turnEffectExecutionDtoSchema = z.strictObject({
  ordinal: z
    .number()
    .int()
    .min(0)
    .max(MAX_ENCOUNTER_TURN_ACTIVE_EFFECT_EXECUTIONS - 1),
  boundaryOrdinal: z.number().int().min(0).max(1),
  stage: z.enum(['START_OF_TURN', 'END_OF_TURN']),
  targetActorId: uuidSchema,
  owner: turnEffectExecutionOwnerDtoSchema,
  activeEffectId: uuidSchema,
  createdOrdinal: z.number().int().positive(),
  beforeVersion: aggregateVersionSchema,
  definition: z.strictObject({
    authoredEffectId: uuidSchema,
    compiledEntryId: uuidSchema,
    frozenGraphNodeId: localNodeIdSchema,
    frozenSourceChecksum: checksumSchema,
    capabilityContractVersion: contractVersionSchema,
    definitionChecksum: checksumSchema
  }),
  execution: serverCompletedRuleExecutionDtoSchema,
  d20: serverRuleExecutionD20EvidenceDtoSchema.nullable(),
  targetTransition: turnEffectTargetTransitionDtoSchema,
  applications: z.array(characterMechanicsApplicationDtoSchema).max(RULE_GRAPH_LIMITS.NODES),
  lifecycle: z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('UPDATE'),
      expectedVersion: aggregateVersionSchema,
      afterVersion: aggregateVersionSchema,
      beforeRemainingTicks: z.number().int().positive().nullable(),
      afterRemainingTicks: z.number().int().positive().nullable(),
      beforeLifecycleChecksum: checksumSchema,
      afterLifecycleChecksum: checksumSchema
    }),
    z.strictObject({
      kind: z.literal('EXPIRE'),
      expectedVersion: aggregateVersionSchema,
      beforeRemainingTicks: z.number().int().positive().nullable(),
      afterRemainingTicks: z.union([z.literal(0), z.null()]),
      beforeLifecycleChecksum: checksumSchema
    })
  ])
})

const spatialMovementCharacterTransitionDtoSchema = z.strictObject({
  characterId: uuidSchema,
  targetActorId: uuidSchema,
  beforeStreamVersion: aggregateVersionSchema,
  afterStreamVersion: aggregateVersionSchema,
  before: characterMechanicsTargetStateDtoSchema,
  after: characterMechanicsTargetStateDtoSchema
})

const spatialMovementEncounterActorTransitionDtoSchema = z.strictObject({
  targetActorId: uuidSchema,
  before: characterMechanicsTargetStateDtoSchema,
  after: characterMechanicsTargetStateDtoSchema
})

const completedTurnLifecyclePhaseEvidenceDtoSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('NONE'),
    selectionChecksum: checksumSchema.nullable()
  }),
  z.strictObject({
    kind: z.literal('MANUAL'),
    selectionChecksum: checksumSchema,
    reminder: manualRuleExecutionReminderDtoSchema.nullable()
  }),
  z.strictObject({
    kind: z.literal('EXECUTED'),
    selectionChecksum: checksumSchema,
    executions: z
      .array(turnEffectExecutionDtoSchema)
      .min(1)
      .max(MAX_ENCOUNTER_TURN_ACTIVE_EFFECT_EXECUTIONS),
    characterTransitions: z.array(turnEffectCharacterTransitionDtoSchema).min(0).max(2),
    encounterActorTransitions: z.array(turnEffectEncounterActorTransitionDtoSchema).min(0).max(2)
  })
])

export const storedRuleExecutionResultDtoSchema = z
  .union([
    z.strictObject({
      status: z.literal('PAUSED'),
      occurrenceId: uuidSchema,
      occurrenceVersion: aggregateVersionSchema,
      request: serverRuleIntegerRangeRequestDtoSchema,
      /** Closed public information needed to reconstruct an authorized pending response. */
      pending: z
        .discriminatedUnion('kind', [
          z.strictObject({
            kind: z.literal('D20_EVIDENCE'),
            rollMode: z.enum(['NORMAL', 'ADVANTAGE', 'DISADVANTAGE'])
          }),
          z
            .strictObject({
              kind: z.literal('INTEGER_RANGE_EVIDENCE'),
              phase: z.literal('OUTCOME'),
              requests: z
                .array(
                  z.strictObject({
                    requestId: z.string().min(1).max(256),
                    min: z.number().int(),
                    max: z.number().int()
                  })
                )
                .min(1)
                .max(31),
              exactRequestSetChecksum: checksumSchema
            })
            .superRefine((value, context) => {
              const ids = new Set<string>()
              for (const [index, request] of value.requests.entries()) {
                if (request.min >= request.max || ids.has(request.requestId)) {
                  context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['requests', index],
                    message: 'Outcome requests must be ordered, unique, and use a valid range.'
                  })
                }
                ids.add(request.requestId)
              }
              if (checksumRuleDocument(value.requests) !== value.exactRequestSetChecksum) {
                context.addIssue({
                  code: z.ZodIssueCode.custom,
                  path: ['exactRequestSetChecksum'],
                  message: 'Outcome request-set checksum is invalid.'
                })
              }
            }),
          z.strictObject({
            kind: z.literal('LEGENDARY_RESISTANCE_CHOICE'),
            targetActorId: uuidSchema,
            useOptionId: authoredIdentifierSchema
          })
        ])
        .nullable()
        .optional()
    }),
    z.strictObject({
      /** Exact actor-filtered result for one command that leaves an Encounter occurrence pending. */
      status: z.literal('ENCOUNTER_OCCURRENCE_PENDING'),
      schemaVersion: z.literal(1),
      occurrenceId: uuidSchema,
      occurrenceVersion: aggregateVersionSchema,
      encounterId: uuidSchema,
      encounterVersion: aggregateVersionSchema,
      occurrence: encounterRuleOccurrenceSummaryDtoSchema,
      /** Exact command-scoped Character mutations committed before the next pause. */
      characterTransitions: pendingSpatialCharacterTransitionsDtoSchema
    }),
    z.strictObject({
      /** Terminal evidence for one sealed aggregate-owned choice. */
      status: z.literal('AGGREGATE_CHOICE_COMPLETE'),
      schemaVersion: z.literal(1),
      occurrenceId: uuidSchema,
      occurrenceVersion: aggregateVersionSchema,
      applicationOutputs: serverRuleExecutionApplicationOutputsDtoSchema
    }),
    z.strictObject({
      status: z.literal('COMPLETE'),
      occurrenceId: uuidSchema,
      occurrenceVersion: aggregateVersionSchema,
      outputs: z.record(portNameSchema, ruleValueDtoSchema),
      evidence: serverCompletedRuleExecutionDtoSchema.shape.evidence,
      /** Absent for legacy single-phase receipts; present for bounded phased actions. */
      phaseReceipts: ruleExecutionPhaseReceiptsDtoSchema.optional(),
      applicationOutputs: serverRuleExecutionApplicationOutputsDtoSchema.default({
        kind: 'NONE'
      })
    }),
    z.strictObject({
      /** A recognized rule path recorded without kernel execution or state mutation. */
      status: z.literal('MANUAL'),
      occurrenceId: uuidSchema,
      occurrenceVersion: aggregateVersionSchema,
      reminder: manualRuleExecutionReminderDtoSchema.nullable(),
      initiative: encounterInitiativeSettlementDtoSchema.nullable().default(null),
      initiativeAdvance: encounterInitiativeAdvancePlanDtoSchema.nullable().default(null)
    }),
    z
      .strictObject({
        /** A normalized initiative lifecycle completed without an active turn-effect result. */
        status: z.literal('INITIATIVE_COMPLETE'),
        schemaVersion: z.literal(1),
        occurrenceId: uuidSchema,
        occurrenceVersion: aggregateVersionSchema,
        encounterId: uuidSchema,
        commandType: z.enum(['START', 'ADVANCE_TURN']),
        initiative: encounterInitiativeSettlementDtoSchema.nullable().default(null),
        initiativeAdvance: encounterInitiativeAdvancePlanDtoSchema.nullable().default(null)
      })
      .refine((result) => result.initiative !== null || result.initiativeAdvance !== null, {
        message: 'Initiative completion requires settlement or advancement evidence.'
      }),
    z
      .strictObject({
        /** One each-round turn transition spanning outgoing effects, initiative, and incoming effects. */
        status: z.literal('TURN_LIFECYCLE_COMPLETE'),
        schemaVersion: z.literal(1),
        occurrenceId: uuidSchema,
        occurrenceVersion: aggregateVersionSchema,
        encounterId: uuidSchema,
        commandType: z.literal('ADVANCE_TURN'),
        initiativeAdvance: encounterInitiativeAdvancePlanDtoSchema,
        initiative: encounterInitiativeSettlementDtoSchema.nullable(),
        rechargeExecutions: z
          .array(turnRechargeExecutionDtoSchema)
          .max(MAX_ENCOUNTER_TURN_RECHARGE_CANDIDATES)
          .default([]),
        legendaryActions: z
          .array(turnLegendaryActionEvidenceDtoSchema)
          .max(RULE_GRAPH_LIMITS.NODES)
          .default([]),
        legendaryActionRefreshes: z
          .array(turnLegendaryActionRefreshDtoSchema)
          .max(RULE_GRAPH_LIMITS.NODES)
          .default([]),
        outgoingTurn: completedTurnLifecyclePhaseEvidenceDtoSchema,
        incomingTurn: completedTurnLifecyclePhaseEvidenceDtoSchema
      })
      .superRefine((result, context) => {
        if (
          result.initiativeAdvance.kind === 'ROUND_WRAP' &&
          result.initiativeAdvance.cadence === 'EACH_ROUND'
        ) {
          if (
            !result.initiative ||
            result.initiative.round !== result.initiativeAdvance.nextRound ||
            result.initiative.cadence !== 'EACH_ROUND' ||
            checksumRuleDocument([...result.initiative.orderedActorIds].sort()) !==
              checksumRuleDocument([...result.initiativeAdvance.orderedActorIds].sort()) ||
            checksumRuleDocument([...result.initiative.orderedSideIds].sort()) !==
              checksumRuleDocument([...result.initiativeAdvance.orderedSideIds].sort())
          )
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['initiative'],
              message: 'Turn initiative settlement must match its sealed advancement.'
            })
        } else if (result.initiative !== null) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['initiative'],
            message: 'Turn initiative settlement must match its sealed advancement.'
          })
        }
        for (const [field, phase] of [
          ['outgoingTurn', result.outgoingTurn],
          ['incomingTurn', result.incomingTurn]
        ] as const) {
          if (phase.kind !== 'EXECUTED') continue
          const batch = storedRuleExecutionResultDtoSchema.safeParse({
            status: 'BATCH_COMPLETE',
            batchKind: 'ENCOUNTER_TURN_ACTIVE_EFFECTS',
            schemaVersion: 1,
            occurrenceId: result.occurrenceId,
            occurrenceVersion: result.occurrenceVersion,
            encounterId: result.encounterId,
            commandType: result.commandType,
            initiative: null,
            initiativeAdvance: null,
            executions: phase.executions,
            characterTransitions: phase.characterTransitions,
            encounterActorTransitions: phase.encounterActorTransitions
          })
          if (!batch.success)
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: [field],
              message: 'Turn phase must retain one valid terminal turn-effect batch.'
            })
        }
      }),
    z
      .strictObject({
        /** Aggregate-integrity cleanup performed while removing an Encounter actor. */
        status: z.literal('MAINTENANCE_COMPLETE'),
        schemaVersion: z.literal(1),
        occurrenceId: uuidSchema,
        occurrenceVersion: aggregateVersionSchema,
        encounterId: uuidSchema,
        removedActorId: uuidSchema,
        reason: z.literal('ACTOR_REMOVED'),
        terminatedStates: z
          .array(
            z.strictObject({
              id: uuidSchema,
              ownerActorId: uuidSchema,
              maintenanceDefinitionId: uuidSchema,
              expectedVersion: aggregateVersionSchema,
              descriptorChecksum: checksumSchema
            })
          )
          .max(MAX_MAINTENANCE_CLEANUP_TERMINATED_STATES),
        removedEffects: z
          .array(
            z.strictObject({
              kind: z.enum(['CHARACTER', 'ENCOUNTER_ACTOR']),
              ownerId: uuidSchema,
              activeEffectId: uuidSchema,
              createdOrdinal: z.number().int().positive(),
              expectedVersion: aggregateVersionSchema,
              definitionChecksum: checksumSchema,
              lifecycleChecksum: checksumSchema
            })
          )
          .max(MAX_MAINTENANCE_CLEANUP_REMOVED_EFFECTS),
        characterOwnerTransitions: z
          .array(
            z.strictObject({
              characterId: uuidSchema,
              beforeStreamVersion: aggregateVersionSchema,
              afterStreamVersion: aggregateVersionSchema
            })
          )
          .max(MAX_MAINTENANCE_CLEANUP_CHARACTER_TRANSITIONS)
      })
      .superRefine((value, context) => {
        const check = (entries: readonly string[], path: string) => {
          for (let index = 1; index < entries.length; index += 1)
            if (entries[index - 1]! >= entries[index]!)
              context.addIssue({
                code: z.ZodIssueCode.custom,
                path: [path, index],
                message: 'Maintenance cleanup entries must use canonical order.'
              })
        }
        check(
          value.terminatedStates.map((entry) => `${entry.ownerActorId}:${entry.id}`),
          'terminatedStates'
        )
        check(
          value.removedEffects.map(
            (entry) =>
              `${entry.kind}:${entry.ownerId}:${entry.createdOrdinal.toString().padStart(10, '0')}:${entry.activeEffectId}`
          ),
          'removedEffects'
        )
        check(
          value.characterOwnerTransitions.map((entry) => entry.characterId),
          'characterOwnerTransitions'
        )
        if (
          new Set(value.removedEffects.map((entry) => entry.activeEffectId)).size !==
          value.removedEffects.length
        )
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['removedEffects'],
            message: 'Maintenance cleanup effects must be unique.'
          })
        if (
          value.characterOwnerTransitions.some(
            (entry) => entry.afterStreamVersion !== entry.beforeStreamVersion + 1
          )
        )
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['characterOwnerTransitions'],
            message: 'Maintenance cleanup Character transitions must advance once.'
          })
      }),
    z.strictObject({
      /** A reaction-bearing movement completed without any spatial-effect execution. */
      status: z.literal('MOVEMENT_COMPLETE'),
      schemaVersion: z.literal(1),
      occurrenceId: uuidSchema,
      occurrenceVersion: aggregateVersionSchema,
      encounterId: uuidSchema,
      encounterVersion: aggregateVersionSchema,
      sceneId: uuidSchema,
      sceneVersion: aggregateVersionSchema,
      tokenId: uuidSchema,
      movementKind: spatialMovementKindDtoSchema,
      reactionExecutions: z
        .array(movementReactionActionExecutionDtoSchema)
        .max(RULE_GRAPH_LIMITS.NODES)
        .default([]),
      terminalPosition: spatialPointDtoSchema
    }),
    z
      .strictObject({
        status: z.literal('BATCH_COMPLETE'),
        batchKind: z.literal('ENCOUNTER_SPATIAL_MOVEMENT'),
        schemaVersion: z.literal(1),
        occurrenceId: uuidSchema,
        occurrenceVersion: aggregateVersionSchema,
        encounterId: uuidSchema,
        encounterVersion: aggregateVersionSchema,
        sceneId: uuidSchema,
        sceneVersion: aggregateVersionSchema,
        tokenId: uuidSchema,
        movementKind: spatialMovementKindDtoSchema,
        reactionExecutions: z
          .array(movementReactionActionExecutionDtoSchema)
          .max(RULE_GRAPH_LIMITS.NODES)
          .default([]),
        terminalPosition: spatialPointDtoSchema,
        executions: z.array(spatialMovementExecutionDtoSchema).min(1).max(MAX_SPATIAL_CANDIDATES),
        spatialEffectTransitions: z
          .array(spatialEffectTransitionEntryDtoSchema)
          .min(1)
          .max(MAX_SPATIAL_CANDIDATES),
        characterTransitions: z
          .array(spatialMovementCharacterTransitionDtoSchema)
          .max(MAX_SPATIAL_CANDIDATES),
        encounterActorTransitions: z
          .array(spatialMovementEncounterActorTransitionDtoSchema)
          .max(MAX_SPATIAL_CANDIDATES)
      })
      .superRefine((batch, context) => {
        const ownerKeys = new Set<string>()
        const transitions = new Map<
          string,
          {
            targetActorId: string
            before: z.infer<typeof characterMechanicsTargetStateDtoSchema>
            after: z.infer<typeof characterMechanicsTargetStateDtoSchema>
          }
        >()
        const actorIds = new Set<string>()
        let priorCharacterId = ''
        for (const [index, transition] of batch.characterTransitions.entries()) {
          if (
            transition.afterStreamVersion !== transition.beforeStreamVersion + 1 ||
            ownerKeys.has(transition.characterId) ||
            actorIds.has(transition.targetActorId) ||
            JSON.stringify(transition.before) === JSON.stringify(transition.after) ||
            transition.characterId <= priorCharacterId
          )
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['characterTransitions', index],
              message:
                'Spatial Character transitions must be unique, ordered, and advance exactly once.'
            })
          ownerKeys.add(transition.characterId)
          actorIds.add(transition.targetActorId)
          transitions.set(`CHARACTER:${transition.characterId}`, transition)
          priorCharacterId = transition.characterId
        }
        let priorActorId = ''
        for (const [index, transition] of batch.encounterActorTransitions.entries()) {
          if (
            actorIds.has(transition.targetActorId) ||
            JSON.stringify(transition.before) === JSON.stringify(transition.after) ||
            transition.targetActorId <= priorActorId
          )
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['encounterActorTransitions', index],
              message: 'Spatial Encounter actor transitions must be unique and ordered.'
            })
          actorIds.add(transition.targetActorId)
          transitions.set(`ENCOUNTER_ACTOR:${transition.targetActorId}`, transition)
          priorActorId = transition.targetActorId
        }
        const candidateKeys = new Set<string>()
        const effects = new Map<string, z.infer<typeof spatialEffectCurrentnessPinDtoSchema>>()
        const current = new Map<string, z.infer<typeof characterMechanicsTargetStateDtoSchema>>()
        const initial = new Map<string, z.infer<typeof characterMechanicsTargetStateDtoSchema>>()
        let prior: z.infer<typeof spatialPendingCandidateDtoSchema> | null = null
        for (const [index, execution] of batch.executions.entries()) {
          const candidate = execution.candidate
          const key = `${candidate.candidate.pathDistance}:${candidate.candidate.effectId}:${candidate.candidate.targetActorId}:${candidate.candidate.trigger}:${candidate.candidate.sourceActorId ?? ''}:${candidate.candidate.sourceMoved}`
          if (
            execution.ordinal !== index ||
            candidate.ordinal !== index ||
            candidateKeys.has(key) ||
            (prior !== null && compareSpatialPendingCandidates(prior, candidate) >= 0)
          )
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['executions', index],
              message:
                'Spatial terminal executions must retain the strict ordered candidate sequence.'
            })
          candidateKeys.add(key)
          prior = candidate
          const priorEffect = effects.get(candidate.effect.effectId)
          if (
            priorEffect !== undefined &&
            JSON.stringify(priorEffect) !== JSON.stringify(candidate.effect)
          )
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['executions', index, 'candidate', 'effect'],
              message:
                'Spatial executions for one root must retain an identical frozen currentness snapshot.'
            })
          effects.set(candidate.effect.effectId, candidate.effect)
          const ownerKey =
            candidate.target.kind === 'CHARACTER'
              ? `CHARACTER:${candidate.target.characterId}`
              : `ENCOUNTER_ACTOR:${candidate.candidate.targetActorId}`
          const transition = transitions.get(ownerKey)
          const priorState = current.get(ownerKey) ?? execution.targetTransition.before
          if (!initial.has(ownerKey)) initial.set(ownerKey, execution.targetTransition.before)
          if (
            JSON.stringify(priorState) !== JSON.stringify(execution.targetTransition.before) ||
            (transition !== undefined &&
              transition.targetActorId !== candidate.candidate.targetActorId)
          )
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['executions', index, 'targetTransition'],
              message:
                'Spatial target transitions must have exact owner coverage and chain in execution order.'
            })
          current.set(ownerKey, execution.targetTransition.after)
        }
        let priorEffectId = ''
        const transitionedEffectIds = new Set<string>()
        for (const [index, entry] of batch.spatialEffectTransitions.entries()) {
          const effect = effects.get(entry.effectId)
          if (
            transitionedEffectIds.has(entry.effectId) ||
            entry.effectId <= priorEffectId ||
            effect === undefined
          )
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['spatialEffectTransitions', index],
              message:
                'Spatial root transitions must be unique, canonical, and match executed roots.'
            })
          if (effect !== undefined)
            refineSpatialEffectTransition(effect, entry.transition, context, [
              'spatialEffectTransitions',
              index,
              'transition'
            ])
          transitionedEffectIds.add(entry.effectId)
          priorEffectId = entry.effectId
        }
        if (
          transitionedEffectIds.size !== effects.size ||
          [...effects.keys()].some((effectId) => !transitionedEffectIds.has(effectId))
        )
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['spatialEffectTransitions'],
            message:
              'Spatial terminal batches must retain exactly one root transition per executed effect.'
          })
        for (const [ownerKey, finalState] of current) {
          const transition = transitions.get(ownerKey)
          const initialState = initial.get(ownerKey)!
          const changed = JSON.stringify(initialState) !== JSON.stringify(finalState)
          if (
            (changed && transition === undefined) ||
            (!changed && transition !== undefined) ||
            (transition !== undefined &&
              JSON.stringify(finalState) !== JSON.stringify(transition.after))
          )
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['characterTransitions'],
              message:
                'Spatial owner transitions must exactly represent the net ordered execution chain.'
            })
        }
      }),
    z
      .strictObject({
        status: z.literal('BATCH_COMPLETE'),
        batchKind: z.literal('ENCOUNTER_TURN_ACTIVE_EFFECTS'),
        schemaVersion: z.literal(1),
        occurrenceId: uuidSchema,
        occurrenceVersion: aggregateVersionSchema,
        encounterId: uuidSchema,
        commandType: z.enum(['START', 'ADVANCE_TURN']),
        initiative: encounterInitiativeSettlementDtoSchema.nullable().default(null),
        initiativeAdvance: encounterInitiativeAdvancePlanDtoSchema.nullable().default(null),
        rechargeExecutions: z
          .array(turnRechargeExecutionDtoSchema)
          .max(MAX_ENCOUNTER_TURN_RECHARGE_CANDIDATES)
          .default([]),
        executions: z
          .array(turnEffectExecutionDtoSchema)
          .min(1)
          .max(MAX_ENCOUNTER_TURN_ACTIVE_EFFECT_EXECUTIONS),
        characterTransitions: z.array(turnEffectCharacterTransitionDtoSchema).min(0).max(2),
        encounterActorTransitions: z
          .array(turnEffectEncounterActorTransitionDtoSchema)
          .min(0)
          .max(2)
      })
      .superRefine((batch, context) => {
        const transitions = new Map<
          string,
          {
            targetActorId: string
            before: z.infer<typeof characterMechanicsTargetStateDtoSchema>
            after: z.infer<typeof characterMechanicsTargetStateDtoSchema>
          }
        >()
        const transitionActorIds = new Set<string>()
        let priorCharacterId = ''
        for (const [index, transition] of batch.characterTransitions.entries()) {
          if (
            transition.afterStreamVersion !== transition.beforeStreamVersion + 1 ||
            transitions.has(transition.characterId) ||
            transitionActorIds.has(transition.targetActorId)
          )
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['characterTransitions', index],
              message: 'Turn-effect Character transitions must be unique and advance exactly once.'
            })
          if (transition.characterId <= priorCharacterId)
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['characterTransitions', index, 'characterId'],
              message: 'Turn-effect Character transitions must use canonical Character UUID order.'
            })
          priorCharacterId = transition.characterId
          transitions.set(`CHARACTER:${transition.characterId}`, transition)
          transitionActorIds.add(transition.targetActorId)
        }
        let priorEncounterActorId = ''
        for (const [index, transition] of batch.encounterActorTransitions.entries()) {
          if (transitionActorIds.has(transition.targetActorId))
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['encounterActorTransitions', index],
              message: 'Turn-effect target actors must be unique across owner transitions.'
            })
          if (transition.targetActorId <= priorEncounterActorId)
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['encounterActorTransitions', index, 'targetActorId'],
              message:
                'Turn-effect Encounter actor transitions must use canonical actor UUID order.'
            })
          priorEncounterActorId = transition.targetActorId
          transitions.set(`ENCOUNTER_ACTOR:${transition.targetActorId}`, transition)
          transitionActorIds.add(transition.targetActorId)
        }
        if (transitions.size === 0 || transitions.size > 2)
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['characterTransitions'],
            message: 'Turn-effect batches must retain one or two distinct owner transitions.'
          })
        const effectIds = new Set<string>()
        const current = new Map<
          string,
          (typeof batch.executions)[number]['targetTransition']['after']
        >()
        let boundary = -1
        let createdOrdinal = -1
        let effectId = ''
        for (const [index, execution] of batch.executions.entries()) {
          if (execution.ordinal !== index || effectIds.has(execution.activeEffectId))
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['executions', index],
              message: 'Turn-effect execution identity or ordinal is invalid.'
            })
          effectIds.add(execution.activeEffectId)
          if (
            execution.boundaryOrdinal < boundary ||
            (execution.boundaryOrdinal === boundary &&
              (execution.createdOrdinal < createdOrdinal ||
                (execution.createdOrdinal === createdOrdinal &&
                  execution.activeEffectId <= effectId)))
          )
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['executions', index],
              message: 'Turn-effect execution order is invalid.'
            })
          boundary = execution.boundaryOrdinal
          createdOrdinal = execution.createdOrdinal
          effectId = execution.activeEffectId
          const ownerKey =
            execution.owner.kind === 'CHARACTER'
              ? `CHARACTER:${execution.owner.characterId}`
              : `ENCOUNTER_ACTOR:${execution.targetActorId}`
          const transition = transitions.get(ownerKey)
          const before = current.get(ownerKey) ?? transition?.before
          if (
            !transition ||
            transition.targetActorId !== execution.targetActorId ||
            JSON.stringify(before) !== JSON.stringify(execution.targetTransition.before)
          )
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['executions', index, 'targetTransition'],
              message: 'Turn-effect Character target transitions must chain.'
            })
          current.set(ownerKey, execution.targetTransition.after)
          const updateLifecycleIsValid =
            execution.lifecycle.kind !== 'UPDATE' ||
            (execution.lifecycle.beforeRemainingTicks === null
              ? execution.lifecycle.afterRemainingTicks === null
              : execution.lifecycle.beforeRemainingTicks >= 2 &&
                execution.lifecycle.afterRemainingTicks ===
                  execution.lifecycle.beforeRemainingTicks - 1)
          const expireLifecycleIsValid =
            execution.lifecycle.kind !== 'EXPIRE' ||
            (execution.lifecycle.beforeRemainingTicks === null
              ? execution.lifecycle.afterRemainingTicks === null
              : execution.lifecycle.beforeRemainingTicks >= 1 &&
                execution.lifecycle.afterRemainingTicks === 0)
          if (
            execution.beforeVersion < 1 ||
            execution.lifecycle.expectedVersion !== execution.beforeVersion ||
            (execution.lifecycle.kind === 'UPDATE' &&
              execution.lifecycle.afterVersion !== execution.beforeVersion + 1) ||
            !updateLifecycleIsValid ||
            !expireLifecycleIsValid
          )
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['executions', index, 'lifecycle'],
              message: 'Turn-effect lifecycle versions or ticks are invalid.'
            })
          if (
            execution.execution.evidence.source.definitionId !==
              execution.definition.authoredEffectId ||
            execution.execution.evidence.source.checksum !==
              execution.definition.frozenSourceChecksum ||
            execution.execution.evidence.capabilityContractVersion !==
              execution.definition.capabilityContractVersion
          )
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['executions', index, 'execution', 'evidence'],
              message:
                'Turn-effect execution evidence does not match its frozen definition identity.'
            })
          const bindings =
            execution.execution.evidence.sourceEntryBindings?.filter(
              (binding) =>
                binding.sourceEntryId === execution.definition.compiledEntryId &&
                binding.nodeId === execution.definition.frozenGraphNodeId
            ) ?? []
          const sourceTraces = execution.execution.evidence.trace.filter(
            (trace) => trace.nodeId === execution.definition.frozenGraphNodeId
          )
          if (bindings.length !== 1 || sourceTraces.length !== 1)
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['executions', index, 'definition'],
              message: 'Turn-effect source-entry evidence binding is invalid.'
            })
          const d20RequestTraces = execution.execution.evidence.trace.filter(
            (trace) =>
              trace.operation.key === 'evidence.integer-range' &&
              trace.operation.contractVersion === 1 &&
              trace.inputs.min === 1 &&
              trace.inputs.max === 20 &&
              trace.evidence?.kind === 'INTEGER_RANGE'
          )
          const d20ResultTraces = execution.execution.evidence.trace.filter(
            (trace) =>
              typeof trace.inputs.naturalD20 === 'number' &&
              typeof trace.inputs.modifier === 'number' &&
              typeof trace.inputs.threshold === 'number' &&
              typeof trace.inputs.contributorChecksum === 'string' &&
              typeof trace.outputs.contributorChecksum === 'string' &&
              typeof trace.outputs.total === 'number' &&
              typeof trace.outputs.resultPath === 'string'
          )
          const hasD20Trace = d20RequestTraces.length > 0 || d20ResultTraces.length > 0
          if (
            (execution.d20 === null && hasD20Trace) ||
            (execution.d20 !== null &&
              (d20RequestTraces.length !== 1 || d20ResultTraces.length !== 1))
          )
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['executions', index, 'd20'],
              message: 'Turn-effect d20 receipt presence does not match its completed trace.'
            })
          const hasBoundD20Trace =
            execution.d20 !== null && d20RequestTraces.length === 1 && d20ResultTraces.length === 1
          const unauthorizedSourceOutcome =
            execution.applications.length === 0 &&
            execution.execution.evidence.trace.filter(
              (trace) =>
                trace.nodeId === execution.definition.frozenGraphNodeId &&
                trace.outputs.applicationCandidate === true &&
                trace.outputs.authorized === false &&
                trace.outputs.targetActorId === execution.targetActorId &&
                trace.outputs.targetStateChecksum === execution.targetTransition.checksum &&
                ((trace.outputs.conditionId !== undefined &&
                  serverUuidIdentityDtoSchema.safeParse(trace.outputs.conditionId).success &&
                  serverUuidIdentityDtoSchema.parse(trace.outputs.conditionId) ===
                    trace.outputs.conditionId) ||
                  hasBoundD20Trace)
            ).length === 1 &&
            !execution.execution.evidence.trace.some(
              (trace) =>
                trace.outputs.applicationCandidate === true && trace.outputs.authorized === true
            )
          if (
            (!unauthorizedSourceOutcome && execution.applications.length === 0) ||
            JSON.stringify(execution.execution.outputs) !==
              JSON.stringify(execution.execution.evidence.outputs)
          )
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['executions', index, 'execution'],
              message: 'Turn-effect execution outputs or applications are invalid.'
            })
          const changed =
            JSON.stringify(execution.targetTransition.before) !==
            JSON.stringify(execution.targetTransition.after)
          const applicationValidation = serverRuleExecutionApplicationOutputsDtoSchema.safeParse(
            execution.owner.kind === 'CHARACTER'
              ? {
                  kind: 'CHARACTER_MECHANICS_BATCH',
                  schemaVersion: 1,
                  occurrenceId: batch.occurrenceId,
                  sourceActorId: execution.targetActorId,
                  sourceCharacterId: execution.owner.characterId,
                  targetActorId: execution.targetActorId,
                  sourceCharacterStreamVersion: null,
                  targetCharacterStreamVersion: changed ? 1 : null,
                  resourceConsumption: null,
                  activeEffectTransitions: [],
                  d20: execution.d20,
                  targetTransition: execution.targetTransition,
                  applications: execution.applications
                }
              : {
                  kind: 'ENCOUNTER_ACTOR_MECHANICS_BATCH',
                  schemaVersion: 1,
                  occurrenceId: batch.occurrenceId,
                  sourceActorId: execution.targetActorId,
                  targetActorId: execution.targetActorId,
                  sourceCharacterStreamVersion: null,
                  resourceConsumption: null,
                  featureResourceConsumption: null,
                  targetFeatureResourceConsumption: null,
                  d20: execution.d20,
                  targetTransition: execution.targetTransition,
                  applications: execution.applications
                }
          )
          if (!unauthorizedSourceOutcome && !applicationValidation.success)
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['executions', index, 'applications'],
              message: 'Turn-effect applications are not a valid canonical owner application chain.'
            })
          if (execution.d20) {
            const d20 = execution.d20
            const requestTraces = d20RequestTraces.filter(
              (trace) =>
                trace.evidence?.requestId === d20.requestId &&
                trace.evidence?.value === d20.selectedNatural
            )
            const resultTraces = d20ResultTraces.filter(
              (trace) =>
                trace.outputs.targetActorId === execution.targetActorId &&
                trace.inputs.naturalD20 === d20.selectedNatural &&
                trace.inputs.modifier === d20.modifier &&
                trace.inputs.threshold === d20.defenseOrDc &&
                trace.inputs.contributorChecksum === d20.contributorChecksum &&
                trace.outputs.contributorChecksum === d20.contributorChecksum &&
                trace.outputs.total === d20.total &&
                trace.outputs.resultPath === d20.resultPath
            )
            if (
              requestTraces.length !== 1 ||
              resultTraces.length !== 1 ||
              execution.execution.outputs.targetActorId !== execution.targetActorId ||
              execution.execution.outputs.naturalD20 !== d20.selectedNatural ||
              execution.execution.outputs.total !== d20.total ||
              execution.execution.outputs.resultPath !== d20.resultPath ||
              execution.execution.outputs.contributorChecksum !== d20.contributorChecksum ||
              execution.execution.evidence.outputs.targetActorId !== execution.targetActorId ||
              execution.execution.evidence.outputs.naturalD20 !== d20.selectedNatural ||
              execution.execution.evidence.outputs.total !== d20.total ||
              execution.execution.evidence.outputs.resultPath !== d20.resultPath ||
              execution.execution.evidence.outputs.contributorChecksum !== d20.contributorChecksum
            )
              context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['executions', index, 'd20'],
                message: 'Turn-effect d20 evidence does not match its completed trace.'
              })
            if (
              unauthorizedSourceOutcome &&
              sourceTraces[0]!.outputs.resolvedPath !== d20.resultPath
            )
              context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['executions', index, 'd20'],
                message: 'Unauthorized turn-effect outcome does not match its d20 result path.'
              })
          }
          const authorizedCandidates = execution.execution.evidence.trace
            .map((trace, traceIndex) => ({ trace, traceIndex }))
            .filter(
              ({ trace }) =>
                trace.outputs.applicationCandidate === true && trace.outputs.authorized === true
            )
          if (
            authorizedCandidates.some(
              ({ trace }) =>
                trace.outputs.targetStateChecksum !== execution.targetTransition.checksum
            )
          )
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['executions', index, 'applications'],
              message: 'Turn-effect application candidate checksum is invalid.'
            })
          const candidates = authorizedCandidates.filter(
            ({ trace }) => trace.outputs.targetStateChecksum === execution.targetTransition.checksum
          )
          const boundTraceIndexes = new Set<number>()
          let priorTraceIndex = -1
          for (const application of execution.applications) {
            if (application.sourceNodeId !== execution.definition.frozenGraphNodeId)
              context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['executions', index, 'applications'],
                message: 'Turn-effect application source node is invalid.'
              })
            const matches = candidates.filter(
              ({ trace }) =>
                trace.nodeId === application.sourceNodeId &&
                trace.operation.key === application.sourceOperationKey &&
                trace.outputs.targetActorId === execution.targetActorId &&
                (trace.outputs.authoredPath ?? null) === application.authoredPath &&
                (trace.outputs.resolvedPath ?? null) === application.resolvedPath &&
                (application.kind === 'CONDITION_APPLY' || application.kind === 'CONDITION_REMOVE'
                  ? trace.outputs.conditionId === application.conditionId
                  : application.kind === 'SCALAR_REDUCTION'
                    ? trace.outputs.amount === application.reductionAmount
                    : trace.outputs.amount === application.requestedAmount &&
                      (application.kind !== 'DAMAGE' ||
                        trace.outputs.damageTypeId === application.damageTypeId))
            )
            if (
              matches.length !== 1 ||
              matches[0]!.traceIndex <= priorTraceIndex ||
              boundTraceIndexes.has(matches[0]!.traceIndex)
            )
              context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['executions', index, 'applications'],
                message: 'Turn-effect application trace binding is invalid.'
              })
            else {
              priorTraceIndex = matches[0]!.traceIndex
              boundTraceIndexes.add(matches[0]!.traceIndex)
            }
          }
          if (
            !unauthorizedSourceOutcome &&
            (authorizedCandidates.length !== boundTraceIndexes.size ||
              authorizedCandidates.some(({ traceIndex }) => !boundTraceIndexes.has(traceIndex)))
          )
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['executions', index, 'applications'],
              message: 'Turn-effect application candidate coverage is invalid.'
            })
        }
        if (
          batch.commandType === 'START' &&
          batch.executions.some(
            (execution) => execution.boundaryOrdinal !== 0 || execution.stage !== 'START_OF_TURN'
          )
        )
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['executions'],
            message: 'START turn effects must be START_OF_TURN at boundary zero.'
          })
        if (
          batch.commandType === 'ADVANCE_TURN' &&
          batch.executions.some(
            (execution) =>
              (execution.boundaryOrdinal === 0 && execution.stage !== 'END_OF_TURN') ||
              (execution.boundaryOrdinal === 1 && execution.stage !== 'START_OF_TURN')
          )
        )
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['executions'],
            message: 'ADVANCE_TURN turn-effect stages are invalid.'
          })
        for (const [ownerKey, transition] of transitions)
          if (JSON.stringify(current.get(ownerKey)) !== JSON.stringify(transition.after))
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['characterTransitions'],
              message: 'Turn-effect target transition final state is invalid.'
            })
      })
  ])
  .superRefine((value, context) => {
    if (
      value.status === 'COMPLETE' &&
      'applicationOutputs' in value &&
      'phaseReceipts' in value &&
      (value.applicationOutputs.kind === 'CHARACTER_MECHANICS_BATCH' ||
        value.applicationOutputs.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH')
    ) {
      const directBatch = value.applicationOutputs
      const outcomeReceipt = value.phaseReceipts?.[1]
      const outcomeExecution = outcomeReceipt?.phase === 'OUTCOME' ? outcomeReceipt.execution : null
      const nested = directBatch.nestedD20
      const requestTraces = outcomeExecution
        ? outcomeExecution.evidence.trace.filter(
            (trace) =>
              trace.operation.key === 'evidence.integer-range' &&
              trace.operation.contractVersion === 1 &&
              trace.inputs.min === 1 &&
              trace.inputs.max === 20 &&
              trace.evidence?.kind === 'INTEGER_RANGE'
          )
        : []
      const saveTraces = outcomeExecution
        ? outcomeExecution.evidence.trace.filter(
            (trace) =>
              typeof trace.inputs.naturalD20 === 'number' &&
              typeof trace.inputs.modifier === 'number' &&
              typeof trace.inputs.threshold === 'number' &&
              typeof trace.inputs.contributorChecksum === 'string' &&
              typeof trace.outputs.contributorChecksum === 'string' &&
              typeof trace.outputs.total === 'number' &&
              typeof trace.outputs.resultPath === 'string'
          )
        : []
      if (nested !== null) {
        const requestMatches = requestTraces.filter(
          (trace) =>
            trace.nodeId === nested.requestNodeId &&
            trace.evidence?.requestId === nested.requestId &&
            trace.evidence.value === nested.selectedNatural
        )
        const saveMatches = saveTraces.filter(
          (trace) =>
            trace.inputs.naturalD20 === nested.selectedNatural &&
            trace.inputs.modifier === nested.modifier &&
            trace.inputs.threshold === nested.defenseOrDc &&
            trace.inputs.contributorChecksum === nested.contributorChecksum &&
            trace.outputs.contributorChecksum === nested.contributorChecksum &&
            trace.outputs.total === nested.total &&
            trace.outputs.resultPath === nested.resultPath
        )
        if (!outcomeExecution || requestMatches.length !== 1 || saveMatches.length !== 1)
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['applicationOutputs', 'nestedD20'],
            message: 'Nested d20 evidence must bind one exact completed OUTCOME save trace.'
          })
      }
    }
    if (
      value.status === 'COMPLETE' &&
      value.applicationOutputs.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH' &&
      value.applicationOutputs.legendaryResistance
    ) {
      const legendaryResistance = value.applicationOutputs.legendaryResistance
      const original = legendaryResistance.originalExecution
      const choice = legendaryResistance.execution
      const d20 = legendaryResistance.originalD20
      const d20RequestTraces = original.evidence.trace.filter(
        (trace) =>
          trace.operation.key === 'evidence.integer-range' &&
          trace.operation.contractVersion === 1 &&
          trace.inputs.min === 1 &&
          trace.inputs.max === 20 &&
          trace.evidence?.kind === 'INTEGER_RANGE'
      )
      const d20ResultTraces = original.evidence.trace.filter(
        (trace) =>
          typeof trace.inputs.naturalD20 === 'number' &&
          typeof trace.inputs.modifier === 'number' &&
          typeof trace.inputs.threshold === 'number' &&
          typeof trace.inputs.contributorChecksum === 'string' &&
          typeof trace.outputs.contributorChecksum === 'string' &&
          typeof trace.outputs.total === 'number' &&
          typeof trace.outputs.resultPath === 'string'
      )
      const hasExactOriginalD20Trace =
        d20RequestTraces.length === 1 &&
        d20ResultTraces.length === 1 &&
        d20RequestTraces.filter(
          (trace) =>
            trace.evidence?.requestId === d20.requestId &&
            trace.evidence.value === d20.selectedNatural
        ).length === 1 &&
        d20ResultTraces.filter(
          (trace) =>
            trace.inputs.naturalD20 === d20.selectedNatural &&
            trace.inputs.modifier === d20.modifier &&
            trace.inputs.threshold === d20.defenseOrDc &&
            trace.inputs.contributorChecksum === d20.contributorChecksum &&
            trace.outputs.contributorChecksum === d20.contributorChecksum &&
            trace.outputs.total === d20.total &&
            trace.outputs.resultPath === d20.resultPath
        ).length === 1
      if (
        checksumRuleDocument({
          outputs: value.outputs,
          evidence: value.evidence
        }) !==
          checksumRuleDocument({
            outputs: original.outputs,
            evidence: original.evidence
          }) ||
        value.applicationOutputs.d20 === null ||
        checksumRuleDocument(value.applicationOutputs.d20) !==
          checksumRuleDocument(legendaryResistance.originalD20) ||
        !hasExactOriginalD20Trace ||
        choice.evidence.source.definitionId !==
          legendaryResistance.lifecycle.choiceGraphDefinitionId ||
        choice.evidence.source.checksum !==
          legendaryResistance.lifecycle.choiceGraphDefinitionChecksum ||
        choice.outputs[legendaryResistance.lifecycle.useOutput] !== legendaryResistance.use
      )
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['applicationOutputs', 'legendaryResistance'],
          message: 'Legendary Resistance terminal action binding is invalid.'
        })
      return
    }
    if (
      value.status !== 'COMPLETE' ||
      value.applicationOutputs.kind !== 'CHARACTER_MECHANICS_BATCH'
    )
      return
    const batch = value.applicationOutputs
    if (batch.occurrenceId !== value.occurrenceId)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Receipt occurrence identity is invalid.'
      })
    const testReceipt = value.phaseReceipts?.[0]
    const outcomeReceipt = value.phaseReceipts?.[1]
    const d20Execution = testReceipt?.phase === 'TEST' ? testReceipt.execution : value
    const terminalReceipt = outcomeReceipt ?? testReceipt
    if (
      value.phaseReceipts &&
      (!testReceipt ||
        testReceipt.phase !== 'TEST' ||
        (value.phaseReceipts.length === 2 && outcomeReceipt?.phase !== 'OUTCOME') ||
        !terminalReceipt ||
        checksumRuleDocument({
          outputs: terminalReceipt.execution.outputs,
          evidence: terminalReceipt.execution.evidence
        }) !==
          checksumRuleDocument({
            outputs: value.outputs,
            evidence: value.evidence
          }))
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['phaseReceipts'],
        message: 'A phased terminal receipt must retain TEST then optional OUTCOME evidence.'
      })
    if (batch.d20) {
      const d20 = batch.d20
      const requestTraces = d20Execution.evidence.trace.filter(
        (trace) =>
          trace.operation.key === 'evidence.integer-range' &&
          trace.operation.contractVersion === 1 &&
          trace.inputs.min === 1 &&
          trace.inputs.max === 20 &&
          trace.evidence?.kind === 'INTEGER_RANGE' &&
          trace.evidence.requestId === d20.requestId &&
          trace.evidence.value === d20.selectedNatural
      )
      const resultTraces = d20Execution.evidence.trace.filter(
        (trace) =>
          trace.inputs.naturalD20 === d20.selectedNatural &&
          trace.inputs.modifier === d20.modifier &&
          trace.inputs.threshold === d20.defenseOrDc &&
          trace.inputs.contributorChecksum === d20.contributorChecksum &&
          trace.outputs.contributorChecksum === d20.contributorChecksum &&
          trace.outputs.total === d20.total &&
          trace.outputs.resultPath === d20.resultPath
      )
      if (
        requestTraces.length !== 1 ||
        resultTraces.length !== 1 ||
        d20Execution.outputs.naturalD20 !== d20.selectedNatural ||
        d20Execution.outputs.total !== d20.total ||
        d20Execution.outputs.resultPath !== d20.resultPath ||
        d20Execution.outputs.contributorChecksum !== d20.contributorChecksum ||
        d20Execution.evidence.outputs.naturalD20 !== d20.selectedNatural ||
        d20Execution.evidence.outputs.total !== d20.total ||
        d20Execution.evidence.outputs.resultPath !== d20.resultPath ||
        d20Execution.evidence.outputs.contributorChecksum !== d20.contributorChecksum
      )
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['applicationOutputs', 'd20'],
          message: 'Character mechanics d20 evidence does not match its TEST execution.'
        })
    }
    let priorTraceIndex = -1
    const boundTraceIndexes = new Set<number>()
    for (const application of batch.applications) {
      const matches = value.evidence.trace
        .map((trace, index) => ({ trace, index }))
        .filter(({ trace }) => {
          if (
            trace.nodeId !== application.sourceNodeId ||
            trace.operation.key !== application.sourceOperationKey ||
            trace.outputs.targetActorId !== batch.targetActorId
          )
            return false
          const authoredPath = trace.outputs.authoredPath ?? null
          const resolvedPath = trace.outputs.resolvedPath ?? null
          if (
            authoredPath !== application.authoredPath ||
            resolvedPath !== application.resolvedPath
          )
            return false
          if ('authorized' in trace.outputs && trace.outputs.authorized !== true) return false
          if (application.kind === 'CONDITION_APPLY' || application.kind === 'CONDITION_REMOVE')
            return trace.outputs.conditionId === application.conditionId
          if (application.kind === 'SCALAR_REDUCTION')
            return trace.outputs.amount === application.reductionAmount
          return (
            trace.outputs.amount === application.requestedAmount &&
            (application.kind !== 'DAMAGE' ||
              trace.outputs.damageTypeId === application.damageTypeId)
          )
        })
      if (
        matches.length !== 1 ||
        matches[0]!.index <= priorTraceIndex ||
        boundTraceIndexes.has(matches[0]!.index)
      )
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Character mechanics application trace binding is invalid.'
        })
      else {
        priorTraceIndex = matches[0]!.index
        boundTraceIndexes.add(matches[0]!.index)
      }
    }
    const authorizedCandidates = value.evidence.trace
      .map((trace, index) => ({ trace, index }))
      .filter(
        ({ trace }) =>
          trace.outputs.applicationCandidate === true && trace.outputs.authorized === true
      )
    if (
      authorizedCandidates.length !== boundTraceIndexes.size ||
      authorizedCandidates.some(({ index }) => !boundTraceIndexes.has(index)) ||
      authorizedCandidates.some(
        ({ trace }) => trace.outputs.targetStateChecksum !== batch.targetTransition.checksum
      )
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Character mechanics application coverage is invalid.'
      })
  })

/**
 * Server-only execution plan retained when an each-round turn pauses after
 * outgoing effects have been evaluated. The plan contains completed,
 * independently replay-validated effect executions, never repositories,
 * locks, or mutable aggregate snapshots.
 */
const stagedTurnEffectPlanDtoSchema = z.strictObject({
  selectionChecksum: checksumSchema,
  executions: z
    .array(z.lazy(() => turnEffectExecutionDtoSchema))
    .min(1)
    .max(MAX_ENCOUNTER_TURN_ACTIVE_EFFECT_EXECUTIONS)
})

/**
 * A paused turn may retain only a non-mutating outgoing phase. Terminal
 * evidence is reconstructed after its staged plan has been re-locked and
 * applied in the final transaction.
 */
const pendingCompletedTurnPhaseDtoSchema = z
  .discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('NONE') }),
    z.strictObject({
      kind: z.literal('MANUAL'),
      selectionChecksum: checksumSchema,
      result: z.lazy(() => storedRuleExecutionResultDtoSchema)
    }),
    z.strictObject({
      kind: z.literal('STAGED'),
      plan: stagedTurnEffectPlanDtoSchema
    })
  ])
  .superRefine((phase, context) => {
    if (phase.kind !== 'MANUAL') return
    if (phase.result.status !== 'MANUAL')
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['result'],
        message: 'A manual outgoing phase must retain manual terminal evidence.'
      })
  })

export type ServerPublishedRuleDefinitionDto = z.infer<
  typeof serverPublishedRuleDefinitionDtoSchema
>
export type ServerRuleExecutionInputDto = z.infer<typeof serverRuleExecutionInputDtoSchema>
export type RuleGraphSourceIdentityDto = z.infer<typeof ruleGraphSourceIdentityDtoSchema>
export type ServerRuleExecutionTraceEntryDto = z.infer<
  typeof serverRuleExecutionTraceEntryDtoSchema
>
export type ServerCompletedRuleExecutionDto = z.infer<typeof serverCompletedRuleExecutionDtoSchema>
export type RuleExecutionPhaseReceiptDto = z.infer<typeof ruleExecutionPhaseReceiptDtoSchema>
export type RuleExecutionPhaseReceiptsDto = z.infer<typeof ruleExecutionPhaseReceiptsDtoSchema>
export type ServerRuleExecutionContinuationDto = z.infer<
  typeof serverRuleExecutionContinuationDtoSchema
>
export type ServerOptionalCombatContestPendingApplicationContextDto = Extract<
  ServerRuleExecutionPendingApplicationContextDto,
  { kind: 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST' }
>
export function isServerKernelRuleExecutionPendingSnapshot(
  snapshot: ServerRuleExecutionPendingSnapshotDto
): snapshot is ServerKernelRuleExecutionPendingSnapshotDto {
  return snapshot.snapshotKind === 'KERNEL_EVIDENCE'
}

export function requireServerKernelRuleExecutionPendingSnapshot(
  snapshot: ServerRuleExecutionPendingSnapshotDto
): ServerKernelRuleExecutionPendingSnapshotDto {
  if (!isServerKernelRuleExecutionPendingSnapshot(snapshot)) {
    throw new Error('The pending occurrence does not retain kernel evidence.')
  }
  return snapshot
}

export function isServerAggregateChoicePendingSnapshot(
  snapshot: ServerRuleExecutionPendingSnapshotDto
): snapshot is ServerAggregateChoicePendingSnapshotDto {
  return snapshot.snapshotKind === 'AGGREGATE_CHOICE'
}

export function requireServerAggregateChoicePendingSnapshot(
  snapshot: ServerRuleExecutionPendingSnapshotDto
): ServerAggregateChoicePendingSnapshotDto {
  if (!isServerAggregateChoicePendingSnapshot(snapshot)) {
    throw new Error('The pending occurrence does not retain an aggregate choice.')
  }
  return snapshot
}
export type ServerRuleExecutionResumeInputDto = z.infer<
  typeof serverRuleExecutionResumeInputDtoSchema
>
export type ServerRuleExecutionResultDto = z.infer<typeof serverRuleExecutionResultDtoSchema>
export type ServerRuleExecutionReceiptCommandMetadataDto = z.infer<
  typeof serverRuleExecutionReceiptCommandMetadataDtoSchema
>
export type ServerRuleExecutionCorrelationIdDto = z.infer<
  typeof serverRuleExecutionCorrelationIdDtoSchema
>
export type StoredRuleExecutionResultDto = z.infer<typeof storedRuleExecutionResultDtoSchema>
export type StagedTurnEffectPlanDto = z.infer<typeof stagedTurnEffectPlanDtoSchema>
export type PendingCompletedTurnPhaseDto = z.infer<typeof pendingCompletedTurnPhaseDtoSchema>
export type StagedInitiativeRoundStateDto = CanonicalStagedInitiativeRoundStateDto
export type InitiativeBeforePinDto = z.infer<typeof initiativeBeforePinDtoSchema>
export type ManualRuleExecutionReminderDto = z.infer<typeof manualRuleExecutionReminderDtoSchema>
export type ServerRuleExecutionApplicationOutputsDto = z.infer<
  typeof serverRuleExecutionApplicationOutputsDtoSchema
>
export type ServerRuleExecutionD20EvidenceDto = z.infer<
  typeof serverRuleExecutionD20EvidenceDtoSchema
>
export type ServerRuleExecutionNestedD20EvidenceDto = z.infer<
  typeof serverRuleExecutionNestedD20EvidenceDtoSchema
>
export type ServerRuleExecutionD20PolicyDto = z.infer<typeof serverRuleExecutionD20PolicyDtoSchema>
