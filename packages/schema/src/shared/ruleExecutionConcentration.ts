import { RULE_GRAPH_LIMITS } from '@artificer-toolkit/shared/rules/contracts'
import { z } from '../zod.js'
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

export const concentrationDamageApplicationDtoSchema = z.strictObject({
  ordinal: ruleExecutionIntegerSchema
    .check(z.gte(0))
    .check(z.lt(MAX_CONCENTRATION_DAMAGE_APPLICATIONS)),
  sourceNodeId: ruleExecutionIdentifierSchema,
  sourceOperationKey: ruleExecutionIdentifierSchema,
  targetActorId: ruleExecutionUuidSchema,
  appliedAmount: ruleExecutionPositiveIntegerSchema,
  damageTypeId: ruleExecutionUuidSchema
})

export type ConcentrationDamageApplicationDto = z.infer<
  typeof concentrationDamageApplicationDtoSchema
>

export const concentrationMaintainedDamageApplicationDtoSchema = z.extend(
  concentrationDamageApplicationDtoSchema,
  { maintainedStateId: ruleExecutionUuidSchema }
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
