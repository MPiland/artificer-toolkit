import type { GameSystemPolicyTier } from '../../platformPolicyModules.js'
import type { SystemTierModule } from '../../systemCapabilityRegistry.js'
import * as dnd5e from '../dnd5e/policyTier.js'

/** The installed Systems' Sheet-reachable policy tier (D195), one list per capability (ADR 0042). */
type _Dnd5ePolicyTier = SystemTierModule<
  typeof import('../dnd5e/policyTier.js'),
  Required<GameSystemPolicyTier>
>

export const installedPolicyModules = [
  { gameSystemId: dnd5e.gameSystemId, policyModules: dnd5e.policyModules }
]
export const installedAbilityScores = [dnd5e.abilityScore]
export const installedActionEconomies = [dnd5e.actionEconomy]
export const installedArmorClasses = [dnd5e.armorClass]
export const installedAttackRestrictions = [dnd5e.attackRestriction]
export const installedCharacterActions = [dnd5e.characterAction]
export const installedCharacterProgressions = [dnd5e.characterProgression]
export const installedCombatPerceptions = [dnd5e.combatPerception]
export const installedCreatureConditions = [dnd5e.creatureCondition]
export const installedEventVocabularies = [dnd5e.eventVocabulary]
export const installedMaintenanceLinks = [dnd5e.maintenanceLink]
export const installedRollModes = [dnd5e.rollMode]
export const installedSavingThrows = [dnd5e.savingThrow]
export const installedSpellCasts = [dnd5e.spellCast]
