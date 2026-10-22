import type { AbilityScoreCapabilityAdapter } from './abilityScoreCapability.js'
import type { ActionEconomyCapabilityAdapter } from './actionEconomyCapabilityRegistry.js'
import type { CombatPerceptionCapabilityAdapter } from './combatPerceptionCapabilityRegistry.js'
import type { CreatureConditionCapabilityAdapter } from './creatureConditionCapability.js'
import type { EventVocabularyCapabilityAdapter } from './events/encounterEventTable.js'
import { createRollModeCapabilityRegistry } from './rollModeCapabilityRegistry.js'
import { createSystemCapabilityRegistry } from './systemCapabilityRegistry.js'
import { createSystemVocabularyRegistry } from './systemVocabularyCapability.js'
import { dnd5eAbilityScoreCapabilityAdapter } from './systems/dnd5e/abilityModifier.js'
import { dnd5eActionEconomyCapabilityAdapter } from './systems/dnd5e/actionEconomyPolicy.js'
import { dnd5eCombatPerceptionCapabilityAdapter } from './systems/dnd5e/combatPerception.js'
import { dnd5eEventVocabularyCapabilityAdapter } from './systems/dnd5e/eventVocabulary.js'
import { dnd5eCreatureConditionCapabilityAdapter } from './systems/dnd5e/identity.js'
import { dnd5ePolicyModuleRegistration } from './systems/dnd5e/policyModuleRegistration.js'
import { dnd5eRollModeCapabilityAdapter } from './systems/dnd5e/rollModePolicy.js'
import { dnd5eVocabularyCapabilityAdapter } from './systems/dnd5e/vocabulary.js'

const installedRuntimeModules = [dnd5ePolicyModuleRegistration] as const

export const systemVocabularyRegistry = createSystemVocabularyRegistry([
  dnd5eVocabularyCapabilityAdapter
])

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

export const creatureConditionCapabilityRegistry =
  createSystemCapabilityRegistry<CreatureConditionCapabilityAdapter>('creature-condition', [
    dnd5eCreatureConditionCapabilityAdapter
  ])

export const eventVocabularyCapabilityRegistry =
  createSystemCapabilityRegistry<EventVocabularyCapabilityAdapter>('event-vocabulary', [
    dnd5eEventVocabularyCapabilityAdapter
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
