import type { EncounterActorRecord } from '@artificer-toolkit/db'
import { featureDtoSchema, type FeatureDto } from '@artificer-toolkit/schema/features/feature'
import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
import { compileEffect, type CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { normalizeCharacterActionMechanicFacts } from '../character/characterActionRuleFacts.js'
import type { EffectActionCapabilityDescriptor } from './characterActionCapabilityDiscovery.js'

export interface EncounterFeatureActionCapabilityDescriptor extends EffectActionCapabilityDescriptor {
  kind: 'ENCOUNTER_FEATURE'
  encounterActorId: string
  creatureSourceId: string
  ownerFeatureId: string
  featureOptionId: string | null
  ownerRuleDefinitionIds: readonly string[]
  optionRuleDefinitionIds: readonly string[]
  sourceRevision: number
  sourceVersionId: string
  sourceChecksum: string
  authoredEffectChecksum: string
  compiledEffectChecksum: string
  /** Exact owner-Feature charge binding for this action, when one is authored. */
  featureResourceUse: { chargeId: string; cost: number } | null
}

function featureResourceUse(input: {
  ownerFeature: FeatureDto
  compiledEffect: CompiledEffectGroup
}): { chargeId: string; cost: number } | null {
  const invocation = input.compiledEffect.invocation
  if (invocation.kind !== 'ACTION') return null
  const resourceUse = invocation.resourceUse
  if (resourceUse === null || resourceUse === undefined) return null
  if (input.ownerFeature.charges?.id !== resourceUse.chargeId) {
    throw new Error('Encounter feature action resource use must bind its owner Feature charges.')
  }
  return { chargeId: resourceUse.chargeId, cost: resourceUse.cost }
}

interface EncounterFeatureSourceProvenance {
  creatureSourceId: string
  sourceRevision: number
  sourceVersionId: string
  sourceChecksum: string
}

type EncounterFeatureEffect = NonNullable<FeatureDto['effects']>[number]

/** Immutable source facts only; mutable Encounter actor state is intentionally unavailable here. */
export interface EncounterFeatureEffectCompilerInput {
  encounterActorId: string
  creatureSourceId: string
  gameSystemId: string
  sourceRevision: number
  sourceVersionId: string
  sourceChecksum: string
  ownerFeature: FeatureDto
  featureOption: FeatureDto | null
  compiledEffect: CompiledEffectGroup
  conditionDefinitionIds: readonly string[]
  abilityDefinitions: readonly { id: string; code: string }[]
}

export interface EncounterFeatureActionCapabilityAdapter {
  gameSystemId: string
  compile(input: EncounterFeatureEffectCompilerInput): {
    conditionDefinitionIds?: readonly string[]
    savingThrowAbilityDefinitionId?: string | null
  } | null
}

function requireCanonicalUuid(value: string, label: string): string {
  const parsed = postgresUuidSchema.safeParse(value)
  if (!parsed.success || parsed.data !== value) {
    throw new Error(`${label} must be a canonical PostgreSQL UUID.`)
  }
  return parsed.data
}

function snapshotProvenance(actor: EncounterActorRecord): EncounterFeatureSourceProvenance {
  if (actor.kind !== 'CREATURE' || !actor.sourceId || !actor.sourceRevision || !actor.systemId) {
    throw new Error('Creature feature capabilities require an exact immutable Creature source.')
  }
  requireCanonicalUuid(actor.id, 'Encounter actor identity')
  requireCanonicalUuid(actor.sourceId, 'Creature source identity')
  requireCanonicalUuid(actor.systemId, 'Creature Game System identity')
  if (!Number.isSafeInteger(actor.sourceRevision) || actor.sourceRevision < 1) {
    throw new Error('Creature feature capabilities require a positive source revision.')
  }
  if (
    typeof actor.snapshot !== 'object' ||
    actor.snapshot === null ||
    Array.isArray(actor.snapshot)
  ) {
    throw new Error('Creature feature capabilities require an immutable Creature snapshot.')
  }
  const snapshot = actor.snapshot as Record<string, unknown>
  const snapshotKind = snapshot.kind
  const snapshotSourceId = snapshot.id
  const snapshotSystemId = snapshot.systemId
  const sourceVersionId = snapshot.sourceVersionId
  const sourceChecksum = snapshot.sourceChecksum
  const sourceRevision = snapshot.sourceRevision
  if (
    snapshotKind !== 'CREATURE' ||
    snapshotSourceId !== actor.sourceId ||
    snapshotSystemId !== actor.systemId ||
    typeof sourceVersionId !== 'string' ||
    typeof sourceChecksum !== 'string' ||
    sourceChecksum.match(/^[a-f0-9]{64}$/) === null ||
    !Number.isSafeInteger(sourceRevision) ||
    sourceRevision !== actor.sourceRevision
  ) {
    throw new Error('Creature feature capabilities have invalid immutable source provenance.')
  }
  requireCanonicalUuid(sourceVersionId, 'Creature source version identity')
  return {
    creatureSourceId: actor.sourceId,
    sourceRevision,
    sourceVersionId,
    sourceChecksum
  }
}

function snapshotFeatures(actor: EncounterActorRecord): readonly FeatureDto[] {
  if (
    typeof actor.snapshot !== 'object' ||
    actor.snapshot === null ||
    Array.isArray(actor.snapshot)
  ) {
    return []
  }
  const payload = (actor.snapshot as Record<string, unknown>).payload
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return []
  const features = (payload as Record<string, unknown>).features
  if (!Array.isArray(features)) return []
  return features.map((feature) => {
    const parsed = featureDtoSchema.safeParse(feature)
    if (!parsed.success)
      throw new Error('Creature feature capabilities require a valid immutable Feature snapshot.')
    return parsed.data
  })
}

function actionId(
  actorId: string,
  ownerFeatureId: string,
  featureOptionId: string | null,
  effectId: string
): string {
  const result =
    featureOptionId === null
      ? `${actorId}:FEATURE:${ownerFeatureId}:EFFECT:${effectId}`
      : `${actorId}:FEATURE:${ownerFeatureId}:OPTION:${featureOptionId}:EFFECT:${effectId}`
  if (result.length > 240)
    throw new Error('Encounter feature action identity exceeds 240 characters.')
  return result
}

/**
 * Rechecks an issued Encounter-feature capability against the immutable
 * Creature snapshot locked by the Encounter command. This deliberately
 * validates source identity and compiled Effect material without parsing
 * labels or using a feature name as mechanics.
 */
export function assertEncounterFeatureActionCapabilityCurrent(input: {
  actor: EncounterActorRecord
  capability: EncounterFeatureActionCapabilityDescriptor
}): void {
  const { actor, capability } = input
  const provenance = snapshotProvenance(actor)
  if (
    capability.kind !== 'ENCOUNTER_FEATURE' ||
    capability.encounterActorId !== actor.id ||
    capability.gameSystemId !== actor.systemId ||
    capability.creatureSourceId !== provenance.creatureSourceId ||
    capability.sourceRevision !== provenance.sourceRevision ||
    capability.sourceVersionId !== provenance.sourceVersionId ||
    capability.sourceChecksum !== provenance.sourceChecksum
  ) {
    throw new Error('Encounter feature action capability source provenance is stale.')
  }
  const ownerFeature = snapshotFeatures(actor).find(
    (feature) => feature.id === capability.ownerFeatureId
  )
  if (!ownerFeature || capability.sourceId !== ownerFeature.id) {
    throw new Error('Encounter feature action capability owner Feature is stale.')
  }
  const featureOption =
    capability.featureOptionId === null
      ? null
      : (ownerFeature.options?.find((option) => option.id === capability.featureOptionId) ?? null)
  if (capability.featureOptionId !== null && featureOption === null) {
    throw new Error('Encounter feature action capability Feature option is stale.')
  }
  const effects =
    featureOption === null ? (ownerFeature.effects ?? []) : (featureOption.effects ?? [])
  const effect = effects.find((candidate) => candidate.id === capability.effectId)
  if (!effect) throw new Error('Encounter feature action capability Effect is stale.')
  const compiledEffect = compileEffect(effect)
  if (
    capability.entryPointDefinitionId !== effect.id ||
    capability.actionId !==
      actionId(actor.id, ownerFeature.id, capability.featureOptionId, effect.id) ||
    capability.authoredEffectChecksum !== checksumRuleDocument(effect) ||
    capability.compiledEffectChecksum !== checksumRuleDocument(compiledEffect) ||
    checksumRuleDocument(capability.compiledEffect) !== checksumRuleDocument(compiledEffect)
  ) {
    throw new Error('Encounter feature action capability compiled Effect is stale.')
  }
  if (
    JSON.stringify(capability.featureResourceUse) !==
    JSON.stringify(featureResourceUse({ ownerFeature, compiledEffect }))
  ) {
    throw new Error('Encounter feature action capability resource binding is stale.')
  }
}

function featureEffectEntries(feature: FeatureDto): readonly {
  ownerFeature: FeatureDto
  featureOption: FeatureDto | null
  effect: EncounterFeatureEffect
}[] {
  return [
    ...(feature.effects ?? []).map((effect) => ({
      ownerFeature: feature,
      featureOption: null,
      effect
    })),
    ...(feature.options ?? []).flatMap((featureOption) => {
      const actionEffectCount = (featureOption.effects ?? []).filter(
        (effect) => effect.invocation?.kind === 'ACTION'
      ).length
      if (actionEffectCount > 1) {
        throw new Error(
          'Encounter feature capability discovery requires each Feature option to contain at most one action-invoked Effect.'
        )
      }
      return (featureOption.effects ?? []).map((effect) => ({
        ownerFeature: feature,
        featureOption,
        effect
      }))
    })
  ]
}

function assertExactSystemBindings(input: {
  conditionDefinitionIds: readonly string[]
  abilityDefinitions: readonly { id: string; code: string }[]
  normalized: {
    conditionDefinitionIds?: readonly string[]
    savingThrowAbilityDefinitionId?: string | null
  }
}): void {
  for (const conditionDefinitionId of input.normalized.conditionDefinitionIds ?? []) {
    requireCanonicalUuid(conditionDefinitionId, 'Encounter feature condition definition identity')
    if (!input.conditionDefinitionIds.includes(conditionDefinitionId)) {
      throw new Error(
        'Encounter feature System compiler returned an unpinned condition definition.'
      )
    }
  }
  const savingThrowAbilityDefinitionId = input.normalized.savingThrowAbilityDefinitionId
  if (savingThrowAbilityDefinitionId === undefined || savingThrowAbilityDefinitionId === null)
    return
  requireCanonicalUuid(
    savingThrowAbilityDefinitionId,
    'Encounter feature saving throw ability definition identity'
  )
  if (!input.abilityDefinitions.some((ability) => ability.id === savingThrowAbilityDefinitionId)) {
    throw new Error('Encounter feature System compiler returned an unpinned ability definition.')
  }
}

export function createEncounterFeatureActionCapabilityDiscoveryRegistry(
  adapters: readonly EncounterFeatureActionCapabilityAdapter[]
) {
  const adaptersBySystemId = new Map<string, EncounterFeatureActionCapabilityAdapter>()
  for (const adapter of adapters) {
    requireCanonicalUuid(
      adapter.gameSystemId,
      'Encounter feature capability adapter System identity'
    )
    if (adaptersBySystemId.has(adapter.gameSystemId)) {
      throw new Error(`Duplicate Encounter feature capability adapter: ${adapter.gameSystemId}.`)
    }
    adaptersBySystemId.set(adapter.gameSystemId, adapter)
  }
  return {
    discover(input: {
      actor: EncounterActorRecord
      conditionDefinitionIds?: readonly string[]
      abilityDefinitions?: readonly { id: string; code: string }[]
    }): readonly EncounterFeatureActionCapabilityDescriptor[] {
      if (input.actor.kind === 'CUSTOM' || input.actor.kind === 'CHARACTER') return []
      const provenance = snapshotProvenance(input.actor)
      const gameSystemId = requireCanonicalUuid(
        input.actor.systemId!,
        'Creature Game System identity'
      )
      const adapter = adaptersBySystemId.get(gameSystemId)
      if (!adapter) return []
      const descriptors: EncounterFeatureActionCapabilityDescriptor[] = []
      const actionIds = new Set<string>()
      for (const feature of snapshotFeatures(input.actor)) {
        const ownerFeatureId = requireCanonicalUuid(feature.id, 'Creature feature identity')
        for (const featureOption of feature.options ?? []) {
          requireCanonicalUuid(featureOption.id, 'Creature feature option identity')
        }
        for (const entry of featureEffectEntries(feature)) {
          const featureOptionId =
            entry.featureOption === null
              ? null
              : requireCanonicalUuid(entry.featureOption.id, 'Creature feature option identity')
          const effect = entry.effect
          const effectId = requireCanonicalUuid(effect.id, 'Creature feature Effect identity')
          const compiledEffect = compileEffect(effect)
          if (compiledEffect.invocation.kind !== 'ACTION') continue
          const normalized = adapter.compile({
            encounterActorId: input.actor.id,
            creatureSourceId: provenance.creatureSourceId,
            gameSystemId,
            sourceRevision: provenance.sourceRevision,
            sourceVersionId: provenance.sourceVersionId,
            sourceChecksum: provenance.sourceChecksum,
            ownerFeature: entry.ownerFeature,
            featureOption: entry.featureOption,
            compiledEffect,
            conditionDefinitionIds: input.conditionDefinitionIds ?? [],
            abilityDefinitions: input.abilityDefinitions ?? []
          })
          if (normalized === null) continue
          assertExactSystemBindings({
            conditionDefinitionIds: input.conditionDefinitionIds ?? [],
            abilityDefinitions: input.abilityDefinitions ?? [],
            normalized
          })
          const exactActionId = actionId(input.actor.id, ownerFeatureId, featureOptionId, effectId)
          if (actionIds.has(exactActionId)) {
            throw new Error(
              'Encounter feature capability discovery produced a duplicate action identity.'
            )
          }
          actionIds.add(exactActionId)
          descriptors.push({
            kind: 'ENCOUNTER_FEATURE',
            gameSystemId,
            authoredRootKind: 'effect',
            entryPointDefinitionId: effectId,
            effectId,
            actionId: exactActionId,
            sourceId: ownerFeatureId,
            mechanicFacts: normalizeCharacterActionMechanicFacts(compiledEffect),
            conditionDefinitionIds:
              normalized.conditionDefinitionIds ?? input.conditionDefinitionIds ?? [],
            savingThrowAbilityDefinitionId: normalized.savingThrowAbilityDefinitionId ?? null,
            compiledEffect,
            encounterActorId: input.actor.id,
            ownerFeatureId,
            featureOptionId,
            ownerRuleDefinitionIds: entry.ownerFeature.ruleDefinitionIds ?? [],
            optionRuleDefinitionIds: entry.featureOption?.ruleDefinitionIds ?? [],
            authoredEffectChecksum: checksumRuleDocument(effect),
            compiledEffectChecksum: checksumRuleDocument(compiledEffect),
            featureResourceUse: featureResourceUse({
              ownerFeature: entry.ownerFeature,
              compiledEffect
            }),
            ...provenance
          })
        }
      }
      return descriptors
    }
  }
}
