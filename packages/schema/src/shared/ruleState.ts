import { z } from 'zod'

import { combatPerceptionContributionsDtoSchema } from './combatPerception.js'
import { postgresUuidSchema } from './postgresUuid.js'

const uuidSchema = postgresUuidSchema.transform((value) => value.toLowerCase())
const checksumSchema = z.string().regex(/^[a-f0-9]{64}$/)

export const ruleCapabilityRefreshBoundaryDtoSchema = z.literal('START_OF_TURN')

/** A System-owned capability with optional bounded aggregate usage. */
export const ruleCapabilityReusableDefinitionDocumentDtoSchema = z.strictObject({
  schemaVersion: z.literal(1),
  kind: z.literal('RULE_CAPABILITY'),
  id: uuidSchema,
  gameSystemId: uuidSchema,
  usage: z
    .strictObject({
      maximum: z.number().int().positive().max(10_000),
      refreshBoundary: ruleCapabilityRefreshBoundaryDtoSchema
    })
    .nullable()
})

export const ruleCapabilitySuppressionDtoSchema = z.strictObject({
  id: uuidSchema,
  order: z.number().int().min(0).max(9_999),
  kind: z.literal('CAPABILITY_SUPPRESS'),
  capabilityDefinitionIds: z
    .array(uuidSchema)
    .min(1)
    .max(32)
    .superRefine((ids, context) => {
      if (new Set(ids).size !== ids.length)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Suppressed capability definition identities must be unique.'
        })
      if (ids.some((id, index) => index > 0 && ids[index - 1]! >= id))
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Suppressed capability definition identities must be sorted.'
        })
    })
})

/**
 * UUID-backed condition policy for the capability-availability facet. Other
 * condition mechanics remain separate typed policy rather than prose parsing.
 */
export const conditionRuleStateReusableDefinitionDocumentDtoSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    kind: z.literal('CONDITION_RULE_STATE'),
    id: uuidSchema,
    gameSystemId: uuidSchema,
    capabilitySuppressions: z.array(ruleCapabilitySuppressionDtoSchema).max(32),
    /** Optional for legacy reads; current documents explicitly materialize an ordered empty array. */
    perceptionContributions: combatPerceptionContributionsDtoSchema.optional()
  })
  .superRefine((document, context) => {
    const contributionIds = new Set<string>()
    for (const [index, contribution] of document.capabilitySuppressions.entries()) {
      if (contributionIds.has(contribution.id))
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['capabilitySuppressions', index, 'id'],
          message: 'Condition rule-state contribution identities must be unique.'
        })
      contributionIds.add(contribution.id)
      const prior = document.capabilitySuppressions[index - 1]
      if (
        prior &&
        (prior.order > contribution.order ||
          (prior.order === contribution.order && prior.id >= contribution.id))
      )
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['capabilitySuppressions', index],
          message: 'Condition rule-state contributions must be ordered by order then identity.'
        })
    }
  })

export const pinnedConditionRuleStateDefinitionDtoSchema = z
  .strictObject({
    conditionDefinitionId: uuidSchema,
    definitionVersion: z.number().int().positive(),
    definitionContractVersion: z.number().int().positive().max(10_000),
    definitionChecksum: checksumSchema,
    document: conditionRuleStateReusableDefinitionDocumentDtoSchema
  })
  .superRefine((definition, context) => {
    if (definition.conditionDefinitionId !== definition.document.id)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['document', 'id'],
        message: 'Pinned condition rule-state identity must match its document.'
      })
  })

export const pinnedRuleCapabilityDefinitionDtoSchema = z
  .strictObject({
    capabilityDefinitionId: uuidSchema,
    definitionVersion: z.number().int().positive(),
    definitionContractVersion: z.number().int().positive().max(10_000),
    definitionChecksum: checksumSchema,
    document: ruleCapabilityReusableDefinitionDocumentDtoSchema
  })
  .superRefine((definition, context) => {
    if (definition.capabilityDefinitionId !== definition.document.id)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['document', 'id'],
        message: 'Pinned rule-capability identity must match its document.'
      })
  })

export const resolvedRuleCapabilityAvailabilityDtoSchema = z.strictObject({
  capability: pinnedRuleCapabilityDefinitionDtoSchema,
  available: z.boolean(),
  suppressingConditionDefinitionIds: z.array(uuidSchema).max(32),
  suppressingActiveEffectIds: z.array(uuidSchema).max(32),
  /** Optional only for legacy snapshots created before active-effect provenance was retained. */
  activeEffectSuppressions: z
    .array(
      z.strictObject({
        activeEffectId: uuidSchema,
        contributionId: uuidSchema
      })
    )
    .max(32)
    .optional(),
  contributionIds: z.array(uuidSchema).max(32)
})

export const resolvedRuleCapabilityStateDtoSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    gameSystemId: uuidSchema,
    conditionDefinitions: z.array(pinnedConditionRuleStateDefinitionDtoSchema).max(100),
    capabilities: z.array(resolvedRuleCapabilityAvailabilityDtoSchema).max(32),
    checksum: checksumSchema
  })
  .superRefine((state, context) => {
    for (const [index, definition] of state.conditionDefinitions.entries())
      if (definition.document.gameSystemId !== state.gameSystemId)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['conditionDefinitions', index, 'document', 'gameSystemId'],
          message: 'Condition rule-state definition must belong to the resolved Game System.'
        })
    for (const [index, availability] of state.capabilities.entries())
      if (availability.capability.document.gameSystemId !== state.gameSystemId)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['capabilities', index, 'capability', 'document', 'gameSystemId'],
          message: 'Rule capability definition must belong to the resolved Game System.'
        })
    if (
      state.conditionDefinitions.some(
        (definition, index) =>
          index > 0 &&
          state.conditionDefinitions[index - 1]!.conditionDefinitionId >=
            definition.conditionDefinitionId
      )
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['conditionDefinitions'],
        message: 'Pinned condition rule-state definitions must be unique and sorted.'
      })
    if (
      state.capabilities.some(
        (availability, index) =>
          index > 0 &&
          state.capabilities[index - 1]!.capability.capabilityDefinitionId >=
            availability.capability.capabilityDefinitionId
      )
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['capabilities'],
        message: 'Resolved rule capabilities must be unique and sorted.'
      })
  })

export type RuleCapabilityRefreshBoundaryDto = z.infer<
  typeof ruleCapabilityRefreshBoundaryDtoSchema
>
export type RuleCapabilityReusableDefinitionDocumentDto = z.infer<
  typeof ruleCapabilityReusableDefinitionDocumentDtoSchema
>
export type RuleCapabilitySuppressionDto = z.infer<typeof ruleCapabilitySuppressionDtoSchema>
export type ConditionRuleStateReusableDefinitionDocumentDto = z.infer<
  typeof conditionRuleStateReusableDefinitionDocumentDtoSchema
>
export type PinnedConditionRuleStateDefinitionDto = z.infer<
  typeof pinnedConditionRuleStateDefinitionDtoSchema
>
export type PinnedRuleCapabilityDefinitionDto = z.infer<
  typeof pinnedRuleCapabilityDefinitionDtoSchema
>
export type ResolvedRuleCapabilityAvailabilityDto = z.infer<
  typeof resolvedRuleCapabilityAvailabilityDtoSchema
>
export type ResolvedRuleCapabilityStateDto = z.infer<typeof resolvedRuleCapabilityStateDtoSchema>
