import type { GameSystemEncounterTier } from '../../platformEncounterPolicy.js'
import type { SystemTierModule } from '../../systemCapabilityRegistry.js'
import * as dnd5e from '../dnd5e/encounterTier.js'

/** The installed Systems' Encounter-only tier (D195), one list per capability (ADR 0042). */
type _Dnd5eEncounterTier = SystemTierModule<
  typeof import('../dnd5e/encounterTier.js'),
  Required<GameSystemEncounterTier>
>

export const installedEncounterActorPolicies = [
  { gameSystemId: dnd5e.gameSystemId, evaluateEncounterActors: dnd5e.evaluateEncounterActors }
]
export const installedAttackProfiles = [dnd5e.attackProfile]
export const installedCharacterRuleActions = [dnd5e.characterRuleAction]
export const installedContestChecks = [dnd5e.contestCheck]
export const installedD20TestDefinitions = [dnd5e.d20TestDefinition]
export const installedEncounterFeatureActions = [dnd5e.encounterFeatureAction]
export const installedExecutionOutcomes = [dnd5e.executionOutcome]
export const installedInitiatives = [dnd5e.initiative]
export const installedLegendaryActionEligibilities = [dnd5e.legendaryActionEligibility]
export const installedModifierScopes = [dnd5e.modifierScope]
export const installedMovementReactionEligibilities = [dnd5e.movementReactionEligibility]
export const installedOptionalCombatPolicies = [dnd5e.optionalCombatPolicy]
export const installedSceneGridPolicies = [dnd5e.sceneGridPolicy]
