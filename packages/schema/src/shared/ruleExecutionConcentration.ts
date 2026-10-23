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
    damageTypeId: z.nullable(ruleExecutionUuidSchema),
    /** Who dealt this source's damage when it names one; absent, the chain's own damager applies. */
    damagerActorId: z.optional(ruleExecutionUuidSchema)
  })
)

export type ConcentrationDamageApplicationDto = z.infer<
  typeof concentrationDamageApplicationDtoSchema
>

export const concentrationMaintainedDamageApplicationDtoSchema = lazySchema(() =>
  z.extend(concentrationDamageApplicationDtoSchema, { maintainedStateId: ruleExecutionUuidSchema })
)

export type ConcentrationMaintainedDamageApplicationDto = z.infer<
  typeof concentrationMaintainedDamageApplicationDtoSchema
>

/** One damaged holder's turn-effect repeat save (D167), bound to the effect that offers it. */
export const effectRepeatSaveDamageApplicationDtoSchema = lazySchema(() =>
  z.extend(concentrationDamageApplicationDtoSchema, { activeEffectId: ruleExecutionUuidSchema })
)

/** A check the damage chain still owes: a Concentration save or an effect's repeat save. */
export const damageSaveApplicationDtoSchema = lazySchema(() =>
  z.union([
    concentrationMaintainedDamageApplicationDtoSchema,
    effectRepeatSaveDamageApplicationDtoSchema
  ])
)

export type DamageSaveApplicationDto = z.infer<typeof damageSaveApplicationDtoSchema>

/** Whether a chain item is a Concentration check rather than an effect repeat save. */
export function isMaintainedDamageApplication(
  entry: DamageSaveApplicationDto
): entry is ConcentrationMaintainedDamageApplicationDto {
  return 'maintainedStateId' in entry
}

/** The chain once an effect's made repeat save released it: its later saves have nothing left to check. */
export function damageSaveApplicationsAfterRelease(
  entries: readonly DamageSaveApplicationDto[],
  activeEffectId: string
): DamageSaveApplicationDto[] {
  return entries.filter(
    (entry) => isMaintainedDamageApplication(entry) || entry.activeEffectId !== activeEffectId
  )
}

/** A chain item's damage without the state or effect it was bound to. */
export function unboundDamageSaveApplication(
  entry: DamageSaveApplicationDto
): ConcentrationDamageApplicationDto {
  const { maintainedStateId, activeEffectId, ...damage } = entry as DamageSaveApplicationDto & {
    maintainedStateId?: string
    activeEffectId?: string
  }
  void maintainedStateId
  void activeEffectId
  return damage
}

/** The Concentration checks of a chain that can only hold them (movement); an effect check there is stale. */
export function requireMaintainedDamageApplications(
  entries: readonly DamageSaveApplicationDto[]
): ConcentrationMaintainedDamageApplicationDto[] {
  return entries.map((entry) => {
    if (!isMaintainedDamageApplication(entry))
      throw new Error('A movement damage chain holds only Concentration checks.')
    return entry
  })
}

export function compareConcentrationDamageApplications(
  left: ConcentrationDamageApplicationDto,
  right: ConcentrationDamageApplicationDto
): number {
  if (left.ordinal !== right.ordinal) return left.ordinal - right.ordinal
  const leftSource = `${left.sourceNodeId}:${left.sourceOperationKey}`
  const rightSource = `${right.sourceNodeId}:${right.sourceOperationKey}`
  return leftSource < rightSource ? -1 : leftSource > rightSource ? 1 : 0
}

/**
 * Chain order: damage order, then Concentration before an effect's repeat save, then the bound id.
 * A bare application (the check being settled) sorts before its own bound twins.
 */
export function compareDamageSaveApplications(
  left: ConcentrationDamageApplicationDto & { maintainedStateId?: string; activeEffectId?: string },
  right: ConcentrationDamageApplicationDto & { maintainedStateId?: string; activeEffectId?: string }
): number {
  const byDamage = compareConcentrationDamageApplications(left, right)
  if (byDamage !== 0) return byDamage
  const key = (value: typeof left) =>
    value.maintainedStateId !== undefined
      ? `0:${value.maintainedStateId}`
      : value.activeEffectId !== undefined
        ? `1:${value.activeEffectId}`
        : ''
  const leftKey = key(left)
  const rightKey = key(right)
  return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0
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
