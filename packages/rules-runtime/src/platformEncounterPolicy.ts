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
import type { ExecutionOutcomeCapabilityAdapter } from './executionOutcomeCapability.js'
import type { InitiativeFactAdapter } from './initiativeFactAdapter.js'
import type { LegendaryActionEligibilityAdapter } from './legendaryActionEligibilityService.js'
import type { ModifierScopeCapabilityAdapter } from './modifierScopeCapability.js'
import type { MovementReactionEligibilityAdapter } from './movementReactionEligibilityService.js'
import type { OptionalCombatPolicyCapabilityAdapter } from './optionalCombatPolicyCapability.js'
import type { EncounterSceneGridPolicyAdapter } from './sceneGridPolicy.js'
import { createSystemCapabilityRegistry } from './systemCapabilityRegistry.js'
import { installedEncounterSystems } from './systems/installedGameSystems/encounter.js'

/**
 * One installed System's Encounter-only tier (D195), installed here rather than in the
 * Sheet-reachable `platformPolicyModules`. A System leaves out a capability it does not have:
 * `require` then fails closed and `find` skips it.
 */
export interface GameSystemEncounterTier {
  readonly gameSystemId: string
  readonly evaluateEncounterActors?: (facts: EncounterActorRuleInput) => EncounterActorRuleOutput
  readonly armorClass?: ArmorClassCapabilityAdapter
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

function installed<
  TCapability extends Exclude<
    keyof GameSystemEncounterTier,
    'gameSystemId' | 'evaluateEncounterActors'
  >
>(capability: TCapability) {
  return installedEncounterSystems.flatMap((system) => system[capability] ?? [])
}

export const initiativeCapabilityRegistry = createSystemCapabilityRegistry<InitiativeFactAdapter>(
  'initiative',
  installed('initiative')
)

export const armorClassCapabilityRegistry =
  createSystemCapabilityRegistry<ArmorClassCapabilityAdapter>(
    'armor-class',
    installed('armorClass')
  )

export const d20TestDefinitionCapabilityRegistry =
  createSystemCapabilityRegistry<D20TestDefinitionCapabilityAdapter>(
    'd20-test-definition',
    installed('d20TestDefinition')
  )

export const contestCheckCapabilityRegistry =
  createSystemCapabilityRegistry<ContestCheckCapabilityAdapter>(
    'contest-check',
    installed('contestCheck')
  )

export const attackProfileCapabilityRegistry =
  createSystemCapabilityRegistry<AttackProfileCapabilityAdapter>(
    'attack-profile',
    installed('attackProfile')
  )

export const modifierScopeCapabilityRegistry =
  createSystemCapabilityRegistry<ModifierScopeCapabilityAdapter>(
    'modifier-scope',
    installed('modifierScope')
  )

export const characterRuleActionSystemAdapterRegistry =
  createSystemCapabilityRegistry<CharacterRuleActionSystemAdapter>(
    'character-rule-action',
    installed('characterRuleAction')
  )

export const encounterFeatureActionCapabilityRegistry =
  createSystemCapabilityRegistry<EncounterFeatureActionCapabilityAdapter>(
    'encounter-feature-action',
    installed('encounterFeatureAction')
  )

export const executionOutcomeCapabilityRegistry =
  createSystemCapabilityRegistry<ExecutionOutcomeCapabilityAdapter>(
    'execution-outcome',
    installed('executionOutcome')
  )

export const legendaryActionEligibilityCapabilityRegistry =
  createSystemCapabilityRegistry<LegendaryActionEligibilityAdapter>(
    'legendary-action',
    installed('legendaryActionEligibility')
  )

export const movementReactionEligibilityCapabilityRegistry =
  createSystemCapabilityRegistry<MovementReactionEligibilityAdapter>(
    'movement-reaction',
    installed('movementReactionEligibility')
  )

/** A System's Scene-grid policy is optional: without one an Encounter plays on its Scene's grid. */
export const sceneGridPolicyCapabilityRegistry =
  createSystemCapabilityRegistry<EncounterSceneGridPolicyAdapter>(
    'scene-grid',
    installed('sceneGridPolicy')
  )

/**
 * Optional combat rules are opt-in per Encounter: a System without them offers no Cleaving choice
 * (`find`), while a sealed passage choice requires the policy that proposed it (`require`).
 */
export const optionalCombatPolicyCapabilityRegistry =
  createSystemCapabilityRegistry<OptionalCombatPolicyCapabilityAdapter>(
    'optional-combat',
    installed('optionalCombatPolicy')
  )
/** System-owned semantic preparation; generic Encounter application owns reconciliation. */
export function evaluateInstalledEncounterActors(input: {
  gameSystemId: string
  facts: EncounterActorRuleInput
}): EncounterActorRuleOutput {
  const registration = installedEncounterSystems.find(
    (module) => module.gameSystemId === input.gameSystemId
  )
  if (!registration?.evaluateEncounterActors) {
    throw new Error(
      `No Encounter actor policy is registered for Game System "${input.gameSystemId}".`
    )
  }
  return registration.evaluateEncounterActors(input.facts)
}
