import type { GameSystemEncounterTier } from '../../../platformEncounterPolicy.js'
import type { SystemTierModule } from '../../../systemCapabilityRegistry.js'
import * as dnd5e from '../../../systems/dnd5e/encounterTier.js'
import * as tracer from '../encounterTier.js'

type _TracerEncounterTier = SystemTierModule<
  typeof import('../encounterTier.js'),
  GameSystemEncounterTier
>

export const installedEncounterActorPolicies = [
  { gameSystemId: dnd5e.gameSystemId, evaluateEncounterActors: dnd5e.evaluateEncounterActors },
  { gameSystemId: tracer.gameSystemId, evaluateEncounterActors: tracer.evaluateEncounterActors }
]
export const installedAttackProfiles = [dnd5e.attackProfile]
export const installedCharacterRuleActions = [dnd5e.characterRuleAction]
export const installedContestChecks = [dnd5e.contestCheck]
export const installedD20TestDefinitions = [dnd5e.d20TestDefinition, tracer.d20TestDefinition]
export const installedEncounterFeatureActions = [dnd5e.encounterFeatureAction]
export const installedExecutionOutcomes = [dnd5e.executionOutcome]
export const installedInitiatives = [dnd5e.initiative, tracer.initiative]
export const installedLegendaryActionEligibilities = [dnd5e.legendaryActionEligibility]
export const installedModifierScopes = [dnd5e.modifierScope, tracer.modifierScope]
export const installedMovementReactionEligibilities = [dnd5e.movementReactionEligibility]
export const installedOptionalCombatPolicies = [dnd5e.optionalCombatPolicy]
export const installedSceneGridPolicies = [dnd5e.sceneGridPolicy]
