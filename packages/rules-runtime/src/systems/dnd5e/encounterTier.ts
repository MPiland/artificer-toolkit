import type { GameSystemEncounterTier } from '../../platformEncounterPolicy.js'
import { dnd5eAttackProfileCapabilityAdapter } from './attackDamageDefenses.js'
import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'
import { dnd5eArmorClassCapabilityAdapter } from './characterVitals.js'
import { dnd5eCharacterRuleActionSystemAdapter } from './effectActionCompiler.js'
import { evaluateDnd5e2014EncounterActors } from './encounterActorPolicy.js'
import { dnd5eEncounterFeatureActionCapabilityAdapter } from './encounterFeatureActionCapabilityDiscovery.js'
import {
  dnd5eD20TestDefinitionCapabilityAdapter,
  dnd5eLegendaryActionEligibilityAdapter
} from './encounterLifecyclePolicy.js'
import { dnd5eExecutionOutcomeCapabilityAdapter } from './executionOutcomes.js'
import { dnd5eInitiativeFactAdapter } from './initiativeFactAdapter.js'
import { dnd5eModifierScopeCapabilityAdapter } from './modifierApplicability.js'
import { dnd5eContestCheckCapabilityAdapter } from './optionalCombatContestGraph.js'
import { dnd5eEncounterSceneGridPolicyAdapter } from './optionalCombatPolicy.js'
import { dnd5eOptionalCombatPolicyCapabilityAdapter } from './optionalResolutionPolicy.js'
import { dnd5eMovementReactionEligibilityAdapter } from './reactionEligibilityPolicy.js'

/** D&D 5e's Encounter-only tier (D195), kept out of the Sheet (ADR 0036 S6). */
export const dnd5eEncounterTier: GameSystemEncounterTier = {
  gameSystemId: DND5E_SYSTEM_ID,
  evaluateEncounterActors: evaluateDnd5e2014EncounterActors,
  armorClass: dnd5eArmorClassCapabilityAdapter,
  attackProfile: dnd5eAttackProfileCapabilityAdapter,
  characterRuleAction: dnd5eCharacterRuleActionSystemAdapter,
  contestCheck: dnd5eContestCheckCapabilityAdapter,
  d20TestDefinition: dnd5eD20TestDefinitionCapabilityAdapter,
  encounterFeatureAction: dnd5eEncounterFeatureActionCapabilityAdapter,
  executionOutcome: dnd5eExecutionOutcomeCapabilityAdapter,
  initiative: dnd5eInitiativeFactAdapter,
  legendaryActionEligibility: dnd5eLegendaryActionEligibilityAdapter,
  modifierScope: dnd5eModifierScopeCapabilityAdapter,
  movementReactionEligibility: dnd5eMovementReactionEligibilityAdapter,
  optionalCombatPolicy: dnd5eOptionalCombatPolicyCapabilityAdapter,
  sceneGridPolicy: dnd5eEncounterSceneGridPolicyAdapter
}
