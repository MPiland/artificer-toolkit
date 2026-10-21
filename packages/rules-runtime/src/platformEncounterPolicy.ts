import type {
  EncounterActorRuleInput,
  EncounterActorRuleOutput
} from '@artificer-toolkit/schema/api/encounterActorRules'

import type { ArmorClassCapabilityAdapter } from './armorClassCapability.js'
import type { CharacterRuleActionSystemAdapter } from './characterRuleActionSystemAdapter.js'
import type { AttackProfileCapabilityAdapter } from './attackProfileCapability.js'
import type { ContestCheckCapabilityAdapter } from './contestCheckCapability.js'
import type { D20TestDefinitionCapabilityAdapter } from './d20TestDefinitionCapability.js'
import type { EncounterFeatureActionCapabilityAdapter } from './encounterFeatureActionCapabilityDiscovery.js'
import type { InitiativeFactAdapter } from './initiativeFactAdapter.js'
import type { LegendaryActionEligibilityAdapter } from './legendaryActionEligibilityService.js'
import type { ModifierScopeCapabilityAdapter } from './modifierScopeCapability.js'
import type { MovementReactionEligibilityAdapter } from './movementReactionEligibilityService.js'
import type { OptionalCombatPolicyCapabilityAdapter } from './optionalCombatPolicyCapability.js'
import type { EncounterSceneGridPolicyAdapter } from './sceneGridPolicy.js'
import { createSystemCapabilityRegistry } from './systemCapabilityRegistry.js'
import { dnd5eAttackProfileCapabilityAdapter } from './systems/dnd5e/attackDamageDefenses.js'
import { dnd5eArmorClassCapabilityAdapter } from './systems/dnd5e/characterVitals.js'
import { dnd5eCharacterRuleActionSystemAdapter } from './systems/dnd5e/effectActionCompiler.js'
import { dnd5eEncounterActorPolicyRegistration } from './systems/dnd5e/encounterActorPolicy.js'
import { dnd5eEncounterFeatureActionCapabilityAdapter } from './systems/dnd5e/encounterFeatureActionCapabilityDiscovery.js'
import {
  dnd5eD20TestDefinitionCapabilityAdapter,
  dnd5eLegendaryActionEligibilityAdapter
} from './systems/dnd5e/encounterLifecyclePolicy.js'
import { dnd5eInitiativeFactAdapter } from './systems/dnd5e/initiativeFactAdapter.js'
import { dnd5eModifierScopeCapabilityAdapter } from './systems/dnd5e/modifierApplicability.js'
import { dnd5eContestCheckCapabilityAdapter } from './systems/dnd5e/optionalCombatContestGraph.js'
import { dnd5eEncounterSceneGridPolicyAdapter } from './systems/dnd5e/optionalCombatPolicy.js'
import { dnd5eOptionalCombatPolicyCapabilityAdapter } from './systems/dnd5e/optionalResolutionPolicy.js'
import { dnd5eMovementReactionEligibilityAdapter } from './systems/dnd5e/reactionEligibilityPolicy.js'

const installedRuntimeModules = [dnd5eEncounterActorPolicyRegistration] as const

// Encounter-only capabilities, so they are installed here rather than in the Sheet-reachable
// `platformPolicyModules`.
export const initiativeCapabilityRegistry = createSystemCapabilityRegistry<InitiativeFactAdapter>(
  'initiative',
  [dnd5eInitiativeFactAdapter]
)

export const armorClassCapabilityRegistry =
  createSystemCapabilityRegistry<ArmorClassCapabilityAdapter>('armor-class', [
    dnd5eArmorClassCapabilityAdapter
  ])

export const d20TestDefinitionCapabilityRegistry =
  createSystemCapabilityRegistry<D20TestDefinitionCapabilityAdapter>('d20-test-definition', [
    dnd5eD20TestDefinitionCapabilityAdapter
  ])

export const contestCheckCapabilityRegistry =
  createSystemCapabilityRegistry<ContestCheckCapabilityAdapter>('contest-check', [
    dnd5eContestCheckCapabilityAdapter
  ])

export const attackProfileCapabilityRegistry =
  createSystemCapabilityRegistry<AttackProfileCapabilityAdapter>('attack-profile', [
    dnd5eAttackProfileCapabilityAdapter
  ])

export const modifierScopeCapabilityRegistry =
  createSystemCapabilityRegistry<ModifierScopeCapabilityAdapter>('modifier-scope', [
    dnd5eModifierScopeCapabilityAdapter
  ])

export const characterRuleActionSystemAdapterRegistry =
  createSystemCapabilityRegistry<CharacterRuleActionSystemAdapter>('character-rule-action', [
    dnd5eCharacterRuleActionSystemAdapter
  ])

export const encounterFeatureActionCapabilityRegistry =
  createSystemCapabilityRegistry<EncounterFeatureActionCapabilityAdapter>(
    'encounter-feature-action',
    [dnd5eEncounterFeatureActionCapabilityAdapter]
  )

export const legendaryActionEligibilityCapabilityRegistry =
  createSystemCapabilityRegistry<LegendaryActionEligibilityAdapter>('legendary-action', [
    dnd5eLegendaryActionEligibilityAdapter
  ])

export const movementReactionEligibilityCapabilityRegistry =
  createSystemCapabilityRegistry<MovementReactionEligibilityAdapter>('movement-reaction', [
    dnd5eMovementReactionEligibilityAdapter
  ])

/** A System's Scene-grid policy is optional: without one an Encounter plays on its Scene's grid. */
export const sceneGridPolicyCapabilityRegistry =
  createSystemCapabilityRegistry<EncounterSceneGridPolicyAdapter>('scene-grid', [
    dnd5eEncounterSceneGridPolicyAdapter
  ])

/**
 * Optional combat rules are opt-in per Encounter: a System without them offers no Cleaving choice
 * (`find`), while a sealed passage choice requires the policy that proposed it (`require`).
 */
export const optionalCombatPolicyCapabilityRegistry =
  createSystemCapabilityRegistry<OptionalCombatPolicyCapabilityAdapter>('optional-combat', [
    dnd5eOptionalCombatPolicyCapabilityAdapter
  ])

/** System-owned semantic preparation; generic Encounter application owns reconciliation. */
export function evaluateInstalledEncounterActors(input: {
  gameSystemId: string
  facts: EncounterActorRuleInput
}): EncounterActorRuleOutput {
  const registration = installedRuntimeModules.find(
    (module) => module.gameSystemId === input.gameSystemId
  )
  if (!registration || !('evaluateEncounterActors' in registration)) {
    throw new Error(
      `No Encounter actor policy is registered for Game System "${input.gameSystemId}".`
    )
  }
  return registration.evaluateEncounterActors(input.facts)
}
