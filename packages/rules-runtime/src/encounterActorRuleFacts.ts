import {
  encounterCreatureRuleFactsSnapshotSchema,
  encounterActorRuleInputSchema,
  type EncounterActorRuleInput
} from '@artificer-toolkit/schema/api/encounterActorRules'
import { serverUuidIdentityDtoSchema } from '@artificer-toolkit/schema/shared/serverUuidIdentity'

import { featureChargeUsed, snapshotFeatureDefinitions } from './encounterActorState.js'

type EncounterActorRuleFactActor = {
  id: string
  kind: string
  systemId: string | null
  snapshot: unknown
  resources: unknown
}

type EncounterActorRuleFactInput = {
  actors: readonly EncounterActorRuleFactActor[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function snapshotRuleFacts(actor: EncounterActorRuleFactActor): {
  abilityScores: Record<string, number>
  checkTotals: Record<string, number>
  resourceAbilityScores: Record<string, number>
  initiativeAbilityDefinitionId: string | null
  vocabularySnapshot: { id: string; version: number; checksum: string } | null
} {
  const empty = {
    abilityScores: {},
    checkTotals: {},
    resourceAbilityScores: {},
    initiativeAbilityDefinitionId: null,
    vocabularySnapshot: null
  }
  if (actor.kind !== 'CREATURE') return empty
  const snapshot = isRecord(actor.snapshot) ? actor.snapshot : null
  const parsed = encounterCreatureRuleFactsSnapshotSchema.safeParse(snapshot?.ruleFacts)
  if (!parsed.success || parsed.data.gameSystemId !== actor.systemId) return empty
  const ruleFacts = parsed.data
  return {
    abilityScores: ruleFacts.abilityScores ?? {},
    checkTotals: ruleFacts.checkTotals ?? {},
    resourceAbilityScores: ruleFacts.resourceAbilityScores ?? {},
    initiativeAbilityDefinitionId: ruleFacts.initiativeAbilityDefinitionId,
    vocabularySnapshot: {
      id: ruleFacts.vocabularySnapshotId,
      version: ruleFacts.vocabularySnapshotVersion,
      checksum: ruleFacts.vocabularySnapshotChecksum
    }
  }
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

function snapshotTargetProtection(actor: EncounterActorRuleFactActor) {
  if (actor.kind === 'CUSTOM') {
    return { status: 'NORMALIZED' as const, defenses: [], conditionImmunityIds: [] }
  }
  if (actor.kind !== 'CREATURE') return { status: 'NOT_NORMALIZED' as const }
  const snapshot = isRecord(actor.snapshot) ? actor.snapshot : null
  const payload = isRecord(snapshot?.payload) ? snapshot.payload : null
  if (!payload) return { status: 'NOT_NORMALIZED' as const }
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

export function buildEncounterActorRuleFacts(
  encounter: EncounterActorRuleFactInput,
  effectiveScalarValuesByActorId: ReadonlyMap<string, Readonly<Record<string, number>>> = new Map()
): EncounterActorRuleInput {
  return encounterActorRuleInputSchema.parse({
    contractVersion: 1,
    actors: encounter.actors
      .filter((actor) => actor.kind !== 'CHARACTER')
      .map((actor) => {
        const facts = snapshotRuleFacts(actor)
        const effective = effectiveScalarValuesByActorId.get(actor.id)
        if (
          effective &&
          Object.entries(effective).some(([id, value]) => facts.abilityScores[id] !== value)
        ) {
          for (const [id, value] of Object.entries(effective)) {
            if (!(id in facts.abilityScores) || !Number.isSafeInteger(value) || value < 0) {
              throw new Error('Encounter actor scalar facts are unavailable.')
            }
          }
          facts.abilityScores = { ...facts.abilityScores, ...effective }
        }
        return {
          actorId: actor.id,
          ...facts,
          targetProtection: snapshotTargetProtection(actor),
          featureResources: snapshotFeatureDefinitions(actor).map((feature) => ({
            featureId: feature.id,
            charge: feature.charges ?? null,
            used: featureChargeUsed(actor, feature.id)
          }))
        }
      })
  })
}
