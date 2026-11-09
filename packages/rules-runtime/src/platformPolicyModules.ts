import type { AbilityScoreCapabilityAdapter } from './abilityScoreCapability.js'
import type { ArmorClassCapabilityAdapter } from './armorClassCapability.js'
import type { ActionEconomyCapabilityAdapter } from './actionEconomyCapabilityRegistry.js'
import type { AttackRestrictionCapabilityAdapter } from './attackProfileCapability.js'
import type { CharacterActionCapabilityAdapter } from './characterActionCapabilityDiscovery.js'
import type { CharacterProgressionCapabilityAdapter } from './characterProgressionCapability.js'
import type { CombatPerceptionCapabilityAdapter } from './combatPerceptionCapabilityRegistry.js'
import type { CreatureConditionCapabilityAdapter } from './creatureConditionCapability.js'
import type { EventVocabularyCapabilityAdapter } from './events/encounterEventTable.js'
import type { MaintenanceLinkCapabilityAdapter } from './maintenanceLinkCapability.js'
import type { SavingThrowCapabilityAdapter } from './savingThrowCapability.js'
import type { SpellCastCapabilityAdapter } from './spellCastCandidates.js'
import {
  createRollModeCapabilityRegistry,
  type RollModeCapabilityAdapter
} from './rollModeCapabilityRegistry.js'
import { createSystemCapabilityRegistry } from './systemCapabilityRegistry.js'
import {
  installedAbilityScores,
  installedActionEconomies,
  installedArmorClasses,
  installedAttackRestrictions,
  installedCharacterActions,
  installedCharacterProgressions,
  installedCombatPerceptions,
  installedCreatureConditions,
  installedEventVocabularies,
  installedMaintenanceLinks,
  installedPolicyModules,
  installedRollModes,
  installedSavingThrows,
  installedSpellCasts
} from './systems/installedGameSystems/policy.js'
import { systemCoreCodeRegistry } from './platformSystemCoreCodes.js'
import { requireSceneIlluminationLevels } from '@artificer-toolkit/shared/vtt/sceneCombatPerception'

/**
 * One installed System's Sheet-reachable policy tier (D195). A System leaves out a capability it
 * does not have: `require` then fails closed and `find` skips it.
 */
export interface GameSystemPolicyTier {
  readonly gameSystemId: string
  readonly abilityScore?: AbilityScoreCapabilityAdapter
  readonly actionEconomy?: ActionEconomyCapabilityAdapter
  readonly armorClass?: ArmorClassCapabilityAdapter
  readonly attackRestriction?: AttackRestrictionCapabilityAdapter
  readonly characterAction?: CharacterActionCapabilityAdapter
  readonly characterProgression?: CharacterProgressionCapabilityAdapter
  readonly combatPerception?: CombatPerceptionCapabilityAdapter
  readonly creatureCondition?: CreatureConditionCapabilityAdapter
  readonly eventVocabulary?: EventVocabularyCapabilityAdapter
  readonly maintenanceLink?: MaintenanceLinkCapabilityAdapter
  readonly rollMode?: RollModeCapabilityAdapter
  readonly savingThrow?: SavingThrowCapabilityAdapter
  readonly spellCast?: SpellCastCapabilityAdapter
  readonly policyModules: readonly { readonly key: string; readonly contractVersion: number }[]
}

export const rollModeCapabilityRegistry = /* @__PURE__ */ createRollModeCapabilityRegistry(
  installedRollModes,
  systemCoreCodeRegistry
)

export const combatPerceptionCapabilityRegistry =
  /* @__PURE__ */ createSystemCapabilityRegistry<CombatPerceptionCapabilityAdapter>(
    'combat-perception',
    installedCombatPerceptions,
    ({ illuminationLevels }) => requireSceneIlluminationLevels(illuminationLevels)
  )

export const actionEconomyCapabilityRegistry =
  /* @__PURE__ */ createSystemCapabilityRegistry<ActionEconomyCapabilityAdapter>(
    'action-economy',
    installedActionEconomies
  )

export const armorClassCapabilityRegistry =
  /* @__PURE__ */ createSystemCapabilityRegistry<ArmorClassCapabilityAdapter>(
    'armor-class',
    installedArmorClasses
  )

export const attackRestrictionCapabilityRegistry =
  /* @__PURE__ */ createSystemCapabilityRegistry<AttackRestrictionCapabilityAdapter>(
    'attack-restriction',
    installedAttackRestrictions
  )

export const abilityScoreCapabilityRegistry =
  /* @__PURE__ */ createSystemCapabilityRegistry<AbilityScoreCapabilityAdapter>(
    'ability-score',
    installedAbilityScores
  )

export const characterProgressionCapabilityRegistry =
  /* @__PURE__ */ createSystemCapabilityRegistry<CharacterProgressionCapabilityAdapter>(
    'character-progression',
    installedCharacterProgressions
  )

export const creatureConditionCapabilityRegistry =
  /* @__PURE__ */ createSystemCapabilityRegistry<CreatureConditionCapabilityAdapter>(
    'creature-condition',
    installedCreatureConditions
  )

export const characterActionCapabilityRegistry =
  /* @__PURE__ */ createSystemCapabilityRegistry<CharacterActionCapabilityAdapter>(
    'character-action',
    installedCharacterActions
  )

export const eventVocabularyCapabilityRegistry =
  /* @__PURE__ */ createSystemCapabilityRegistry<EventVocabularyCapabilityAdapter>(
    'event-vocabulary',
    installedEventVocabularies
  )

export const maintenanceLinkCapabilityRegistry =
  /* @__PURE__ */ createSystemCapabilityRegistry<MaintenanceLinkCapabilityAdapter>(
    'maintenance-link',
    installedMaintenanceLinks
  )

export const savingThrowCapabilityRegistry =
  /* @__PURE__ */ createSystemCapabilityRegistry<SavingThrowCapabilityAdapter>(
    'saving-throw',
    installedSavingThrows
  )

export const spellCastCapabilityRegistry =
  /* @__PURE__ */ createSystemCapabilityRegistry<SpellCastCapabilityAdapter>(
    'spell-cast',
    installedSpellCasts
  )

export function requireInstalledGameSystemPolicyModule(input: {
  gameSystemId: string
  policyModule: { key: string; contractVersion: number }
}): void {
  const registration = installedPolicyModules.find(
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
