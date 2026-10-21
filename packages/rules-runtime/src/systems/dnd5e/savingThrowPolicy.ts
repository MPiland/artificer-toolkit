import type { SavingThrowCapabilityAdapter } from '../../savingThrowCapability.js'
import { dnd5eConcentrationHolderSaves } from './concentrationPolicy.js'
import { derivedAddedDice } from './d20AddedDiceGraph.js'
import { DND5E_ABILITY_DEFINITION_ID_BY_CODE, DND5E_SYSTEM_ID } from './identity.js'
import { resolveSavingThrowDc } from './savingThrowDc.js'

export const dnd5eSavingThrowCapabilityAdapter: SavingThrowCapabilityAdapter = {
  gameSystemId: DND5E_SYSTEM_ID,
  resolveDc: resolveSavingThrowDc,
  abilityDefinitionId: (abilityCode) => DND5E_ABILITY_DEFINITION_ID_BY_CODE[abilityCode],
  holderSaves: (target) => dnd5eConcentrationHolderSaves(target).savingThrowDefinitions ?? [],
  addedDice: derivedAddedDice
}
