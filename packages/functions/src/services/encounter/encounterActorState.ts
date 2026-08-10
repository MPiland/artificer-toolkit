import { randomInt, randomUUID } from 'node:crypto'

import type { EncounterActorRecord, EncounterRecord, Json } from '@artificer-toolkit/db'
import { encounterFeatureReferenceDtoSchema } from '@artificer-toolkit/schema/api/encounters'
import { rollResultDtoSchema } from '@artificer-toolkit/schema/api/rolls'
import { featureDtoSchema, type FeatureDto } from '@artificer-toolkit/schema/features/feature'
import { compileCharge, resolveCompiledChargeMaximum } from '@artificer-toolkit/shared/compilers'
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

export function featureChargeMaximum(
  actor: EncounterActorRecord,
  feature: FeatureDto
): number | null {
  const charge = feature.charges
  if (
    !charge ||
    charge.limitKind === 'SOURCE_CHARGES' ||
    charge.scalingKind !== 'NONE' ||
    (charge.limitKind !== 'FIXED_AMOUNT' && charge.limitKind !== 'ABILITY_MODIFIER') ||
    charge.bonuses?.some((bonus) => bonus.bonusKind !== 'ABILITY_MODIFIER')
  ) {
    return null
  }
  let abilities: Record<string, number> = {}
  if (charge.limitKind === 'ABILITY_MODIFIER' || charge.bonuses?.length) {
    if (
      typeof actor.snapshot !== 'object' ||
      actor.snapshot === null ||
      Array.isArray(actor.snapshot)
    ) {
      return null
    }
    const payload = actor.snapshot.payload
    const abilityScores =
      typeof payload === 'object' && payload !== null && !Array.isArray(payload)
        ? payload.abilityScores
        : null
    if (
      typeof abilityScores !== 'object' ||
      abilityScores === null ||
      Array.isArray(abilityScores)
    ) {
      return null
    }
    abilities = Object.fromEntries(
      Object.entries(abilityScores).filter(
        (entry): entry is [string, number] =>
          typeof entry[1] === 'number' && Number.isFinite(entry[1])
      )
    )
  }

  try {
    const maximum = resolveCompiledChargeMaximum(compileCharge(charge), {
      abilities,
      proficiencyBonus: 0,
      totalLevel: 0
    })
    return maximum > 0 ? maximum : null
  } catch {
    return null
  }
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
  return { ...resources, featureCharges: { ...featureCharges, [featureId]: used } }
}

export function snapshotFeatures(actor: EncounterActorRecord) {
  return snapshotFeatureDefinitions(actor).map((feature) => {
    const maximum = featureChargeMaximum(actor, feature)
    const used = maximum === null ? 0 : Math.min(featureChargeUsed(actor, feature.id), maximum)
    return encounterFeatureReferenceDtoSchema.parse({
      ...feature,
      resource:
        maximum === null
          ? null
          : {
              used,
              maximum,
              remaining: maximum - used,
              resetKind:
                feature.charges && feature.charges.limitKind !== 'SOURCE_CHARGES'
                  ? feature.charges.resetKind
                  : 'MANUAL'
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
