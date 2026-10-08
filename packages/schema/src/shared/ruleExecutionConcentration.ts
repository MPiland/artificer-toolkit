import { RULE_GRAPH_LIMITS } from '@artificer-toolkit/shared/rules/contracts'
import { z, lazySchema } from '../zod.js'
import { MAX_ACTIVE_RULE_EFFECTS_PER_OWNER } from './activeRuleEffects.js'
import { MAX_SPATIAL_CANDIDATES } from './spatialFacts.js'
import {
  ruleExecutionIdentifierSchema,
  ruleExecutionIntegerSchema,
  ruleExecutionPositiveIntegerSchema,
  ruleExecutionUuidSchema
} from './ruleExecutionPrimitives.js'

/** The larger bounded envelope: two turn boundaries, or spatial and reaction movement contacts. */
export const MAX_CONCENTRATION_DAMAGE_APPLICATIONS =
  Math.max(
    2 * 2 * MAX_ACTIVE_RULE_EFFECTS_PER_OWNER,
    MAX_SPATIAL_CANDIDATES + RULE_GRAPH_LIMITS.NODES
  ) * RULE_GRAPH_LIMITS.NODES

export const concentrationDamageApplicationDtoSchema = lazySchema(() =>
  z.strictObject({
    ordinal: ruleExecutionIntegerSchema
      .check(z.gte(0))
      .check(z.lt(MAX_CONCENTRATION_DAMAGE_APPLICATIONS)),
    sourceNodeId: ruleExecutionIdentifierSchema,
    sourceOperationKey: ruleExecutionIdentifierSchema,
    targetActorId: ruleExecutionUuidSchema,
    /** One source's total damage; a source that dealt several damage types has no single type. */
    appliedAmount: ruleExecutionPositiveIntegerSchema,
    damageTypeId: z.nullable(ruleExecutionUuidSchema)
  })
)

export type ConcentrationDamageApplicationDto = z.infer<
  typeof concentrationDamageApplicationDtoSchema
>

export const concentrationMaintainedDamageApplicationDtoSchema = lazySchema(() =>
  z.extend(concentrationDamageApplicationDtoSchema, { maintainedStateId: ruleExecutionUuidSchema })
)

export function compareConcentrationDamageApplications(
  left: ConcentrationDamageApplicationDto,
  right: ConcentrationDamageApplicationDto
): number {
  if (left.ordinal !== right.ordinal) return left.ordinal - right.ordinal
  const leftSource = `${left.sourceNodeId}:${left.sourceOperationKey}`
  const rightSource = `${right.sourceNodeId}:${right.sourceOperationKey}`
  return leftSource < rightSource ? -1 : leftSource > rightSource ? 1 : 0
}

const concentrationLabelSchema = lazySchema(() =>
  z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160))
)

/**
 * Display names for a finalized damage envelope: the spell, action or turn effect behind each
 * application. The parent records them when it builds the envelope; they never affect rules.
 */
export const concentrationDamageSourceLabelsDtoSchema = lazySchema(() =>
  z
    .array(
      z.strictObject({
        ordinal: concentrationDamageApplicationDtoSchema.shape.ordinal,
        sourceNodeId: ruleExecutionIdentifierSchema,
        sourceOperationKey: ruleExecutionIdentifierSchema,
        label: concentrationLabelSchema
      })
    )
    .check(z.maxLength(MAX_CONCENTRATION_DAMAGE_APPLICATIONS))
)

/** What one Concentration check is about: the damage that triggered it and its DC. */
export const concentrationCheckTriggerDtoSchema = lazySchema(() =>
  z.strictObject({
    sourceLabel: z.nullable(concentrationLabelSchema),
    damageTypeLabel: z.nullable(concentrationLabelSchema),
    dc: ruleExecutionPositiveIntegerSchema
  })
)

export type ConcentrationDamageSourceLabelsDto = z.infer<
  typeof concentrationDamageSourceLabelsDtoSchema
>

/** The display name recorded for one damage application, if any. */
export function concentrationDamageSourceLabel(
  labels: ConcentrationDamageSourceLabelsDto,
  application: ConcentrationDamageApplicationDto
): string | null {
  return (
    labels.find(
      (entry) =>
        entry.ordinal === application.ordinal &&
        entry.sourceNodeId === application.sourceNodeId &&
        entry.sourceOperationKey === application.sourceOperationKey
    )?.label ?? null
  )
}
