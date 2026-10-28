import { featureDtoSchema, type FeatureDto } from '@artificer-toolkit/schema/features/feature'
import type { AttackKind } from '@artificer-toolkit/schema/shared/enums'
import type { EncounterProjectionActorInput } from '@artificer-toolkit/schema/projections/encounterProjectionInput'
import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
import { compileEffect, type CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'
import type { CompiledSpell } from '@artificer-toolkit/shared/subjects/compilers'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { normalizeCharacterActionMechanicFacts } from './character/characterActionRuleFacts.js'
import { collectOnHitRiders, mergeOnHitRiders } from './character/characterOnHitRiders.js'
import type { EffectActionCapabilityDescriptor } from './characterActionCapabilityDiscovery.js'
import { listCreatureSpellCasts } from './encounterCreatureSpellCasts.js'
import { castableEffectGroups, spellCastActionId, spellCastLabel } from './spellCastCandidates.js'
import { passiveMeleeRetaliationZone, placedSpaceManifest } from './encounterZonePlacement.js'
import type { AttackProfileCapabilityAdapter } from './attackProfileCapability.js'
import { standingEffectReturnsOn } from './standingEffects.js'
import { snapshotAbilityScores } from './encounterActorState.js'
import {
  attackProfileCapabilityRegistry,
  encounterFeatureActionCapabilityRegistry
} from './platformEncounterPolicy.js'
import {
  type EncounterCreatureEquipmentSource,
  snapshotCreatureEquipmentItems,
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
  /**
   * The slot table row a Spell cast spends, of the Feature whose table it is; null for an action
   * that spends no slot. The row id keys its used count.
   */
  spellSlotUse: { ownerFeatureId: string; slotRowId: string; spellId: string } | null
  /** Exact held Equipment source backing this Feature action, when authored. */
  equipmentBinding?: {
    loadoutEntryId: string
    equipmentId: string
    sourceRevision: number
    sourceVersionId: string
    sourceChecksum: string
  } | null
  /**
   * The Feature/option's one authored ATTACK roll for an attack-triggered action, else null. Its
   * bonus and the damage bonus add what the loadout applies to the bound weapon (ATTACK-6.3). A
   * Spell cast's attack is its caster's spell attack, which no Feature roll authors: its roll
   * identity and checksum are null.
   */
  attackMechanic: {
    rollDefinitionId: string | null
    attackBonus: number
    damageBonus: number
    rollMode: string
    definitionChecksum: string | null
  } | null
  /** The caster's spell save DC a Spell cast's `SOURCE_SAVE_DC` save reads; null for other actions. */
  spellSaveDc: number | null
  /** Exact immutable Feature/option label for sanitized choices. */
  label: string
  /** The grip of one variant of a versatile weapon attack; each grip is its own action. */
  grip: NonNullable<EncounterFeatureEffect['grip']> | null
  /** The spell the action casts, which Counterspell answers; null when it casts none (D136). */
  spellCast: NonNullable<EncounterFeatureEffect['spellCast']> | null
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
  /** The passive features that keep a zone around the Creature (D144), never offered as actions. */
  passiveZoneCapabilities: readonly EncounterFeatureActionCapabilityDescriptor[]
  /** The passive features that give their holder a timed grant when it takes damage, never offered as actions. */
  passiveDamageGrantCapabilities: readonly EncounterFeatureActionCapabilityDescriptor[]
  /** The passive features that fire when their holder is reduced to 0 hit points, never offered as actions. */
  passiveHpZeroCapabilities: readonly EncounterFeatureActionCapabilityDescriptor[]
  passiveWeaponHitCapabilities: readonly EncounterFeatureActionCapabilityDescriptor[]
  /** The passive features that fire at the start of their holder's turn, never offered as actions. */
  passiveStartOfTurnCapabilities: readonly EncounterFeatureActionCapabilityDescriptor[]
  /** The passive features whose always-on effect a rest turns back on, never offered as actions. */
  passiveStandingCapabilities: readonly EncounterFeatureActionCapabilityDescriptor[]
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
  profile: AttackProfileCapabilityAdapter,
  actor: EncounterProjectionActorInput,
  entry: FeatureEffectEntry,
  compiledEffect: CompiledEffectGroup,
  equipmentBinding: EncounterFeatureActionCapabilityDescriptor['equipmentBinding']
): EncounterFeatureActionCapabilityDescriptor['attackMechanic'] {
  const invocation = compiledEffect.invocation
  const attackKind =
    invocation.kind === 'ACTION' ? profile.attackKind(invocation.triggerCode) : null
  if (attackKind === null) return null
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
  const weaponBonuses = equipmentBinding
    ? boundWeaponBonuses(profile, actor, entry, compiledEffect, {
        attackKind,
        loadoutEntryId: equipmentBinding.loadoutEntryId
      })
    : { attack: 0, damage: 0 }
  return {
    rollDefinitionId: definition.id,
    attackBonus: definition.expression.modifier + weaponBonuses.attack,
    damageBonus: weaponBonuses.damage,
    rollMode: definition.rollMode,
    definitionChecksum: checksumRuleDocument(definition)
  }
}

/**
 * What the Creature's folded loadout adds to an attack made with its bound weapon, as for a
 * Character attacking with that item (ATTACK-6.3), held in the grip the Feature authors.
 */
function boundWeaponBonuses(
  profile: AttackProfileCapabilityAdapter,
  actor: EncounterProjectionActorInput,
  entry: FeatureEffectEntry,
  compiledEffect: CompiledEffectGroup,
  weapon: { attackKind: AttackKind; loadoutEntryId: string }
): { attack: number; damage: number } {
  const abilityScores = snapshotAbilityScores(actor)
  if (!abilityScores) throw new Error('Encounter feature attack needs Creature ability scores.')
  return profile.creatureWeaponBonuses({
    abilityScores,
    equipment: snapshotCreatureEquipmentItems(actor).map(({ entry: loadoutEntry, source }) => ({
      id: loadoutEntry.id,
      useState: loadoutEntry.useState,
      compiled: source.compiled
    })),
    loadoutEntryId: weapon.loadoutEntryId,
    attackKind: weapon.attackKind,
    grip: entry.effect.grip ?? null,
    activation:
      'activation' in compiledEffect.invocation
        ? (compiledEffect.invocation.activation?.code ?? null)
        : null
  })
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

/** The Features of a Creature's immutable snapshot, parsed; empty when it holds none. */
export function snapshotFeatures(
  actor: Pick<EncounterProjectionActorInput, 'snapshot'>
): readonly FeatureDto[] {
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
 * A replacement of Equipment that Feature actions act through keeps the damage types of the Equipment it replaces: the print governs the bound
 * attack, so the swap must not change what kind of weapon the loadout holds (a Greatclub for a
 * Dagger is refused).
 */
export function equipmentReplacementKeepsDamageTypes(
  replaced: EncounterCreatureEquipmentSource,
  replacement: EncounterCreatureEquipmentSource
): boolean {
  const types = (source: EncounterCreatureEquipmentSource) =>
    new Set(
      (source.compiled.effects ?? []).flatMap((effect) =>
        effect.invocation.kind === 'ACTION' ? [...hitDamageTypeIds(effect)] : []
      )
    )
  const before = types(replaced)
  const after = types(replacement)
  return before.size === after.size && [...before].every((type) => after.has(type))
}

/**
 * A Creature Feature acts through the Equipment it holds when both are the same kind of attack.
 * The Feature authors its own printed hit damage, damage type included (an SRD monster's weapon
 * dice scale with its size, traits such as Brute add dice, and a print may name a type its
 * Equipment's default does not); the Equipment gives the action its identity and properties
 * (D62, M9).
 */
function actsThroughEquipment(input: {
  equipmentEffect: CompiledEffectGroup
  featureEffect: CompiledEffectGroup
}): boolean {
  return input.equipmentEffect.invocation.triggerCode === input.featureEffect.invocation.triggerCode
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
    throw new Error('Creature Feature action is not the same kind of attack as its Equipment.')
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

/** One Spell cast a Creature can make: directly from its grant, or through a Feature option. */
interface CreatureSpellCastAction {
  actionId: string
  label: string
  ownerFeature: FeatureDto
  featureOption: FeatureOption | null
  castLevel: number
  compiledEffect: CompiledEffectGroup
  featureResourceUse: EncounterFeatureActionCapabilityDescriptor['featureResourceUse']
  spellSlotUse: EncounterFeatureActionCapabilityDescriptor['spellSlotUse']
  attackMechanic: EncounterFeatureActionCapabilityDescriptor['attackMechanic']
  spellSaveDc: number | null
}

/**
 * The Spell casts a Creature can make from the Run's pinned Spells (D163): each cast of its grants,
 * and each cast a Feature option's `grantedSpellCast` makes of a granted spell of that kind, which
 * also pays the option's own cost and is never a reaction. A slot cast spends the row of its level.
 * A spell attack rolls the caster's spell attack bonus and a spell save reads its spell save DC,
 * both from the DC the grant states; a spell attack whose grant states none is listed unavailable.
 */
function creatureSpellCastActions(input: {
  profile: AttackProfileCapabilityAdapter
  actor: EncounterProjectionActorInput
  features: readonly FeatureDto[]
  spells: ReadonlyMap<string, CompiledSpell>
}): readonly (CreatureSpellCastAction | EncounterFeatureActionUnavailable)[] {
  const { profile, actor, features, spells } = input
  // An empty pin map offers no casts (passive-only callers, and a Run with no pins).
  if (spells.size === 0) return []
  const casts = listCreatureSpellCasts({ actor, features, spellLevelsById: spells })
  if (casts.length === 0) return []
  const grantedCastEntries = features.flatMap((feature) =>
    featureEffectEntries(feature, features).flatMap((entry) =>
      entry.featureOption && entry.effect.grantedSpellCast
        ? [
            {
              ...entry,
              featureOption: entry.featureOption,
              grantedSpellCast: entry.effect.grantedSpellCast
            }
          ]
        : []
    )
  )
  return casts.flatMap(({ ownerFeature, cast, spellSaveDc, slotRowId }) => {
    const spell = spells.get(cast.spellId)!
    const label = spellCastLabel(spell, cast)
    const spellcasting = spellSaveDc === null ? null : profile.creatureSpellcasting({ spellSaveDc })
    const spellSlotUse =
      slotRowId === null
        ? null
        : { ownerFeatureId: ownerFeature.id, slotRowId, spellId: cast.spellId }
    const spellKind = cast.spellLevel === 0 ? 'CANTRIP' : 'LEVELED'
    const groups = castableEffectGroups(spell).map((compiledEffect, index) => ({
      compiledEffect,
      laterEffectId: index === 0 ? undefined : compiledEffect.id
    }))
    const castAction = (
      action: Omit<
        CreatureSpellCastAction,
        'castLevel' | 'spellSlotUse' | 'attackMechanic' | 'spellSaveDc'
      >
    ) => {
      const { invocation } = action.compiledEffect
      const attackKind =
        invocation.kind === 'ACTION' ? profile.attackKind(invocation.triggerCode) : null
      if (attackKind !== null && spellcasting === null)
        return {
          actionId: action.actionId,
          ownerFeatureId: action.ownerFeature.id,
          label: action.label,
          reason: 'A Creature spell attack needs the spell save DC its grant states.'
        }
      return {
        ...action,
        castLevel: cast.castLevel,
        spellSlotUse,
        attackMechanic:
          attackKind === null || spellcasting === null
            ? null
            : {
                rollDefinitionId: null,
                attackBonus: spellcasting.attackBonus,
                damageBonus: 0,
                rollMode: 'NORMAL',
                definitionChecksum: null
              },
        spellSaveDc: spellcasting?.saveDc ?? null
      }
    }
    return [
      ...groups.map(({ compiledEffect, laterEffectId }) =>
        castAction({
          actionId: spellCastActionId(cast.candidateId, laterEffectId),
          label,
          ownerFeature,
          featureOption: null,
          compiledEffect,
          featureResourceUse: null
        })
      ),
      ...grantedCastEntries
        .filter((entry) => entry.grantedSpellCast.spellKind === spellKind)
        .flatMap((entry) =>
          groups
            .filter(
              ({ compiledEffect: { invocation } }) =>
                !('activation' in invocation) || invocation.activation.code !== 'REACTION'
            )
            .map(({ compiledEffect, laterEffectId }) =>
              castAction({
                actionId: spellCastActionId(
                  `${entry.featureOption.id}:${cast.candidateId}`,
                  laterEffectId
                ),
                label: `${entry.featureOption.label}: ${label}`,
                ownerFeature: entry.ownerFeature,
                featureOption: entry.featureOption,
                compiledEffect,
                featureResourceUse: featureResourceUse(entry, compileEffect(entry.effect))
              })
            )
        )
    ]
  })
}

/** What a Spell cast capability binds from the Creature snapshot and the Run's pins. */
function spellCastBinding(
  action: Pick<
    EncounterFeatureActionCapabilityDescriptor,
    | 'actionId'
    | 'label'
    | 'ownerFeatureId'
    | 'featureOptionId'
    | 'featureResourceUse'
    | 'spellSlotUse'
    | 'attackMechanic'
    | 'spellSaveDc'
  > & { castLevel: number | undefined; compiledEffectChecksum: string }
): string {
  return JSON.stringify([
    action.actionId,
    action.label,
    action.ownerFeatureId,
    action.featureOptionId,
    action.castLevel,
    action.compiledEffectChecksum,
    action.featureResourceUse,
    action.spellSlotUse,
    action.attackMechanic,
    action.spellSaveDc
  ])
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
  /** The Run's pinned Spells (D163), from which a Spell cast is rebuilt. */
  spells: ReadonlyMap<string, CompiledSpell>
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
  const profile = attackProfileCapabilityRegistry.require(capability.gameSystemId)
  if (capability.spellCastLevel !== undefined) {
    // A Spell cast is built from the Run's pinned compilation (D163), not from a Feature Effect
    // of the snapshot, so it is rebuilt from the snapshot and the pins.
    const current = creatureSpellCastActions({
      profile,
      actor,
      features,
      spells: input.spells
    }).find((action) => action.actionId === capability.actionId)
    if (
      !current ||
      'reason' in current ||
      capability.authoredEffectChecksum !== capability.compiledEffectChecksum ||
      capability.compiledEffectChecksum !== checksumRuleDocument(capability.compiledEffect) ||
      spellCastBinding({ ...capability, castLevel: capability.spellCastLevel }) !==
        spellCastBinding({
          ...current,
          ownerFeatureId: current.ownerFeature.id,
          featureOptionId: current.featureOption?.id ?? null,
          compiledEffectChecksum: checksumRuleDocument(current.compiledEffect)
        })
    )
      throw new Error('Encounter feature action capability Spell cast is stale.')
    return
  }
  const entry = featureEffectEntries(ownerFeature, features).find(
    (candidate) =>
      (candidate.featureOption?.id ?? null) === capability.featureOptionId &&
      candidate.effect.id === capability.effectId
  )
  if (!entry || (entry.actionFeature?.id ?? null) !== capability.actionFeatureId)
    throw new Error('Encounter feature action capability Effect is stale.')
  const { effect } = entry
  const compiledEffect = creatureActionEffect(profile, entry, features)
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
  const equipmentBinding = entryEquipmentBinding(actor, entry, compiledEffect)
  if (JSON.stringify(capability.equipmentBinding ?? null) !== JSON.stringify(equipmentBinding)) {
    throw new Error('Encounter feature action Equipment binding is stale.')
  }
  if (
    JSON.stringify(capability.attackMechanic) !==
    JSON.stringify(featureAttackMechanic(profile, actor, entry, compiledEffect, equipmentBinding))
  ) {
    throw new Error('Encounter feature action attack roll is stale.')
  }
}

/**
 * A Creature action's effective mechanics, as a Character's are: its compiled Effect with the
 * `ON_HIT` riders of the Creature's passive Features merged in, then its path restrictions
 * settled. A Creature attack has no Equipment facts here, so a rider's weapon checks never hold.
 * The attack's Feature is its action Feature when an option binds one, else the Feature itself.
 */
function creatureActionEffect(
  profile: AttackProfileCapabilityAdapter,
  { effect, actionFeature, ownerFeature }: FeatureEffectEntry,
  features: readonly FeatureDto[]
): CompiledEffectGroup {
  const riders = features.flatMap((feature) =>
    featureEffectEntries(feature, features).flatMap((entry) =>
      collectOnHitRiders(
        [compileEffect(entry.effect)],
        entry.featureOption?.id ?? entry.ownerFeature.id
      )
    )
  )
  const compiled = profile.reduceItemlessAttackRestrictions(
    mergeOnHitRiders(compileEffect(effect), riders, (actionFeature ?? ownerFeature).id)
  )
  const { invocation } = compiled
  // A passive "when reduced to 0 hit points" save effect runs as the save action the System fires
  // for its holder, so it compiles and plans like any other area save. A passive start-of-turn
  // effect runs as the activated self-action the System fires for its holder.
  if (invocation.kind !== 'PASSIVE') return compiled
  if (invocation.triggerCode === 'HP_ZERO')
    return {
      ...compiled,
      invocation: {
        ...invocation,
        kind: 'ACTION',
        triggerCode: 'SAVING_THROW',
        activation: { code: 'ACTION', amount: 1 }
      }
    }
  return invocation.triggerCode === 'START_OF_TURN'
    ? {
        ...compiled,
        entries: compiled.entries.map((entry) => ({ ...entry, pathCode: 'ON_USE' as const })),
        invocation: {
          ...invocation,
          kind: 'ACTION',
          triggerCode: 'ACTIVATED',
          activation: { code: 'ACTION', amount: 1 }
        }
      }
    : compiled
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

/** The System bindings of one compiled Effect, shared by every action source. */
export function bindEncounterEffect(input: EncounterEffectCompilerInput) {
  return bindEffect(encounterFeatureActionCapabilityRegistry.require(input.gameSystemId), input)
}

export function discoverUncompiledEncounterFeatureActions(input: {
  actor: EncounterProjectionActorInput
  conditionDefinitionIds?: readonly string[]
  abilityDefinitions?: readonly { id: string; code: string }[]
  /**
   * The Run's pinned Spells (D163) the Creature's spell grants name. Required so a caller that
   * misses it is a type error, not a Creature that silently casts nothing; a caller that needs
   * no casts passes an empty map.
   */
  spells: ReadonlyMap<string, CompiledSpell>
}): EncounterFeatureActionDiscovery {
  if (input.actor.kind === 'CUSTOM' || input.actor.kind === 'CHARACTER')
    return {
      available: [],
      unavailable: [],
      passiveZoneCapabilities: [],
      passiveDamageGrantCapabilities: [],
      passiveHpZeroCapabilities: [],
      passiveWeaponHitCapabilities: [],
      passiveStartOfTurnCapabilities: [],
      passiveStandingCapabilities: []
    }
  const provenance = snapshotProvenance(input.actor)
  const gameSystemId = requireCanonicalUuid(input.actor.systemId!, 'Creature Game System identity')
  const adapter = encounterFeatureActionCapabilityRegistry.require(gameSystemId)
  const available: EncounterFeatureActionCapabilityDescriptor[] = []
  const unavailable: EncounterFeatureActionUnavailable[] = []
  const passiveZoneCapabilities: EncounterFeatureActionCapabilityDescriptor[] = []
  const passiveDamageGrantCapabilities: EncounterFeatureActionCapabilityDescriptor[] = []
  const passiveHpZeroCapabilities: EncounterFeatureActionCapabilityDescriptor[] = []
  const passiveWeaponHitCapabilities: EncounterFeatureActionCapabilityDescriptor[] = []
  const passiveStartOfTurnCapabilities: EncounterFeatureActionCapabilityDescriptor[] = []
  const passiveStandingCapabilities: EncounterFeatureActionCapabilityDescriptor[] = []
  const actionIds = new Set<string>()
  const profile = attackProfileCapabilityRegistry.require(gameSystemId)
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
      // A granted spell cast is offered once per spell it can cast, with the pinned Spells below.
      if (effect.grantedSpellCast) continue
      const effectId = requireCanonicalUuid(effect.id, 'Creature feature Effect identity')
      const passive = effect.invocation.kind === 'PASSIVE'
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
        const compiledEffect = creatureActionEffect(profile, entry, features)
        const damageGrant = passive && compiledEffect.invocation.triggerCode === 'INCOMING_DAMAGE'
        const hpZero = passive && effect.invocation.triggerCode === 'HP_ZERO'
        const weaponHit = passive && effect.invocation.triggerCode === 'INCOMING_WEAPON_HIT'
        const startOfTurn = passive && effect.invocation.triggerCode === 'START_OF_TURN'
        const standing = standingEffectReturnsOn(compiledEffect) !== null
        if (
          passive &&
          !standing &&
          !damageGrant &&
          !hpZero &&
          !weaponHit &&
          !startOfTurn &&
          !placedSpaceManifest(compiledEffect) &&
          !passiveMeleeRetaliationZone(compiledEffect, label, profile.attackKind)
        )
          continue
        const equipmentBinding = entryEquipmentBinding(input.actor, entry, compiledEffect)
        const normalized = bindEffect(adapter, {
          gameSystemId,
          compiledEffect,
          conditionDefinitionIds: input.conditionDefinitionIds ?? [],
          abilityDefinitions: input.abilityDefinitions ?? []
        })
        if (normalized === null) continue
        ;(standing
          ? passiveStandingCapabilities
          : damageGrant
            ? passiveDamageGrantCapabilities
            : hpZero
              ? passiveHpZeroCapabilities
              : weaponHit
                ? passiveWeaponHitCapabilities
                : startOfTurn
                  ? passiveStartOfTurnCapabilities
                  : passive
                    ? passiveZoneCapabilities
                    : available
        ).push({
          kind: 'ENCOUNTER_FEATURE',
          gameSystemId,
          authoredRootKind: 'effect',
          entryPointDefinitionId: effectId,
          effectId,
          actionId: exactActionId,
          label,
          grip: effect.grip ?? null,
          spellCast: effect.spellCast ?? null,
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
          spellSlotUse: null,
          spellSaveDc: null,
          equipmentBinding,
          attackMechanic: featureAttackMechanic(
            profile,
            input.actor,
            entry,
            compiledEffect,
            equipmentBinding
          ),
          ...provenance
        })
      } catch (error) {
        if (passive) continue
        unavailable.push({
          actionId: exactActionId,
          ownerFeatureId,
          label,
          reason: error instanceof Error ? error.message : 'Its authored mechanics are invalid.'
        })
      }
    }
  }
  for (const action of creatureSpellCastActions({
    profile,
    actor: input.actor,
    features,
    spells: input.spells
  })) {
    if (actionIds.has(action.actionId))
      throw new Error(
        'Encounter feature capability discovery produced a duplicate action identity.'
      )
    actionIds.add(action.actionId)
    if ('reason' in action) {
      unavailable.push(action)
      continue
    }
    const { compiledEffect, ownerFeature, featureOption } = action
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
      entryPointDefinitionId: compiledEffect.id,
      effectId: compiledEffect.id,
      actionId: action.actionId,
      label: action.label,
      grip: null,
      spellCast: { castLevel: action.castLevel },
      spellCastLevel: action.castLevel,
      sourceId: ownerFeature.id,
      mechanicFacts: normalizeCharacterActionMechanicFacts(compiledEffect),
      conditionDefinitionIds:
        normalized.conditionDefinitionIds ?? input.conditionDefinitionIds ?? [],
      savingThrowAbilityDefinitionId: normalized.savingThrowAbilityDefinitionId ?? null,
      compiledEffect,
      encounterActorId: input.actor.id,
      ownerFeatureId: ownerFeature.id,
      featureOptionId: featureOption?.id ?? null,
      actionFeatureId: null,
      ownerRuleDefinitionIds: ownerFeature.ruleDefinitionIds ?? [],
      optionRuleDefinitionIds: featureOption?.ruleDefinitionIds ?? [],
      authoredEffectChecksum: checksumRuleDocument(compiledEffect),
      compiledEffectChecksum: checksumRuleDocument(compiledEffect),
      featureResourceUse: action.featureResourceUse,
      spellSlotUse: action.spellSlotUse,
      equipmentBinding: null,
      attackMechanic: action.attackMechanic,
      spellSaveDc: action.spellSaveDc,
      ...provenance
    })
  }
  return {
    available,
    unavailable,
    passiveZoneCapabilities,
    passiveDamageGrantCapabilities,
    passiveHpZeroCapabilities,
    passiveWeaponHitCapabilities,
    passiveStartOfTurnCapabilities,
    passiveStandingCapabilities
  }
}

/** The action mechanic of an authored Effect action: a Creature Feature's or an authored basic action's. */
export function featureActionMechanic(
  capability: EffectActionCapabilityDescriptor & {
    attackMechanic?: { attackBonus: number; damageBonus?: number; rollMode: string } | null
    spellSaveDc?: number | null
    /** The dice a damage outcome resolves to, by outcome id, when a cast froze it (D166). */
    damageExpressions?: Readonly<Record<string, string>>
  }
): Readonly<Record<string, unknown>> {
  const invocation = capability.mechanicFacts.invocation
  const savingThrow = invocation.savingThrow
  const attackKind = attackProfileCapabilityRegistry
    .require(capability.gameSystemId)
    .attackKind(invocation.triggerCode)
  const dc =
    savingThrow?.dcMethod === 'FIXED_DC'
      ? savingThrow.baseDc
      : savingThrow?.dcMethod === 'SOURCE_SAVE_DC'
        ? capability.spellSaveDc
        : null
  const save =
    Number.isSafeInteger(dc) && capability.savingThrowAbilityDefinitionId
      ? { abilityDefinitionId: capability.savingThrowAbilityDefinitionId, dc }
      : null
  const firstDamageOutcome = capability.mechanicFacts.outcomes.find(
    (outcome) => outcome.kind === 'DAMAGE'
  )
  const weaponDamageBonus = capability.attackMechanic?.damageBonus ?? 0
  return {
    effectId: capability.effectId,
    ...(capability.spellCastLevel === undefined
      ? {}
      : { spellCastLevel: capability.spellCastLevel }),
    trigger: invocation.triggerCode,
    activation: invocation.activation,
    attackBonus: capability.attackMechanic?.attackBonus ?? null,
    attackRollMode: capability.attackMechanic?.rollMode ?? null,
    attackKind,
    save,
    outcomes: capability.mechanicFacts.outcomes.map((outcome) => {
      const diceExpression =
        outcome.kind === 'DAMAGE' && outcome.outcomeId !== undefined
          ? capability.damageExpressions?.[outcome.outcomeId]
          : undefined
      if (diceExpression !== undefined) return { ...outcome, diceExpression }
      // The bound weapon's damage bonus joins the attack's first damage, as a Character's does.
      return outcome === firstDamageOutcome && weaponDamageBonus !== 0
        ? { ...outcome, damageBonus: weaponDamageBonus }
        : outcome
    })
  }
}
