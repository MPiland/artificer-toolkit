import type { EncounterActorRecord, EncounterRecord } from '@artificer-toolkit/db'
import {
  encounterActorRuleInputSchema,
  type EncounterActorRuleInput
} from '@artificer-toolkit/schema/api/encounterActorRules'
import { abilityCodeSchema } from '@artificer-toolkit/schema/shared/enums'
import { serverUuidIdentityDtoSchema } from '@artificer-toolkit/schema/shared/rulesExecution'

import { featureChargeUsed, snapshotFeatureDefinitions } from './encounterActorState.js'

function snapshotAbilityScores(actor: EncounterActorRecord): Record<string, number> {
  if (
    actor.kind !== 'CREATURE' ||
    typeof actor.snapshot !== 'object' ||
    actor.snapshot === null ||
    Array.isArray(actor.snapshot)
  ) {
    return {}
  }
  const payload = actor.snapshot.payload
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return {}
  const abilityScores = payload.abilityScores
  if (typeof abilityScores !== 'object' || abilityScores === null || Array.isArray(abilityScores)) {
    return {}
  }
  return Object.fromEntries(
    Object.entries(abilityScores).filter(
      (entry): entry is [string, number] =>
        abilityCodeSchema.safeParse(entry[0]).success &&
        typeof entry[1] === 'number' &&
        Number.isFinite(entry[1])
    )
  )
}

function normalizedIdentityList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  const ids = new Set<string>()
  for (const candidate of value) {
    const parsed = serverUuidIdentityDtoSchema.safeParse(candidate)
    if (!parsed.success || ids.has(parsed.data)) return null
    ids.add(parsed.data)
  }
  return [...ids].sort()
}

function snapshotTargetProtection(actor: EncounterActorRecord) {
  if (actor.kind === 'CUSTOM') {
    return { status: 'NORMALIZED' as const, defenses: [], conditionImmunityIds: [] }
  }
  if (
    actor.kind !== 'CREATURE' ||
    typeof actor.snapshot !== 'object' ||
    actor.snapshot === null ||
    Array.isArray(actor.snapshot) ||
    typeof actor.snapshot.payload !== 'object' ||
    actor.snapshot.payload === null ||
    Array.isArray(actor.snapshot.payload)
  ) {
    return { status: 'NOT_NORMALIZED' as const }
  }
  const payload = actor.snapshot.payload
  const vulnerabilities = normalizedIdentityList(payload.damageVulnerabilities)
  const resistances = normalizedIdentityList(payload.damageResistances)
  const immunities = normalizedIdentityList(payload.damageImmunities)
  const conditionImmunityIds = normalizedIdentityList(payload.conditionImmunities)
  if (
    vulnerabilities === null ||
    resistances === null ||
    immunities === null ||
    conditionImmunityIds === null
  ) {
    return { status: 'NOT_NORMALIZED' as const }
  }
  const defenses = [
    ...vulnerabilities.map((damageTypeId) => ({ kind: 'VULNERABILITY' as const, damageTypeId })),
    ...resistances.map((damageTypeId) => ({ kind: 'RESISTANCE' as const, damageTypeId })),
    ...immunities.map((damageTypeId) => ({ kind: 'IMMUNITY' as const, damageTypeId }))
  ].sort((left, right) =>
    left.damageTypeId === right.damageTypeId
      ? left.kind.localeCompare(right.kind)
      : left.damageTypeId.localeCompare(right.damageTypeId)
  )
  return { status: 'NORMALIZED' as const, defenses, conditionImmunityIds }
}

export function buildEncounterActorRuleFacts(encounter: EncounterRecord): EncounterActorRuleInput {
  return encounterActorRuleInputSchema.parse({
    contractVersion: 1,
    actors: encounter.actors
      .filter((actor) => actor.kind !== 'CHARACTER')
      .map((actor) => ({
        actorId: actor.id,
        abilityScores: snapshotAbilityScores(actor),
        targetProtection: snapshotTargetProtection(actor),
        featureResources: snapshotFeatureDefinitions(actor).map((feature) => ({
          featureId: feature.id,
          charge: feature.charges ?? null,
          used: featureChargeUsed(actor, feature.id)
        }))
      }))
  })
}
