import { z } from '../zod.js'

import { RULE_GRAPH_LIMITS } from '@artificer-toolkit/shared/rules/contracts'

import { ruleValueDtoSchema } from '../api/rulesRuntime.js'
import { actorRelationshipModuleDtoSchema } from '../effects/actorRelationship.js'
import { hitPointMaximumReductionRecoveryTagsSchema } from '../effects/hitPointMaximumReduction.js'
import { activeRuleEffectLifecycleDtoSchema } from './activeRuleEffectLifecycle.js'
import { combatPerceptionContributionsDtoSchema } from './combatPerception.js'
import { pathLifecycleConsumeEventSchema, pathLifecycleEndEventSchema } from './enums.js'
import { compiledRuleGraphDtoSchema } from './ruleExecutionCore.js'

export {
  activeRuleEffectLifecycleDtoSchema,
  type ActiveRuleEffectLifecycleDto
} from './activeRuleEffectLifecycle.js'

import {
  ruleExecutionCapabilityKeySchema as capabilityKeySchema,
  ruleExecutionChecksumSchema as checksumSchema,
  ruleExecutionIdentifierSchema as identifierSchema,
  ruleExecutionIntegerSchema as integerSchema,
  ruleExecutionLocalNodeIdSchema as localNodeIdSchema,
  ruleExecutionPositiveIntegerSchema as positiveIntegerSchema,
  ruleExecutionUuidSchema as uuidSchema
} from './ruleExecutionPrimitives.js'

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

const activeEffectFactsSchema = z
  .record(capabilityKeySchema, ruleValueDtoSchema)
  .check(
    z.refine(
      (facts) => Object.keys(facts).length <= RULE_GRAPH_LIMITS.RUNTIME_FACTS,
      `Active effects support at most ${RULE_GRAPH_LIMITS.RUNTIME_FACTS} adapter facts.`
    )
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
    sourceActorId: z.nullable(uuidSchema)
  })
])

const activeEffectEndEventsSchema = z
  .array(pathLifecycleEndEventSchema)
  .check(z.maxLength(16))
  .check(
    z.superRefine((events, context) => {
      if (new Set(events).size !== events.length) {
        context.addIssue({
          code: 'custom',
          message: 'Active-effect end events must be unique.'
        })
      }
      if (events.some((event, index) => index > 0 && events[index - 1]! > event)) {
        context.addIssue({
          code: 'custom',
          message: 'Active-effect end events must be sorted.'
        })
      }
    })
  )

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
    consumeOnFirstEvent: z.nullable(pathLifecycleConsumeEventSchema),
    endOnEvents: activeEffectEndEventsSchema,
    lifetimeScope: z.enum(['OWNER', 'ENCOUNTER']),
    expiration: z.discriminatedUnion('kind', [
      z.strictObject({ kind: z.literal('INDEFINITE') }),
      z.strictObject({
        kind: z.literal('TICKS'),
        initialRemaining: integerSchema.check(z.gte(1)).check(z.lte(10_000)),
        decrementStage: z.enum(['START_OF_TURN', 'END_OF_TURN'])
      })
    ])
  })
})

export const activeRuleEffectStateContributionDtoSchema = z.strictObject({
  kind: z.literal('HIT_POINT_MAXIMUM_REDUCTION'),
  amount: positiveIntegerSchema.check(z.lte(Number.MAX_SAFE_INTEGER)),
  sourceDamageOutcomeId: uuidSchema,
  sourceDamageNodeId: identifierSchema,
  sourceDamageOperationKey: identifierSchema,
  recoveryTags: hitPointMaximumReductionRecoveryTagsSchema
})

export const activeRuleEffectScalarReductionContributionDtoSchema = z.strictObject({
  kind: z.literal('SCALAR_REDUCTION'),
  valueDefinitionId: uuidSchema,
  amount: positiveIntegerSchema.check(z.lte(Number.MAX_SAFE_INTEGER)),
  stacking: z.literal('ADDITIVE'),
  floor: z.literal(0),
  recoveryTriggers: z
    .array(z.enum(['SHORT_REST', 'LONG_REST']))
    .check(z.minLength(1))
    .check(z.maxLength(2)),
  terminalConsequence: z.literal('TARGET_DIED'),
  sourceOutcomeId: uuidSchema,
  sourceNodeId: identifierSchema,
  sourceOperationKey: identifierSchema
})

const activeRuleEffectConditionContributionDtoSchema = z.strictObject({
  kind: z.literal('CONDITION_OWNERSHIP'),
  conditionId: uuidSchema,
  baselinePresent: z.boolean()
})

const activeRuleEffectActorRelationshipContributionDtoSchema = z.strictObject({
  kind: z.literal('ACTOR_RELATIONSHIP'),
  relationshipOutcomeId: uuidSchema,
  modules: z
    .array(actorRelationshipModuleDtoSchema)
    .check(z.minLength(1))
    .check(z.maxLength(RULE_GRAPH_LIMITS.NODES)),
  conditionIds: z.array(uuidSchema).check(z.maxLength(32)),
  capabilitySuppressions: z
    .array(
      z.strictObject({
        contributionId: uuidSchema,
        capabilityDefinitionIds: z.array(uuidSchema).check(z.minLength(1)).check(z.maxLength(32))
      })
    )
    .check(z.maxLength(32))
})

/**
 * Version one is retained byte-faithfully for existing rows and receipts.
 * Version two adds a bounded, immutable aggregate-state contribution list.
 */
export const activeRuleEffectDefinitionDtoSchema = z
  .discriminatedUnion('schemaVersion', [
    z.extend(activeRuleEffectDefinitionBaseDtoSchema, {
      schemaVersion: z.literal(1)
    }),
    z.extend(activeRuleEffectDefinitionBaseDtoSchema, {
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
        .check(z.minLength(1))
        .check(z.maxLength(RULE_GRAPH_LIMITS.NODES))
    })
  ])
  .check(
    z.superRefine((definition, context) => {
      const sourceDefinitionId = definition.frozenGraph.source.definitionId
      if (definition.authoredEffectId !== sourceDefinitionId) {
        context.addIssue({
          code: 'custom',
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
          code: 'custom',
          path: ['frozenGraphNodeId'],
          message: 'Active-effect compiled entry must bind exactly one frozen graph node.'
        })
      }
      if (
        definition.recurrence.lifetimeScope === 'ENCOUNTER' &&
        definition.origin.kind !== 'ENCOUNTER'
      ) {
        context.addIssue({
          code: 'custom',
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
            code: 'custom',
            path: ['perceptionContributions', index, 'document', 'gameSystemId'],
            message: 'Active-effect sense grants must belong to the frozen graph Game System.'
          })
      }
    })
  )

/**
 * Immutable System-owned maintenance identity. The application layer only
 * persists and replaces this descriptor; it never interprets its meaning.
 */
const encounterMaintainedEffectDescriptorBaseDtoSchema = z.strictObject({
  maintenanceDefinitionId: uuidSchema,
  definitionChecksum: checksumSchema,
  sourceActionId: z.string().check(z.minLength(1)).check(z.maxLength(240)),
  sourceOccurrenceId: uuidSchema,
  sourceActorId: uuidSchema,
  replacementPolicy: z.literal('REPLACE_SAME_DEFINITION')
})

/** Version one retains its original implicit terminal-empty cleanup behavior. */
export const encounterMaintainedEffectDescriptorDtoSchema = z.discriminatedUnion('schemaVersion', [
  z.extend(encounterMaintainedEffectDescriptorBaseDtoSchema, {
    schemaVersion: z.literal(1)
  }),
  z.extend(encounterMaintainedEffectDescriptorBaseDtoSchema, {
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
  .check(
    z.superRefine((state, context) => {
      const configuredExpiration = state.definition.recurrence.expiration
      const remainingTicks = state.lifecycle.remainingTicks
      if (
        (configuredExpiration.kind === 'INDEFINITE' && remainingTicks !== null) ||
        (configuredExpiration.kind === 'TICKS' && remainingTicks === null)
      ) {
        context.addIssue({
          code: 'custom',
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
          code: 'custom',
          path: ['lifecycle', 'remainingTicks'],
          message: 'Active-effect remaining ticks may not exceed its initial definition.'
        })
      }
    })
  )

export type ActiveRuleEffectDefinitionDto = z.infer<typeof activeRuleEffectDefinitionDtoSchema>
export type ActiveRuleEffectStateDto = z.infer<typeof activeRuleEffectStateDtoSchema>
