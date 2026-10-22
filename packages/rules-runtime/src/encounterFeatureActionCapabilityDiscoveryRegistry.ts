import {
  compiledActionZonePlacementSchema,
  type CompiledActionZonePlacement
} from '@artificer-toolkit/schema/projections/characterMechanics'

import type { EffectActionCapabilityDescriptor } from './characterActionCapabilityDiscovery.js'
import {
  CharacterRuleActionUnsupportedCompilationError,
  type CharacterRuleActionActiveEffectPlan,
  type CharacterRuleActionExecutionPlan,
  type CharacterRuleActionSystemAdapter
} from './characterRuleActionSystemAdapter.js'
import { compileEncounterFeatureActionPlan } from './encounterActionEntryPointCompiler.js'
import {
  discoverUncompiledEncounterFeatureActions,
  type EncounterFeatureActionCapabilityDescriptor,
  type EncounterFeatureActionDiscovery
} from './encounterFeatureActionCapabilityDiscovery.js'
import { characterRuleActionSystemAdapterRegistry } from './platformEncounterPolicy.js'

/** A zone a Creature's passive feature keeps around it while it is in the Encounter (D144). */
export interface EncounterPassiveZone {
  capability: EncounterFeatureActionCapabilityDescriptor
  zone: CompiledActionZonePlacement
}

/** A timed grant a Creature's passive feature gives it when it takes damage of the named types. */
export interface EncounterPassiveDamageGrant {
  capability: EncounterFeatureActionCapabilityDescriptor
  damageTypeIds: readonly string[]
  plan: CharacterRuleActionActiveEffectPlan
}

/** An effect a Creature's passive feature runs where it stands when it is reduced to 0 hit points. */
export interface EncounterPassiveHpZeroEffect {
  capability: EncounterFeatureActionCapabilityDescriptor
  plan: CharacterRuleActionExecutionPlan
}

/** An effect a Creature's passive feature runs on itself at the start of its turn. */
export interface EncounterPassiveStartOfTurnEffect {
  capability: EncounterFeatureActionCapabilityDescriptor
}

/** A passive feature that wears down the weapon of whoever hits its Creature with one. */
export interface EncounterPassiveWeaponHit {
  capability: EncounterFeatureActionCapabilityDescriptor
}

/**
 * Every action of a Creature: the ones it can take, and the unavailable ones with their reason,
 * with the zones its passive features keep around it. An action or passive zone whose shape its
 * System cannot execute is unavailable too, so no caller offers or places it.
 */
export function discoverEncounterFeatureActions(
  input: Parameters<typeof discoverUncompiledEncounterFeatureActions>[0]
): Omit<
  EncounterFeatureActionDiscovery,
  | 'passiveZoneCapabilities'
  | 'passiveDamageGrantCapabilities'
  | 'passiveHpZeroCapabilities'
  | 'passiveWeaponHitCapabilities'
  | 'passiveStartOfTurnCapabilities'
> & {
  passiveZones: readonly EncounterPassiveZone[]
  passiveDamageGrants: readonly EncounterPassiveDamageGrant[]
  passiveHpZeroEffects: readonly EncounterPassiveHpZeroEffect[]
  passiveWeaponHits: readonly EncounterPassiveWeaponHit[]
  passiveStartOfTurnEffects: readonly EncounterPassiveStartOfTurnEffect[]
} {
  const discovered = discoverUncompiledEncounterFeatureActions(input)
  const available: EncounterFeatureActionCapabilityDescriptor[] = []
  const passiveZones: EncounterPassiveZone[] = []
  const passiveDamageGrants: EncounterPassiveDamageGrant[] = []
  const passiveHpZeroEffects: EncounterPassiveHpZeroEffect[] = []
  const passiveWeaponHits: EncounterPassiveWeaponHit[] = []
  const passiveStartOfTurnEffects: EncounterPassiveStartOfTurnEffect[] = []
  const unavailable = [...discovered.unavailable]
  const compiles = (
    capability: EncounterFeatureActionCapabilityDescriptor,
    compile: (adapter: CharacterRuleActionSystemAdapter) => void
  ) => {
    const adapter = characterRuleActionSystemAdapterRegistry.require(capability.gameSystemId)
    try {
      compile(adapter)
    } catch (error) {
      if (!(error instanceof CharacterRuleActionUnsupportedCompilationError)) throw error
      unavailable.push({
        actionId: capability.actionId,
        ownerFeatureId: capability.ownerFeatureId,
        label: capability.label,
        reason: error.message
      })
    }
  }
  for (const capability of discovered.available)
    compiles(capability, (adapter) => {
      compileEncounterFeatureActionPlan(adapter, capability)
      available.push(capability)
    })
  for (const capability of discovered.passiveZoneCapabilities)
    compiles(capability, (adapter) => {
      passiveZones.push({ capability, zone: compilePassiveZone(adapter, capability) })
    })
  for (const capability of discovered.passiveDamageGrantCapabilities)
    compiles(capability, (adapter) => {
      passiveDamageGrants.push(compilePassiveDamageGrant(adapter, capability))
    })
  for (const capability of discovered.passiveHpZeroCapabilities)
    compiles(capability, (adapter) => {
      passiveHpZeroEffects.push({
        capability,
        plan: compileEncounterFeatureActionPlan(adapter, capability)
      })
    })
  for (const capability of discovered.passiveWeaponHitCapabilities)
    compiles(capability, () => {
      assertWeaponHitDegradationOnly(capability)
      passiveWeaponHits.push({ capability })
    })
  for (const capability of discovered.passiveStartOfTurnCapabilities)
    compiles(capability, (adapter) => {
      assertStartOfTurnHealOnly(capability)
      compileEncounterFeatureActionPlan(adapter, capability)
      passiveStartOfTurnEffects.push({ capability })
    })
  return {
    available,
    unavailable,
    passiveZones,
    passiveDamageGrants,
    passiveHpZeroEffects,
    passiveWeaponHits,
    passiveStartOfTurnEffects
  }
}

/**
 * The one zone a Creature's or Character's passive feature keeps (D144, D155); a feature with no
 * zone, or one picked at cast time, throws the unsupported-compilation error.
 */
export function compilePassiveZone(
  adapter: CharacterRuleActionSystemAdapter,
  capability: EffectActionCapabilityDescriptor & { label?: string }
): CompiledActionZonePlacement {
  const zone = adapter.compileZonePlacement?.({
    action: capability,
    ...(capability.label ? { label: capability.label } : {})
  })
  if (!zone || 'options' in zone)
    throw new CharacterRuleActionUnsupportedCompilationError(
      'A passive zone is one zone, with no cast-time choice.'
    )
  return compiledActionZonePlacementSchema.parse(zone)
}

/**
 * The timed grant a Creature's passive damage trigger gives (Flesh Golem's Aversion of Fire); a
 * feature whose System cannot execute it throws the unsupported-compilation error.
 */
export function compilePassiveDamageGrant(
  adapter: CharacterRuleActionSystemAdapter,
  capability: EncounterFeatureActionCapabilityDescriptor
): EncounterPassiveDamageGrant {
  const { invocation } = capability.compiledEffect
  const plan = adapter.passiveDamageGrantPlan?.({ action: capability })
  if (!plan || invocation.kind !== 'PASSIVE' || !('damageTypeIds' in invocation))
    throw new CharacterRuleActionUnsupportedCompilationError(
      'A passive damage trigger gives one timed grant for named damage types.'
    )
  return { capability, damageTypeIds: invocation.damageTypeIds, plan }
}

/** A weapon-hit passive answers with equipment degradation alone; any other outcome is unsupported. */
function assertWeaponHitDegradationOnly(capability: EffectActionCapabilityDescriptor) {
  const { entries } = capability.compiledEffect
  if (
    entries.length === 0 ||
    !entries.every(
      (entry) =>
        'outcome' in entry &&
        entry.pathCode === 'PASSIVE' &&
        entry.outcome.effectKind === 'DEGRADE_EQUIPMENT' &&
        entry.outcome.subject === 'ATTACKER_WEAPON'
    )
  )
    throw new CharacterRuleActionUnsupportedCompilationError(
      'A weapon-hit trigger degrades the attacker weapon and does nothing else.'
    )
}

/** A start-of-turn passive heals its holder and does nothing else; any other outcome is unsupported. */
function assertStartOfTurnHealOnly(capability: EffectActionCapabilityDescriptor) {
  const { entries } = capability.compiledEffect
  if (
    entries.length === 0 ||
    !entries.every((entry) => 'outcome' in entry && entry.outcome.effectKind === 'HEAL')
  )
    throw new CharacterRuleActionUnsupportedCompilationError(
      'A start-of-turn trigger heals its holder and does nothing else.'
    )
}

/** The actions a Creature can take; an action with invalid authored mechanics is left out. */
export function discoverEncounterFeatureActionCapabilities(
  input: Parameters<typeof discoverUncompiledEncounterFeatureActions>[0]
) {
  return discoverEncounterFeatureActions(input).available
}
