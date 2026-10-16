import { featureDtoSchema, type FeatureDto } from '@artificer-toolkit/schema/features/feature'
import type { EncounterProjectionActorInput } from '@artificer-toolkit/schema/projections/encounterProjectionInput'
import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
import { compileEffect, type CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { normalizeCharacterActionMechanicFacts } from './character/characterActionRuleFacts.js'
import type { EffectActionCapabilityDescriptor } from './characterActionCapabilityDiscovery.js'
import { dnd5eAttackKind } from './systems/dnd5e/attackKind.js'
import {
  snapshotCreatureEquipmentLoadout,
  snapshotCreatureEquipmentSources
} from './encounterCreatureEquipmentSources.js'

export interface EncounterFeatureActionCapabilityDescriptor extends EffectActionCapabilityDescriptor {
  kind: 'ENCOUNTER_FEATURE'
  encounterActorId: string
  creatureSourceId: string
  ownerFeatureId: string
  featureOptionId: string | null
  /**
   * The action Feature a Legendary option runs (D51 option B): its effect, ATTACK roll and
   * Equipment make the action, and the owner Feature's pool pays the option's cost. Null otherwise.
   */
  actionFeatureId: string | null
  ownerRuleDefinitionIds: readonly string[]
  optionRuleDefinitionIds: readonly string[]
  sourceRevision: number
  sourceVersionId: string
  sourceChecksum: string
  authoredEffectChecksum: string
  compiledEffectChecksum: string
  /** Exact owner-Feature charge binding for this action, when one is authored. */
  featureResourceUse: { chargeId: string; cost: number } | null
  /** Exact held Equipment source backing this Feature action, when authored. */
  equipmentBinding?: {
    loadoutEntryId: string
    equipmentId: string
    sourceRevision: number
    sourceVersionId: string
    sourceChecksum: string
  } | null
  /** The Feature/option's one authored ATTACK roll for an attack-triggered action, else null. */
  attackMechanic: {
    rollDefinitionId: string
    attackBonus: number
    rollMode: 'NORMAL' | 'ADVANTAGE' | 'DISADVANTAGE'
    definitionChecksum: string
  } | null
  /** Exact immutable Feature/option label for sanitized choices. */
  label: string
  /** The grip of one variant of a versatile weapon attack; each grip is its own action. */
  grip: NonNullable<EncounterFeatureEffect['grip']> | null
}

/** A Creature action whose authored mechanics cannot run; it is listed unavailable, not thrown. */
interface EncounterFeatureActionUnavailable {
  actionId: string
  ownerFeatureId: string
  label: string
  reason: string
}

export interface EncounterFeatureActionDiscovery {
  available: readonly EncounterFeatureActionCapabilityDescriptor[]
  unavailable: readonly EncounterFeatureActionUnavailable[]
}

type FeatureOption = NonNullable<FeatureDto['options']>[number]

/**
 * One Effect a Creature can act with: its owner Feature (the action identity and charge pool), its
 * option, and, for an option that runs another action, that action Feature, whose Effect, ATTACK roll
 * and Equipment make the action.
 */
interface FeatureEffectEntry {
  ownerFeature: FeatureDto
  featureOption: FeatureOption | null
  actionFeature: FeatureDto | null
  effect: EncounterFeatureEffect
}

/** The owner-Feature charges an action spends: its option's cost, or its Effect's authored use. */
function featureResourceUse(
  entry: FeatureEffectEntry,
  compiledEffect: CompiledEffectGroup
): { chargeId: string; cost: number } | null {
  const invocation = compiledEffect.invocation
  if (invocation.kind !== 'ACTION') return null
  const resourceUse = invocation.resourceUse ?? null
  const reference = entry.featureOption?.actionReference
  if (reference) {
    const chargeId = entry.ownerFeature.charges?.id
    if (resourceUse !== null || chargeId === undefined)
      throw new Error('An option that runs another action spends only its own Feature charges.')
    return { chargeId, cost: reference.chargeCost }
  }
  if (resourceUse === null) return null
  if (entry.ownerFeature.charges?.id !== resourceUse.chargeId) {
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

function featureAttackMechanic(
  entry: FeatureEffectEntry,
  compiledEffect: CompiledEffectGroup
): EncounterFeatureActionCapabilityDescriptor['attackMechanic'] {
  const invocation = compiledEffect.invocation
  if (invocation.kind !== 'ACTION' || dnd5eAttackKind(invocation.triggerCode) === null) return null
  const source = entry.actionFeature ?? entry.featureOption ?? entry.ownerFeature
  const definitions = (source.rollDefinitions ?? []).filter(
    (definition) => definition.kind === 'ATTACK'
  )
  const [definition] = definitions
  if (!definition || definitions.length !== 1) {
    throw new Error(
      `Encounter feature attack action "${source.label}" must author exactly one ATTACK roll definition.`
    )
  }
  requireCanonicalUuid(definition.id, 'Encounter feature attack roll identity')
  if (
    definition.expression.count !== 1 ||
    definition.expression.die !== 20 ||
    !Number.isSafeInteger(definition.expression.modifier)
  ) {
    throw new Error('Encounter feature attack roll must be one d20 plus a fixed modifier.')
  }
  return {
    rollDefinitionId: definition.id,
    attackBonus: definition.expression.modifier,
    rollMode: definition.rollMode,
    definitionChecksum: checksumRuleDocument(definition)
  }
}

/** What a System adapter binds to its pinned vocabulary for one compiled Effect. */
export interface EncounterEffectCompilerInput {
  gameSystemId: string
  compiledEffect: CompiledEffectGroup
  conditionDefinitionIds: readonly string[]
  abilityDefinitions: readonly { id: string; code: string }[]
}

export interface EncounterFeatureActionCapabilityAdapter {
  gameSystemId: string
  compile(input: EncounterEffectCompilerInput): {
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

function snapshotProvenance(
  actor: EncounterProjectionActorInput
): EncounterFeatureSourceProvenance {
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

function snapshotFeatures(actor: EncounterProjectionActorInput): readonly FeatureDto[] {
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

function snapshotLoadout(actor: EncounterProjectionActorInput) {
  return snapshotCreatureEquipmentLoadout(actor)
}

/** The damage types of an Effect's hit damage, dice or fixed. */
function hitDamageTypeIds(effect: CompiledEffectGroup): ReadonlySet<string> {
  return new Set(
    effect.entries.flatMap((entry) =>
      entry.pathCode === 'ON_HIT' &&
      'outcome' in entry &&
      entry.outcome.effectKind === 'DAMAGE' &&
      entry.outcome.damageTypeId !== undefined
        ? [entry.outcome.damageTypeId]
        : []
    )
  )
}

/**
 * A Creature Feature acts through the Equipment it holds when both are the same kind of attack and
 * the Feature deals every damage type the Equipment does. The Feature authors its own printed hit
 * damage (an SRD monster's weapon dice scale with its size, and traits such as Brute add dice);
 * the Equipment gives the action its identity and properties (D62, M9).
 */
function actsThroughEquipment(input: {
  equipmentEffect: CompiledEffectGroup
  featureEffect: CompiledEffectGroup
}): boolean {
  if (input.equipmentEffect.invocation.triggerCode !== input.featureEffect.invocation.triggerCode)
    return false
  const equipmentTypes = hitDamageTypeIds(input.equipmentEffect)
  const featureTypes = hitDamageTypeIds(input.featureEffect)
  return equipmentTypes.size > 0 && [...equipmentTypes].every((type) => featureTypes.has(type))
}

/** The Equipment an entry's action Feature acts through, if its loadout binds one. */
function entryEquipmentBinding(
  actor: EncounterProjectionActorInput,
  entry: FeatureEffectEntry,
  candidate: CompiledEffectGroup
): EncounterFeatureActionCapabilityDescriptor['equipmentBinding'] {
  const equipmentFeature = entry.actionFeature ?? entry.ownerFeature
  const bindings = snapshotLoadout(actor).filter((loadoutEntry) =>
    loadoutEntry.actionFeatureIds.includes(equipmentFeature.id)
  )
  if (bindings.length === 0) return null
  if (bindings.length !== 1) {
    throw new Error('Creature Feature action has ambiguous Equipment loadout bindings.')
  }
  const source = snapshotCreatureEquipmentSources(actor).find(
    (candidate) => candidate.loadoutEntryId === bindings[0]!.id
  )
  if (!source) throw new Error('Creature Feature action is missing its pinned Equipment source.')
  const equipmentEffects = source.compiled.effects?.filter(
    (effect) => effect.invocation.kind === 'ACTION'
  )
  if (!equipmentEffects?.length) {
    throw new Error('Creature Feature action Equipment source has no compiled action mechanics.')
  }
  const matchingEquipmentEffect = equipmentEffects.find(
    (effect) => effect.invocation.triggerCode === candidate.invocation.triggerCode
  )
  if (!matchingEquipmentEffect) {
    throw new Error('Creature Feature action does not match an Equipment action trigger.')
  }
  const featureEffects = [
    ...(equipmentFeature.effects ?? []),
    ...(equipmentFeature.options ?? []).flatMap((option) => option.effects ?? [])
  ]
  if (
    !featureEffects.some(
      (effect) =>
        effect.invocation.kind === 'ACTION' &&
        actsThroughEquipment({
          equipmentEffect: matchingEquipmentEffect,
          featureEffect: compileEffect(effect)
        })
    )
  ) {
    throw new Error('Creature Feature action does not deal its Equipment damage types.')
  }
  return {
    loadoutEntryId: source.loadoutEntryId,
    equipmentId: source.equipmentId,
    sourceRevision: source.sourceRevision,
    sourceVersionId: source.sourceVersionId,
    sourceChecksum: source.sourceChecksum
  }
}

/**
 * Validates every action-bound feature against the effective loadout before an
 * Encounter-owned equipment overlay is persisted. It intentionally reuses the
 * same binding rule that discovery uses for future action capabilities.
 */
export function assertEncounterCreatureEquipmentLoadoutCapabilities(
  actor: EncounterProjectionActorInput
): void {
  const features = snapshotFeatures(actor)
  for (const feature of features) {
    for (const entry of featureEffectEntries(feature, features)) {
      const candidate = compileEffect(entry.effect)
      if (candidate.invocation.kind !== 'ACTION') continue
      entryEquipmentBinding(actor, entry, candidate)
    }
  }
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
  actor: EncounterProjectionActorInput
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
  const features = snapshotFeatures(actor)
  const ownerFeature = features.find((feature) => feature.id === capability.ownerFeatureId)
  if (!ownerFeature || capability.sourceId !== ownerFeature.id) {
    throw new Error('Encounter feature action capability owner Feature is stale.')
  }
  const entry = featureEffectEntries(ownerFeature, features).find(
    (candidate) =>
      (candidate.featureOption?.id ?? null) === capability.featureOptionId &&
      candidate.effect.id === capability.effectId
  )
  if (!entry || (entry.actionFeature?.id ?? null) !== capability.actionFeatureId)
    throw new Error('Encounter feature action capability Effect is stale.')
  const { effect } = entry
  const compiledEffect = compileEffect(effect)
  if (
    capability.entryPointDefinitionId !== effect.id ||
    capability.actionId !==
      actionId(actor.id, ownerFeature.id, capability.featureOptionId, effect.id) ||
    capability.authoredEffectChecksum !== checksumRuleDocument(effect) ||
    capability.grip !== (effect.grip ?? null)
  ) {
    throw new Error('Encounter feature action capability authored Effect is stale.')
  }
  if (
    capability.compiledEffectChecksum !== checksumRuleDocument(compiledEffect) ||
    checksumRuleDocument(capability.compiledEffect) !== checksumRuleDocument(compiledEffect)
  ) {
    throw new Error('Encounter feature action capability effective mechanics are stale.')
  }
  if (
    JSON.stringify(capability.featureResourceUse) !==
    JSON.stringify(featureResourceUse(entry, compiledEffect))
  ) {
    throw new Error('Encounter feature action capability resource binding is stale.')
  }
  if (
    JSON.stringify(capability.equipmentBinding ?? null) !==
    JSON.stringify(entryEquipmentBinding(actor, entry, compiledEffect))
  ) {
    throw new Error('Encounter feature action Equipment binding is stale.')
  }
  if (
    JSON.stringify(capability.attackMechanic) !==
    JSON.stringify(featureAttackMechanic(entry, compiledEffect))
  ) {
    throw new Error('Encounter feature action attack roll is stale.')
  }
}

function featureEffectEntries(
  feature: FeatureDto,
  features: readonly FeatureDto[]
): readonly FeatureEffectEntry[] {
  return [
    ...(feature.effects ?? []).map((effect) => ({
      ownerFeature: feature,
      featureOption: null,
      actionFeature: null,
      effect
    })),
    ...(feature.options ?? []).flatMap((featureOption): FeatureEffectEntry[] => {
      const reference = featureOption.actionReference
      if (reference) {
        const actionFeature = features.find((candidate) => candidate.id === reference.featureId)
        if (!actionFeature || actionFeature.id === feature.id)
          throw new Error(
            'An Encounter feature option that runs another action must name another Feature of its Creature.'
          )
        return (actionFeature.effects ?? []).map((effect) => ({
          ownerFeature: feature,
          featureOption,
          actionFeature,
          effect
        }))
      }
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
        actionFeature: null,
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

/** The adapter's bindings for one compiled Effect, checked against the pinned System vocabulary. */
function bindEffect(
  adapter: EncounterFeatureActionCapabilityAdapter,
  input: EncounterEffectCompilerInput
) {
  const normalized = adapter.compile(input)
  if (normalized !== null)
    assertExactSystemBindings({
      conditionDefinitionIds: input.conditionDefinitionIds,
      abilityDefinitions: input.abilityDefinitions,
      normalized
    })
  return normalized
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
    /** The System bindings of one compiled Effect; null when its System has no adapter. */
    bind(input: EncounterEffectCompilerInput) {
      const adapter = adaptersBySystemId.get(input.gameSystemId)
      return adapter ? bindEffect(adapter, input) : null
    },
    discover(input: {
      actor: EncounterProjectionActorInput
      conditionDefinitionIds?: readonly string[]
      abilityDefinitions?: readonly { id: string; code: string }[]
    }): EncounterFeatureActionDiscovery {
      if (input.actor.kind === 'CUSTOM' || input.actor.kind === 'CHARACTER')
        return { available: [], unavailable: [] }
      const provenance = snapshotProvenance(input.actor)
      const gameSystemId = requireCanonicalUuid(
        input.actor.systemId!,
        'Creature Game System identity'
      )
      const adapter = adaptersBySystemId.get(gameSystemId)
      if (!adapter) return { available: [], unavailable: [] }
      const available: EncounterFeatureActionCapabilityDescriptor[] = []
      const unavailable: EncounterFeatureActionUnavailable[] = []
      const actionIds = new Set<string>()
      const features = snapshotFeatures(input.actor)
      for (const feature of features) {
        const ownerFeatureId = requireCanonicalUuid(feature.id, 'Creature feature identity')
        for (const featureOption of feature.options ?? []) {
          requireCanonicalUuid(featureOption.id, 'Creature feature option identity')
        }
        for (const entry of featureEffectEntries(feature, features)) {
          const featureOptionId =
            entry.featureOption === null
              ? null
              : requireCanonicalUuid(entry.featureOption.id, 'Creature feature option identity')
          const effect = entry.effect
          const effectId = requireCanonicalUuid(effect.id, 'Creature feature Effect identity')
          if (effect.invocation.kind === 'PASSIVE') continue
          const exactActionId = actionId(input.actor.id, ownerFeatureId, featureOptionId, effectId)
          if (actionIds.has(exactActionId)) {
            throw new Error(
              'Encounter feature capability discovery produced a duplicate action identity.'
            )
          }
          actionIds.add(exactActionId)
          const label = entry.featureOption?.label ?? entry.ownerFeature.label
          // One action's invalid authored mechanics make only that action unavailable (D54).
          try {
            const compiledEffect = compileEffect(effect)
            const equipmentBinding = entryEquipmentBinding(input.actor, entry, compiledEffect)
            const normalized = bindEffect(adapter, {
              gameSystemId,
              compiledEffect,
              conditionDefinitionIds: input.conditionDefinitionIds ?? [],
              abilityDefinitions: input.abilityDefinitions ?? []
            })
            if (normalized === null) continue
            available.push({
              kind: 'ENCOUNTER_FEATURE',
              gameSystemId,
              authoredRootKind: 'effect',
              entryPointDefinitionId: effectId,
              effectId,
              actionId: exactActionId,
              label,
              grip: effect.grip ?? null,
              sourceId: ownerFeatureId,
              mechanicFacts: normalizeCharacterActionMechanicFacts(compiledEffect),
              conditionDefinitionIds:
                normalized.conditionDefinitionIds ?? input.conditionDefinitionIds ?? [],
              savingThrowAbilityDefinitionId: normalized.savingThrowAbilityDefinitionId ?? null,
              compiledEffect,
              encounterActorId: input.actor.id,
              ownerFeatureId,
              featureOptionId,
              actionFeatureId: entry.actionFeature?.id ?? null,
              ownerRuleDefinitionIds: entry.ownerFeature.ruleDefinitionIds ?? [],
              optionRuleDefinitionIds: entry.featureOption?.ruleDefinitionIds ?? [],
              authoredEffectChecksum: checksumRuleDocument(effect),
              compiledEffectChecksum: checksumRuleDocument(compiledEffect),
              featureResourceUse: featureResourceUse(entry, compiledEffect),
              equipmentBinding,
              attackMechanic: featureAttackMechanic(entry, compiledEffect),
              ...provenance
            })
          } catch (error) {
            unavailable.push({
              actionId: exactActionId,
              ownerFeatureId,
              label,
              reason: error instanceof Error ? error.message : 'Its authored mechanics are invalid.'
            })
          }
        }
      }
      return { available, unavailable }
    }
  }
}

/** The action mechanic of an authored Effect action: a Creature Feature's or an authored basic action's. */
export function featureActionMechanic(
  capability: EffectActionCapabilityDescriptor &
    Partial<Pick<EncounterFeatureActionCapabilityDescriptor, 'attackMechanic'>>
): Readonly<Record<string, unknown>> {
  const invocation = capability.mechanicFacts.invocation
  const savingThrow = invocation.savingThrow
  const attackKind = dnd5eAttackKind(invocation.triggerCode)
  const save =
    savingThrow?.dcMethod === 'FIXED_DC' &&
    Number.isSafeInteger(savingThrow.baseDc) &&
    capability.savingThrowAbilityDefinitionId
      ? {
          abilityDefinitionId: capability.savingThrowAbilityDefinitionId,
          dc: savingThrow.baseDc
        }
      : null
  return {
    effectId: capability.effectId,
    trigger: invocation.triggerCode,
    activation: invocation.activation,
    attackBonus: capability.attackMechanic?.attackBonus ?? null,
    attackRollMode: capability.attackMechanic?.rollMode ?? null,
    attackKind,
    save,
    outcomes: capability.mechanicFacts.outcomes
  }
}
