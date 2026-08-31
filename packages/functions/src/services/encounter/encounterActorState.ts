import { randomInt, randomUUID } from 'node:crypto'

import type { EncounterActorRecord, EncounterRecord, Json } from '@artificer-toolkit/db'
import { encounterFeatureReferenceDtoSchema } from '@artificer-toolkit/schema/api/encounters'
import type { EncounterActorRuleResult } from '@artificer-toolkit/schema/api/encounterActorRules'
import { rollResultDtoSchema } from '@artificer-toolkit/schema/api/rolls'
import { featureDtoSchema, type FeatureDto } from '@artificer-toolkit/schema/features/feature'
import { serverUuidIdentityDtoSchema } from '@artificer-toolkit/schema/shared/rulesExecution'
import { RULE_GRAPH_LIMITS } from '@artificer-toolkit/shared/rules'
import { evaluateRollExpression, parseRollExpression } from '@artificer-toolkit/shared/rolls'

export function snapshotFeatureDefinitions(actor: EncounterActorRecord): FeatureDto[] {
  if (
    actor.kind !== 'CREATURE' ||
    typeof actor.snapshot !== 'object' ||
    actor.snapshot === null ||
    Array.isArray(actor.snapshot)
  ) {
    return []
  }
  const payload = actor.snapshot.payload
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return []
  const features = payload.features
  if (!Array.isArray(features)) return []

  return features.flatMap((feature) => {
    const parsed = featureDtoSchema.safeParse(feature)
    return parsed.success ? [parsed.data] : []
  })
}

export function featureChargeUsed(actor: EncounterActorRecord, featureId: string): number {
  if (
    typeof actor.resources !== 'object' ||
    actor.resources === null ||
    Array.isArray(actor.resources)
  ) {
    return 0
  }
  const charges = actor.resources.featureCharges
  if (typeof charges !== 'object' || charges === null || Array.isArray(charges)) return 0
  const used = charges[featureId]
  return typeof used === 'number' && Number.isInteger(used) && used >= 0 ? used : 0
}

export function withFeatureChargeUsed(
  actor: EncounterActorRecord,
  featureId: string,
  used: number
): Json {
  const resources =
    typeof actor.resources === 'object' &&
    actor.resources !== null &&
    !Array.isArray(actor.resources)
      ? actor.resources
      : {}
  const existing = resources.featureCharges
  const featureCharges =
    typeof existing === 'object' && existing !== null && !Array.isArray(existing) ? existing : {}
  return {
    ...resources,
    featureCharges: { ...featureCharges, [featureId]: used }
  }
}

/**
 * Reads aggregate-owned, System-defined Encounter usage. The definition UUID
 * supplies semantics elsewhere; this storage helper understands only a
 * bounded nonnegative usage value.
 */
export function encounterRuleUsageUsed(actor: EncounterActorRecord, definitionId: string): number {
  const normalizedDefinitionId = serverUuidIdentityDtoSchema.parse(definitionId)
  return encounterRuleUsageSnapshot(actor)[normalizedDefinitionId] ?? 0
}

/**
 * Returns bounded raw UUID-keyed usage for System policy. This validates the
 * aggregate state but deliberately does not select or interpret a definition.
 */
export function encounterRuleUsageSnapshot(
  actor: EncounterActorRecord
): Readonly<Record<string, number>> {
  if (
    typeof actor.resources !== 'object' ||
    actor.resources === null ||
    Array.isArray(actor.resources)
  ) {
    return {}
  }
  const usage = actor.resources.ruleUsage
  if (usage === undefined) return {}
  if (typeof usage !== 'object' || usage === null || Array.isArray(usage)) {
    throw new Error('Encounter rule usage state is invalid.')
  }
  const entries = Object.entries(usage)
  if (entries.length > RULE_GRAPH_LIMITS.RUNTIME_FACTS) {
    throw new Error('Encounter rule usage state exceeds its bounded size.')
  }
  const normalized: Record<string, number> = {}
  for (const [definitionId, used] of entries) {
    const normalizedDefinitionId = serverUuidIdentityDtoSchema.parse(definitionId)
    if (
      normalized[normalizedDefinitionId] !== undefined ||
      typeof used !== 'number' ||
      !Number.isSafeInteger(used) ||
      used < 0
    ) {
      throw new Error('Encounter rule usage value is invalid.')
    }
    normalized[normalizedDefinitionId] = used
  }
  return Object.fromEntries(
    Object.entries(normalized).sort(([left], [right]) => left.localeCompare(right))
  )
}

/** Writes one System-defined usage value without interpreting its policy. */
export function withEncounterRuleUsageUsed(
  actor: EncounterActorRecord,
  definitionId: string,
  used: number
): Json {
  const normalizedDefinitionId = serverUuidIdentityDtoSchema.parse(definitionId)
  if (!Number.isSafeInteger(used) || used < 0) {
    throw new Error('Encounter rule usage value must be a nonnegative safe integer.')
  }
  const resources =
    typeof actor.resources === 'object' &&
    actor.resources !== null &&
    !Array.isArray(actor.resources)
      ? actor.resources
      : {}
  const existing = resources.ruleUsage
  if (
    existing !== undefined &&
    (typeof existing !== 'object' || existing === null || Array.isArray(existing))
  ) {
    throw new Error('Encounter rule usage state is invalid.')
  }
  const ruleUsage = existing ?? {}
  return {
    ...resources,
    ruleUsage: { ...ruleUsage, [normalizedDefinitionId]: used }
  }
}

export function snapshotFeatures(actor: EncounterActorRecord, rules: EncounterActorRuleResult) {
  const resourcesByFeatureId = new Map(
    rules.featureResources.map((resource) => [resource.featureId, resource])
  )
  return snapshotFeatureDefinitions(actor).map((feature) => {
    const resource = resourcesByFeatureId.get(feature.id)
    const maximum = resource?.maximum ?? null
    return encounterFeatureReferenceDtoSchema.parse({
      ...feature,
      resource:
        maximum === null
          ? null
          : {
              used: resource?.used ?? 0,
              maximum,
              remaining: resource?.remaining ?? 0,
              resetKind: resource?.resetKind ?? 'MANUAL'
            }
    })
  })
}

function diceConfiguration(expression: { count: number; die: number; modifier: number }): string {
  const dice = `${expression.count}d${expression.die}`
  return expression.modifier === 0
    ? dice
    : `${dice} ${expression.modifier > 0 ? '+' : '-'} ${Math.abs(expression.modifier)}`
}

export function executeEnemyRoll(
  expression: { count: number; die: number; modifier: number },
  rollMode: 'NORMAL' | 'ADVANTAGE' | 'DISADVANTAGE'
) {
  return rollResultDtoSchema.parse({
    id: randomUUID(),
    ...evaluateRollExpression(
      parseRollExpression(diceConfiguration(expression)),
      { nextInt: (maxExclusive) => randomInt(maxExclusive) },
      rollMode
    )
  })
}

export function stableActors(encounter: EncounterRecord): EncounterActorRecord[] {
  return [...encounter.actors].sort((left, right) => {
    const manualLeft = left.manualOrder ?? Number.MAX_SAFE_INTEGER
    const manualRight = right.manualOrder ?? Number.MAX_SAFE_INTEGER
    if (manualLeft !== manualRight) return manualLeft - manualRight
    const initiativeLeft = left.initiative ?? Number.MIN_SAFE_INTEGER
    const initiativeRight = right.initiative ?? Number.MIN_SAFE_INTEGER
    if (initiativeLeft !== initiativeRight) return initiativeRight - initiativeLeft
    return left.stableTieKey.localeCompare(right.stableTieKey)
  })
}
