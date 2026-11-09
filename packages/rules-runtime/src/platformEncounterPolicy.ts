import type {
  EncounterActorRuleInput,
  EncounterActorRuleOutput
} from '@artificer-toolkit/schema/api/encounterActorRules'

import type { CharacterRuleActionSystemAdapter } from './characterRuleActionSystemAdapter.js'
import type { AttackProfileCapabilityAdapter } from './attackProfileCapability.js'
import type { ContestCheckCapabilityAdapter } from './contestCheckCapability.js'
import type { D20TestDefinitionCapabilityAdapter } from './d20TestDefinitionCapability.js'
import type { EncounterFeatureActionCapabilityAdapter } from './encounterFeatureActionCapabilityDiscovery.js'
import type { ExecutionOutcomeCapabilityAdapter } from './executionOutcomeCapability.js'
import type { InitiativeFactAdapter } from './initiativeFactAdapter.js'
import type { LegendaryActionEligibilityAdapter } from './legendaryActionEligibilityService.js'
import type { ModifierScopeCapabilityAdapter } from './modifierScopeCapability.js'
import type { MovementReactionEligibilityAdapter } from './movementReactionEligibilityService.js'
import type { OptionalCombatPolicyCapabilityAdapter } from './optionalCombatPolicyCapability.js'
import type { EncounterSceneGridPolicyAdapter } from './sceneGridPolicy.js'
import { createSystemCapabilityRegistry } from './systemCapabilityRegistry.js'
import {
  installedAttackProfiles,
  installedCharacterRuleActions,
  installedContestChecks,
  installedD20TestDefinitions,
  installedEncounterActorPolicies,
  installedEncounterFeatureActions,
  installedExecutionOutcomes,
  installedInitiatives,
  installedLegendaryActionEligibilities,
  installedModifierScopes,
  installedMovementReactionEligibilities,
  installedOptionalCombatPolicies,
  installedSceneGridPolicies
} from './systems/installedGameSystems/encounter.js'

/**
 * One installed System's Encounter-only tier (D195), installed here rather than in the
 * Sheet-reachable `platformPolicyModules`. A System leaves out a capability it does not have:
 * `require` then fails closed and `find` skips it.
 */
export interface GameSystemEncounterTier {
  readonly gameSystemId: string
  readonly evaluateEncounterActors?: (facts: EncounterActorRuleInput) => EncounterActorRuleOutput
  readonly attackProfile?: AttackProfileCapabilityAdapter
  readonly characterRuleAction?: CharacterRuleActionSystemAdapter
  readonly contestCheck?: ContestCheckCapabilityAdapter
  readonly d20TestDefinition?: D20TestDefinitionCapabilityAdapter
  readonly encounterFeatureAction?: EncounterFeatureActionCapabilityAdapter
  readonly executionOutcome?: ExecutionOutcomeCapabilityAdapter
  readonly initiative?: InitiativeFactAdapter
  readonly legendaryActionEligibility?: LegendaryActionEligibilityAdapter
  readonly modifierScope?: ModifierScopeCapabilityAdapter
  readonly movementReactionEligibility?: MovementReactionEligibilityAdapter
  readonly optionalCombatPolicy?: OptionalCombatPolicyCapabilityAdapter
  readonly sceneGridPolicy?: EncounterSceneGridPolicyAdapter
}

export const initiativeCapabilityRegistry =
  /* @__PURE__ */ createSystemCapabilityRegistry<InitiativeFactAdapter>(
    'initiative',
    installedInitiatives
  )

export const d20TestDefinitionCapabilityRegistry =
  /* @__PURE__ */ createSystemCapabilityRegistry<D20TestDefinitionCapabilityAdapter>(
    'd20-test-definition',
    installedD20TestDefinitions
  )

export const contestCheckCapabilityRegistry =
  /* @__PURE__ */ createSystemCapabilityRegistry<ContestCheckCapabilityAdapter>(
    'contest-check',
    installedContestChecks
  )

export const attackProfileCapabilityRegistry =
  /* @__PURE__ */ createSystemCapabilityRegistry<AttackProfileCapabilityAdapter>(
    'attack-profile',
    installedAttackProfiles
  )

export const modifierScopeCapabilityRegistry =
  /* @__PURE__ */ createSystemCapabilityRegistry<ModifierScopeCapabilityAdapter>(
    'modifier-scope',
    installedModifierScopes
  )

export const characterRuleActionSystemAdapterRegistry =
  /* @__PURE__ */ createSystemCapabilityRegistry<CharacterRuleActionSystemAdapter>(
    'character-rule-action',
    installedCharacterRuleActions
  )

export const encounterFeatureActionCapabilityRegistry =
  /* @__PURE__ */ createSystemCapabilityRegistry<EncounterFeatureActionCapabilityAdapter>(
    'encounter-feature-action',
    installedEncounterFeatureActions
  )

export const executionOutcomeCapabilityRegistry =
  /* @__PURE__ */ createSystemCapabilityRegistry<ExecutionOutcomeCapabilityAdapter>(
    'execution-outcome',
    installedExecutionOutcomes
  )

export const legendaryActionEligibilityCapabilityRegistry =
  /* @__PURE__ */ createSystemCapabilityRegistry<LegendaryActionEligibilityAdapter>(
    'legendary-action',
    installedLegendaryActionEligibilities
  )

export const movementReactionEligibilityCapabilityRegistry =
  /* @__PURE__ */ createSystemCapabilityRegistry<MovementReactionEligibilityAdapter>(
    'movement-reaction',
    installedMovementReactionEligibilities
  )

/** A System's Scene-grid policy is optional: without one an Encounter plays on its Scene's grid. */
export const sceneGridPolicyCapabilityRegistry =
  /* @__PURE__ */ createSystemCapabilityRegistry<EncounterSceneGridPolicyAdapter>(
    'scene-grid',
    installedSceneGridPolicies
  )

/**
 * Optional combat rules are opt-in per Encounter: a System without them offers no Cleaving choice
 * (`find`), while a sealed passage choice requires the policy that proposed it (`require`).
 */
export const optionalCombatPolicyCapabilityRegistry =
  /* @__PURE__ */ createSystemCapabilityRegistry<OptionalCombatPolicyCapabilityAdapter>(
    'optional-combat',
    installedOptionalCombatPolicies
  )
/** System-owned semantic preparation; generic Encounter application owns reconciliation. */
export function evaluateInstalledEncounterActors(input: {
  gameSystemId: string
  facts: EncounterActorRuleInput
}): EncounterActorRuleOutput {
  const registration = installedEncounterActorPolicies.find(
    (module) => module.gameSystemId === input.gameSystemId
  )
  if (!registration?.evaluateEncounterActors) {
    throw new Error(
      `No Encounter actor policy is registered for Game System "${input.gameSystemId}".`
    )
  }
  return registration.evaluateEncounterActors(input.facts)
}
