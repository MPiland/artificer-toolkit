import { featureDtoSchema, type FeatureDto } from '@artificer-toolkit/schema/features/feature'
import type { EncounterProjectionActorInput } from '@artificer-toolkit/schema/projections/encounterProjectionInput'
import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
import {
  compileEffect,
  type CompiledDamageEffect,
  type CompiledEffect,
  type CompiledEffectGroup
} from '@artificer-toolkit/shared/compilers'
import { parseRollExpression } from '@artificer-toolkit/shared/rolls'
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
export interface EncounterFeatureActionUnavailable {
  actionId: string
  label: string
  reason: string
}

export interface EncounterFeatureActionDiscovery {
  available: readonly EncounterFeatureActionCapabilityDescriptor[]
  unavailable: readonly EncounterFeatureActionUnavailable[]
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

function featureAttackMechanic(input: {
  ownerFeature: FeatureDto
  featureOption: FeatureDto | null
  compiledEffect: CompiledEffectGroup
}): EncounterFeatureActionCapabilityDescriptor['attackMechanic'] {
  const invocation = input.compiledEffect.invocation
  if (invocation.kind !== 'ACTION' || dnd5eAttackKind(invocation.triggerCode) === null) return null
  const source = input.featureOption ?? input.ownerFeature
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

type DamageSignature = {
  damageTypeId: string
  dice: readonly { count: number; die: number }[]
}

function damageSignatures(effect: CompiledEffectGroup): readonly DamageSignature[] {
  return effect.entries.flatMap((entry) => {
    if (
      entry.pathCode !== 'ON_HIT' ||
      !('outcome' in entry) ||
      entry.outcome.effectKind !== 'DAMAGE' ||
      entry.outcome.valueKind !== 'DICE' ||
      !('dice' in entry.outcome) ||
      typeof entry.outcome.dice !== 'string'
    ) {
      return []
    }
    const parsed = parseRollExpression(entry.outcome.dice)
    return [
      {
        damageTypeId: entry.outcome.damageTypeId,
        dice: parsed.terms.map((term) => ({ count: term.count, die: term.die }))
      }
    ]
  })
}

function hasSameBaseDamage(input: {
  equipmentEffect: CompiledEffectGroup
  featureEffect: CompiledEffectGroup
}): boolean {
  if (input.equipmentEffect.invocation.triggerCode !== input.featureEffect.invocation.triggerCode) {
    return false
  }
  const equipmentDamage = damageSignatures(input.equipmentEffect)
  const featureDamage = damageSignatures(input.featureEffect)
  return (
    equipmentDamage.length > 0 &&
    equipmentDamage.every((expected) =>
      featureDamage.some(
        (actual) =>
          actual.damageTypeId === expected.damageTypeId &&
          JSON.stringify(actual.dice) === JSON.stringify(expected.dice)
      )
    )
  )
}

type CompiledDiceDamageEffect = CompiledDamageEffect & {
  valueKind: 'DICE'
  dice: string
}

type SimpleHitDamageEntry = CompiledEffect & {
  pathCode: 'ON_HIT'
  outcome: CompiledDiceDamageEffect
}

function hitDamageEntry(
  entry: CompiledEffectGroup['entries'][number] | undefined
): SimpleHitDamageEntry | null {
  if (
    entry === undefined ||
    entry.pathCode !== 'ON_HIT' ||
    !('outcome' in entry) ||
    entry.outcome.effectKind !== 'DAMAGE' ||
    entry.outcome.valueKind !== 'DICE' ||
    !('dice' in entry.outcome) ||
    typeof entry.outcome.dice !== 'string'
  ) {
    return null
  }
  return entry as SimpleHitDamageEntry
}

function simpleHitDamageEntry(effect: CompiledEffectGroup): SimpleHitDamageEntry | null {
  if (effect.entries.length !== 1) return null
  return hitDamageEntry(effect.entries[0])
}

function composeBaseEquipmentEffect(input: {
  equipmentEffect: CompiledEffectGroup
  featureEffect: CompiledEffectGroup
}): CompiledEffectGroup {
  const equipmentEntry = simpleHitDamageEntry(input.equipmentEffect)
  const equipmentDice = equipmentEntry
    ? parseRollExpression(equipmentEntry.outcome.dice).terms.map((term) => ({
        count: term.count,
        die: term.die
      }))
    : []
  const matchingFeatureEntries = equipmentEntry
    ? input.featureEffect.entries.flatMap((entry) => {
        const candidate = hitDamageEntry(entry)
        return candidate &&
          candidate.outcome.damageTypeId === equipmentEntry.outcome.damageTypeId &&
          JSON.stringify(
            parseRollExpression(candidate.outcome.dice).terms.map((term) => ({
              count: term.count,
              die: term.die
            }))
          ) === JSON.stringify(equipmentDice)
          ? [candidate]
          : []
      })
    : []
  const featureEntry = matchingFeatureEntries.length === 1 ? matchingFeatureEntries[0] : null
  if (equipmentEntry === null || featureEntry === null || !hasSameBaseDamage(input)) {
    throw new Error(
      'Creature Feature base Equipment action must use a single matching hit-damage path.'
    )
  }
  return {
    ...input.equipmentEffect,
    id: input.featureEffect.id,
    order: input.featureEffect.order,
    invocation: input.featureEffect.invocation,
    entries: input.featureEffect.entries.map((entry) =>
      entry === featureEntry
        ? {
            ...equipmentEntry,
            outcome: {
              ...equipmentEntry.outcome,
              dice: featureEntry.outcome.dice,
              ...(featureEntry.outcome.bonuses === undefined
                ? {}
                : { bonuses: featureEntry.outcome.bonuses })
            }
          }
        : entry
    )
  }
}

type FeatureEquipmentResolution = {
  binding: EncounterFeatureActionCapabilityDescriptor['equipmentBinding']
  effectiveCompiledEffect: CompiledEffectGroup
}

export function resolveFeatureEquipmentAction(input: {
  actor: EncounterProjectionActorInput
  ownerFeature: FeatureDto
  featureEffects: readonly CompiledEffectGroup[]
  candidate: CompiledEffectGroup
}): FeatureEquipmentResolution {
  const loadout = snapshotLoadout(input.actor)
  const bindings = loadout.filter((entry) => entry.actionFeatureIds.includes(input.ownerFeature.id))
  if (bindings.length === 0) {
    return { binding: null, effectiveCompiledEffect: input.candidate }
  }
  if (bindings.length !== 1) {
    throw new Error('Creature Feature action has ambiguous Equipment loadout bindings.')
  }
  const source = snapshotCreatureEquipmentSources(input.actor).find(
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
    (effect) => effect.invocation.triggerCode === input.candidate.invocation.triggerCode
  )
  if (!matchingEquipmentEffect) {
    throw new Error('Creature Feature action does not match an Equipment action trigger.')
  }
  if (
    !input.featureEffects.some((effect) =>
      hasSameBaseDamage({
        equipmentEffect: matchingEquipmentEffect,
        featureEffect: effect
      })
    )
  ) {
    throw new Error(
      'Creature Feature action does not preserve its Equipment base damage mechanics.'
    )
  }
  const binding = {
    loadoutEntryId: source.loadoutEntryId,
    equipmentId: source.equipmentId,
    sourceRevision: source.sourceRevision,
    sourceVersionId: source.sourceVersionId,
    sourceChecksum: source.sourceChecksum
  }
  const effectiveCompiledEffect = hasSameBaseDamage({
    equipmentEffect: matchingEquipmentEffect,
    featureEffect: input.candidate
  })
    ? composeBaseEquipmentEffect({
        equipmentEffect: matchingEquipmentEffect,
        featureEffect: input.candidate
      })
    : input.candidate
  return { binding, effectiveCompiledEffect }
}

/**
 * Validates every action-bound feature against the effective loadout before an
 * Encounter-owned equipment overlay is persisted. It intentionally reuses the
 * same composition rule that discovery uses for future action capabilities.
 */
export function assertEncounterCreatureEquipmentLoadoutCapabilities(
  actor: EncounterProjectionActorInput
): void {
  for (const feature of snapshotFeatures(actor)) {
    const featureEffects = featureEffectEntries(feature)
      .map((entry) => compileEffect(entry.effect))
      .filter((effect) => effect.invocation.kind === 'ACTION')
    for (const entry of featureEffectEntries(feature)) {
      const candidate = compileEffect(entry.effect)
      if (candidate.invocation.kind !== 'ACTION') continue
      resolveFeatureEquipmentAction({
        actor,
        ownerFeature: entry.ownerFeature,
        featureEffects,
        candidate
      })
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
  const featureCompiledEffect = compileEffect(effect)
  if (
    capability.entryPointDefinitionId !== effect.id ||
    capability.actionId !==
      actionId(actor.id, ownerFeature.id, capability.featureOptionId, effect.id) ||
    capability.authoredEffectChecksum !== checksumRuleDocument(effect) ||
    capability.grip !== (effect.grip ?? null)
  ) {
    throw new Error('Encounter feature action capability authored Effect is stale.')
  }
  const equipmentResolution = resolveFeatureEquipmentAction({
    actor,
    ownerFeature,
    featureEffects: featureEffectEntries(ownerFeature)
      .map((entry) => compileEffect(entry.effect))
      .filter((candidate) => candidate.invocation.kind === 'ACTION'),
    candidate: featureCompiledEffect
  })
  const compiledEffect = equipmentResolution.effectiveCompiledEffect
  if (
    capability.compiledEffectChecksum !== checksumRuleDocument(compiledEffect) ||
    checksumRuleDocument(capability.compiledEffect) !== checksumRuleDocument(compiledEffect)
  ) {
    throw new Error('Encounter feature action capability effective mechanics are stale.')
  }
  if (
    JSON.stringify(capability.featureResourceUse) !==
    JSON.stringify(featureResourceUse({ ownerFeature, compiledEffect }))
  ) {
    throw new Error('Encounter feature action capability resource binding is stale.')
  }
  if (
    JSON.stringify(capability.equipmentBinding ?? null) !==
    JSON.stringify(equipmentResolution.binding)
  ) {
    throw new Error('Encounter feature action Equipment binding is stale.')
  }
  if (
    JSON.stringify(capability.attackMechanic) !==
    JSON.stringify(featureAttackMechanic({ ownerFeature, featureOption, compiledEffect }))
  ) {
    throw new Error('Encounter feature action attack roll is stale.')
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
            const equipmentResolution = resolveFeatureEquipmentAction({
              actor: input.actor,
              ownerFeature: entry.ownerFeature,
              featureEffects: featureEffectEntries(entry.ownerFeature)
                .map((candidate) => compileEffect(candidate.effect))
                .filter((candidate) => candidate.invocation.kind === 'ACTION'),
              candidate: compiledEffect
            })
            const effectiveCompiledEffect = equipmentResolution.effectiveCompiledEffect
            const normalized = adapter.compile({
              encounterActorId: input.actor.id,
              creatureSourceId: provenance.creatureSourceId,
              gameSystemId,
              sourceRevision: provenance.sourceRevision,
              sourceVersionId: provenance.sourceVersionId,
              sourceChecksum: provenance.sourceChecksum,
              ownerFeature: entry.ownerFeature,
              featureOption: entry.featureOption,
              compiledEffect: effectiveCompiledEffect,
              conditionDefinitionIds: input.conditionDefinitionIds ?? [],
              abilityDefinitions: input.abilityDefinitions ?? []
            })
            if (normalized === null) continue
            assertExactSystemBindings({
              conditionDefinitionIds: input.conditionDefinitionIds ?? [],
              abilityDefinitions: input.abilityDefinitions ?? [],
              normalized
            })
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
              mechanicFacts: normalizeCharacterActionMechanicFacts(effectiveCompiledEffect),
              conditionDefinitionIds:
                normalized.conditionDefinitionIds ?? input.conditionDefinitionIds ?? [],
              savingThrowAbilityDefinitionId: normalized.savingThrowAbilityDefinitionId ?? null,
              compiledEffect: effectiveCompiledEffect,
              encounterActorId: input.actor.id,
              ownerFeatureId,
              featureOptionId,
              ownerRuleDefinitionIds: entry.ownerFeature.ruleDefinitionIds ?? [],
              optionRuleDefinitionIds: entry.featureOption?.ruleDefinitionIds ?? [],
              authoredEffectChecksum: checksumRuleDocument(effect),
              compiledEffectChecksum: checksumRuleDocument(effectiveCompiledEffect),
              featureResourceUse: featureResourceUse({
                ownerFeature: entry.ownerFeature,
                compiledEffect: effectiveCompiledEffect
              }),
              equipmentBinding: equipmentResolution.binding,
              attackMechanic: featureAttackMechanic({
                ownerFeature: entry.ownerFeature,
                featureOption: entry.featureOption,
                compiledEffect: effectiveCompiledEffect
              }),
              ...provenance
            })
          } catch (error) {
            unavailable.push({
              actionId: exactActionId,
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

export function featureActionMechanic(
  capability: EncounterFeatureActionCapabilityDescriptor
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
