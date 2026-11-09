import type { GameSystemPolicyTier } from '../../../platformPolicyModules.js'
import type { SystemTierModule } from '../../../systemCapabilityRegistry.js'
import * as dnd5e from '../../../systems/dnd5e/policyTier.js'
import * as tracer from '../policyTier.js'

type _TracerPolicyTier = SystemTierModule<typeof import('../policyTier.js'), GameSystemPolicyTier>

export const installedPolicyModules = [
  { gameSystemId: dnd5e.gameSystemId, policyModules: dnd5e.policyModules },
  { gameSystemId: tracer.gameSystemId, policyModules: tracer.policyModules }
]
export const installedAbilityScores = [dnd5e.abilityScore, tracer.abilityScore]
export const installedActionEconomies = [dnd5e.actionEconomy, tracer.actionEconomy]
export const installedAttackRestrictions = [dnd5e.attackRestriction]
export const installedCharacterActions = [dnd5e.characterAction]
export const installedCharacterProgressions = [dnd5e.characterProgression]
export const installedCombatPerceptions = [dnd5e.combatPerception]
export const installedCreatureConditions = [dnd5e.creatureCondition]
export const installedEventVocabularies = [dnd5e.eventVocabulary, tracer.eventVocabulary]
export const installedMaintenanceLinks = [dnd5e.maintenanceLink, tracer.maintenanceLink]
export const installedRollModes = [dnd5e.rollMode, tracer.rollMode]
export const installedSavingThrows = [dnd5e.savingThrow]
export const installedSpellCasts = [dnd5e.spellCast]
