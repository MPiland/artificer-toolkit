import type { AbilityScoreCapabilityAdapter } from './abilityScoreCapability.js'
import type { ActionEconomyCapabilityAdapter } from './actionEconomyCapabilityRegistry.js'
import type { CharacterActionCapabilityAdapter } from './characterActionCapabilityDiscovery.js'
import type { CharacterProgressionCapabilityAdapter } from './characterProgressionCapability.js'
import type { CombatPerceptionCapabilityAdapter } from './combatPerceptionCapabilityRegistry.js'
import type { CreatureConditionCapabilityAdapter } from './creatureConditionCapability.js'
import type { EventVocabularyCapabilityAdapter } from './events/encounterEventTable.js'
import type { MaintenanceLinkCapabilityAdapter } from './maintenanceLinkCapability.js'
import type { SavingThrowCapabilityAdapter } from './savingThrowCapability.js'
import { createRollModeCapabilityRegistry } from './rollModeCapabilityRegistry.js'
import { createSystemCapabilityRegistry } from './systemCapabilityRegistry.js'
import { dnd5eAbilityScoreCapabilityAdapter } from './systems/dnd5e/abilityModifier.js'
import { dnd5eActionEconomyCapabilityAdapter } from './systems/dnd5e/actionEconomyPolicy.js'
import { dnd5eCharacterActionCapabilityAdapter } from './systems/dnd5e/characterActionCapabilityDiscovery.js'
import { dnd5eMaintenanceLinkCapabilityAdapter } from './systems/dnd5e/concentrationPolicy.js'
import { dnd5eCombatPerceptionCapabilityAdapter } from './systems/dnd5e/combatPerception.js'
import { dnd5eEventVocabularyCapabilityAdapter } from './systems/dnd5e/eventVocabulary.js'
import { dnd5eCharacterProgressionCapabilityAdapter } from './systems/dnd5e/hitPointRules.js'
import { dnd5eCreatureConditionCapabilityAdapter } from './systems/dnd5e/identity.js'
import { dnd5ePolicyModuleRegistration } from './systems/dnd5e/policyModuleRegistration.js'
import { dnd5eRollModeCapabilityAdapter } from './systems/dnd5e/rollModePolicy.js'
import { dnd5eSavingThrowCapabilityAdapter } from './systems/dnd5e/savingThrowPolicy.js'
import { systemVocabularyRegistry } from './systemVocabulary.js'

const installedRuntimeModules = [dnd5ePolicyModuleRegistration] as const

export const rollModeCapabilityRegistry = createRollModeCapabilityRegistry(
  [dnd5eRollModeCapabilityAdapter],
  systemVocabularyRegistry
)

export const combatPerceptionCapabilityRegistry =
  createSystemCapabilityRegistry<CombatPerceptionCapabilityAdapter>('combat-perception', [
    dnd5eCombatPerceptionCapabilityAdapter
  ])

export const actionEconomyCapabilityRegistry =
  createSystemCapabilityRegistry<ActionEconomyCapabilityAdapter>('action-economy', [
    dnd5eActionEconomyCapabilityAdapter
  ])

export const abilityScoreCapabilityRegistry =
  createSystemCapabilityRegistry<AbilityScoreCapabilityAdapter>('ability-score', [
    dnd5eAbilityScoreCapabilityAdapter
  ])

export const characterProgressionCapabilityRegistry =
  createSystemCapabilityRegistry<CharacterProgressionCapabilityAdapter>('character-progression', [
    dnd5eCharacterProgressionCapabilityAdapter
  ])

export const creatureConditionCapabilityRegistry =
  createSystemCapabilityRegistry<CreatureConditionCapabilityAdapter>('creature-condition', [
    dnd5eCreatureConditionCapabilityAdapter
  ])

export const characterActionCapabilityRegistry =
  createSystemCapabilityRegistry<CharacterActionCapabilityAdapter>('character-action', [
    dnd5eCharacterActionCapabilityAdapter
  ])

export const eventVocabularyCapabilityRegistry =
  createSystemCapabilityRegistry<EventVocabularyCapabilityAdapter>('event-vocabulary', [
    dnd5eEventVocabularyCapabilityAdapter
  ])

export const maintenanceLinkCapabilityRegistry =
  createSystemCapabilityRegistry<MaintenanceLinkCapabilityAdapter>('maintenance-link', [
    dnd5eMaintenanceLinkCapabilityAdapter
  ])

export const savingThrowCapabilityRegistry =
  createSystemCapabilityRegistry<SavingThrowCapabilityAdapter>('saving-throw', [
    dnd5eSavingThrowCapabilityAdapter
  ])

export function requireInstalledGameSystemPolicyModule(input: {
  gameSystemId: string
  policyModule: { key: string; contractVersion: number }
}): void {
  const registration = installedRuntimeModules.find(
    (module) => module.gameSystemId === input.gameSystemId
  )
  if (
    !registration ||
    !registration.policyModules.some(
      (module) =>
        module.key === input.policyModule.key &&
        module.contractVersion === input.policyModule.contractVersion
    )
  ) {
    throw new Error(`No policy module is registered for Game System "${input.gameSystemId}".`)
  }
}
