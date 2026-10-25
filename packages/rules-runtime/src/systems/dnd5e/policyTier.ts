import type { GameSystemPolicyTier } from '../../platformPolicyModules.js'
import { dnd5eAbilityScoreCapabilityAdapter } from './abilityModifier.js'
import { dnd5eActionEconomyCapabilityAdapter } from './actionEconomyPolicy.js'
import {
  DND5E_SYSTEM_ID,
  dnd5eCharacterActionCapabilityAdapter
} from './characterActionCapabilityDiscovery.js'
import { dnd5eCombatPerceptionCapabilityAdapter } from './combatPerception.js'
import { dnd5eMaintenanceLinkCapabilityAdapter } from './concentrationPolicy.js'
import { dnd5eEventVocabularyCapabilityAdapter } from './eventVocabulary.js'
import { dnd5eCharacterProgressionCapabilityAdapter } from './hitPointRules.js'
import { dnd5eCreatureConditionCapabilityAdapter } from './identity.js'
import { dnd5ePolicyModuleRegistration } from './policyModuleRegistration.js'
import { dnd5eRollModeCapabilityAdapter } from './rollModePolicy.js'
import { dnd5eSavingThrowCapabilityAdapter } from './savingThrowPolicy.js'

/** D&D 5e's Sheet-reachable policy tier (D195). */
export const dnd5ePolicyTier: GameSystemPolicyTier = {
  gameSystemId: DND5E_SYSTEM_ID,
  abilityScore: dnd5eAbilityScoreCapabilityAdapter,
  actionEconomy: dnd5eActionEconomyCapabilityAdapter,
  characterAction: dnd5eCharacterActionCapabilityAdapter,
  characterProgression: dnd5eCharacterProgressionCapabilityAdapter,
  combatPerception: dnd5eCombatPerceptionCapabilityAdapter,
  creatureCondition: dnd5eCreatureConditionCapabilityAdapter,
  eventVocabulary: dnd5eEventVocabularyCapabilityAdapter,
  maintenanceLink: dnd5eMaintenanceLinkCapabilityAdapter,
  rollMode: dnd5eRollModeCapabilityAdapter,
  savingThrow: dnd5eSavingThrowCapabilityAdapter,
  policyModules: dnd5ePolicyModuleRegistration.policyModules
}
