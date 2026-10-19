import {
  encounterActorQualifiedDefenseSchema,
  encounterCreatureRuleFactsSnapshotSchema,
  encounterActorRuleInputSchema,
  type EncounterActorRuleInput
} from '@artificer-toolkit/schema/api/encounterActorRules'
import { serverUuidIdentityDtoSchema } from '@artificer-toolkit/schema/shared/serverUuidIdentity'
import { creatureQualifiedDamageDefenseDtoSchema } from '@artificer-toolkit/schema/subjects/creature'

type QualifiedDefense = ReturnType<typeof encounterActorQualifiedDefenseSchema.parse>

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
  saveProficiencyBonuses: Record<string, number>
  resourceAbilityScores: Record<string, number>
  initiativeAbilityDefinitionId: string | null
  vocabularySnapshot: { id: string; version: number; checksum: string } | null
} {
  const empty = {
    abilityScores: {},
    checkTotals: {},
    saveProficiencyBonuses: {},
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
    saveProficiencyBonuses: ruleFacts.saveProficiencyBonuses,
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

/** Typed "from nonmagical attacks" defenses; malformed data leaves protection unnormalized. */
function qualifiedDefenseList(value: unknown): QualifiedDefense[] | null {
  if (value === undefined) return []
  if (!Array.isArray(value)) return null
  const parsed = value.map((entry) => creatureQualifiedDamageDefenseDtoSchema.safeParse(entry))
  if (parsed.some((entry) => !entry.success)) return null
  return parsed
    .flatMap((entry) => (entry.success ? [entry.data] : []))
    .flatMap((defense) =>
      defense.damageTypeIds.map((damageTypeId) => ({
        kind: defense.kind,
        damageTypeId,
        bypassedBy: [...new Set(defense.bypassedBy)].sort()
      }))
    )
    .sort((left, right) =>
      left.damageTypeId === right.damageTypeId
        ? left.kind.localeCompare(right.kind)
        : left.damageTypeId.localeCompare(right.damageTypeId)
    )
}

function snapshotTargetProtection(actor: EncounterActorRuleFactActor) {
  if (actor.kind === 'CUSTOM') {
    return {
      status: 'NORMALIZED' as const,
      defenses: [],
      qualifiedDefenses: [],
      conditionImmunityIds: [],
      spellSchoolImmunityIds: []
    }
  }
  if (actor.kind !== 'CREATURE') return { status: 'NOT_NORMALIZED' as const }
  const snapshot = isRecord(actor.snapshot) ? actor.snapshot : null
  const payload = isRecord(snapshot?.payload) ? snapshot.payload : null
  if (!payload) return { status: 'NOT_NORMALIZED' as const }
  const vulnerabilities = normalizedIdentityList(payload.damageVulnerabilities)
  const resistances = normalizedIdentityList(payload.damageResistances)
  const immunities = normalizedIdentityList(payload.damageImmunities)
  const conditionImmunityIds = normalizedIdentityList(payload.conditionImmunities)
  const qualifiedDefenses = qualifiedDefenseList(payload.qualifiedDamageDefenses)
  if (
    vulnerabilities === null ||
    resistances === null ||
    immunities === null ||
    conditionImmunityIds === null ||
    qualifiedDefenses === null
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
  // A stat block carries no spell school immunities; its features grant them (folded elsewhere).
  return {
    status: 'NORMALIZED' as const,
    defenses,
    qualifiedDefenses,
    conditionImmunityIds,
    spellSchoolImmunityIds: []
  }
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
