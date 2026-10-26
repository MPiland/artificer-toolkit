import type { AbilityScoreCapabilityAdapter } from './abilityScoreCapability.js'
import type { ActionEconomyCapabilityAdapter } from './actionEconomyCapabilityRegistry.js'
import type { CharacterActionCapabilityAdapter } from './characterActionCapabilityDiscovery.js'
import type { CharacterProgressionCapabilityAdapter } from './characterProgressionCapability.js'
import type { CombatPerceptionCapabilityAdapter } from './combatPerceptionCapabilityRegistry.js'
import type { CreatureConditionCapabilityAdapter } from './creatureConditionCapability.js'
import type { EventVocabularyCapabilityAdapter } from './events/encounterEventTable.js'
import type { MaintenanceLinkCapabilityAdapter } from './maintenanceLinkCapability.js'
import type { SavingThrowCapabilityAdapter } from './savingThrowCapability.js'
import {
  createRollModeCapabilityRegistry,
  type RollModeCapabilityAdapter
} from './rollModeCapabilityRegistry.js'
import { createSystemCapabilityRegistry } from './systemCapabilityRegistry.js'
import { installedPolicySystems } from './systems/installedGameSystems/policy.js'
import { systemCoreCodeRegistry } from './platformSystemCoreCodes.js'
import { requireSceneIlluminationLevels } from '@artificer-toolkit/shared/vtt'

/**
 * One installed System's Sheet-reachable policy tier (D195). A System leaves out a capability it
 * does not have: `require` then fails closed and `find` skips it.
 */
export interface GameSystemPolicyTier {
  readonly gameSystemId: string
  readonly abilityScore?: AbilityScoreCapabilityAdapter
  readonly actionEconomy?: ActionEconomyCapabilityAdapter
  readonly characterAction?: CharacterActionCapabilityAdapter
  readonly characterProgression?: CharacterProgressionCapabilityAdapter
  readonly combatPerception?: CombatPerceptionCapabilityAdapter
  readonly creatureCondition?: CreatureConditionCapabilityAdapter
  readonly eventVocabulary?: EventVocabularyCapabilityAdapter
  readonly maintenanceLink?: MaintenanceLinkCapabilityAdapter
  readonly rollMode?: RollModeCapabilityAdapter
  readonly savingThrow?: SavingThrowCapabilityAdapter
  readonly policyModules: readonly { readonly key: string; readonly contractVersion: number }[]
}

function installed<
  TCapability extends Exclude<keyof GameSystemPolicyTier, 'gameSystemId' | 'policyModules'>
>(capability: TCapability) {
  return installedPolicySystems.flatMap((system) => system[capability] ?? [])
}

export const rollModeCapabilityRegistry = createRollModeCapabilityRegistry(
  installed('rollMode'),
  systemCoreCodeRegistry
)

export const combatPerceptionCapabilityRegistry =
  createSystemCapabilityRegistry<CombatPerceptionCapabilityAdapter>(
    'combat-perception',
    installed('combatPerception'),
    ({ illuminationLevels }) => requireSceneIlluminationLevels(illuminationLevels)
  )

export const actionEconomyCapabilityRegistry =
  createSystemCapabilityRegistry<ActionEconomyCapabilityAdapter>(
    'action-economy',
    installed('actionEconomy')
  )

export const abilityScoreCapabilityRegistry =
  createSystemCapabilityRegistry<AbilityScoreCapabilityAdapter>(
    'ability-score',
    installed('abilityScore')
  )

export const characterProgressionCapabilityRegistry =
  createSystemCapabilityRegistry<CharacterProgressionCapabilityAdapter>(
    'character-progression',
    installed('characterProgression')
  )

export const creatureConditionCapabilityRegistry =
  createSystemCapabilityRegistry<CreatureConditionCapabilityAdapter>(
    'creature-condition',
    installed('creatureCondition')
  )

export const characterActionCapabilityRegistry =
  createSystemCapabilityRegistry<CharacterActionCapabilityAdapter>(
    'character-action',
    installed('characterAction')
  )

export const eventVocabularyCapabilityRegistry =
  createSystemCapabilityRegistry<EventVocabularyCapabilityAdapter>(
    'event-vocabulary',
    installed('eventVocabulary')
  )

export const maintenanceLinkCapabilityRegistry =
  createSystemCapabilityRegistry<MaintenanceLinkCapabilityAdapter>(
    'maintenance-link',
    installed('maintenanceLink')
  )

export const savingThrowCapabilityRegistry =
  createSystemCapabilityRegistry<SavingThrowCapabilityAdapter>(
    'saving-throw',
    installed('savingThrow')
  )

export function requireInstalledGameSystemPolicyModule(input: {
  gameSystemId: string
  policyModule: { key: string; contractVersion: number }
}): void {
  const registration = installedPolicySystems.find(
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
