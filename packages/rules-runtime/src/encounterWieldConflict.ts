import type { CharacterActionCandidate } from '@artificer-toolkit/schema/api/characterActionRules'
import type {
  CharacterRulePolicyInput,
  CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'
import type { EncounterAcceptedWieldConflictDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'

import {
  resolveDnd5eActiveShield,
  resolveDnd5eShieldArmorClass
} from './systems/dnd5e/characterVitals.js'

export type EncounterWieldConflict =
  | { kind: 'NONE' }
  | { kind: 'STOW_SHIELD'; shieldItemInstanceId: string; armorClassDelta: number }

/**
 * Whether an action path asks its submitter about wield conflicts. Only a directly resolved
 * action prompts; unprompted paths (declared, reactive and follow-up attacks) never stow.
 */
export type EncounterWieldConflictAcceptance =
  | { kind: 'PROMPTED'; accepted: EncounterAcceptedWieldConflictDto | null }
  | { kind: 'UNPROMPTED' }

/**
 * Whether attacking with the chosen action forces the Character to stow its active shield,
 * shared by the action choices query and action preparation. A carried weapon is treated as
 * drawn and any other held weapon can be swapped without an armor class cost, so only an
 * action wielded in both hands (its authored grip) conflicts with a shield. A STOW_SHIELD result
 * lowers armor class by everything the shield adds in the D&D armor class computation, magic
 * bonuses included; the caller must obtain the submitter's explicit acceptance before applying it.
 */
export function evaluateEncounterCharacterActionWieldConflict(input: {
  candidate: Pick<CharacterActionCandidate, 'equipment'>
  ruleFacts: Pick<CharacterRulePolicyInput, 'armorClassFacts'>
  policyOutput: {
    grantFold: Pick<CharacterRulePolicyOutput['grantFold'], 'activeEquipmentInstanceIds'>
    derivedStats: Pick<CharacterRulePolicyOutput['derivedStats'], 'armorClass'>
  }
}): EncounterWieldConflict {
  const shield =
    input.candidate.equipment?.grip === 'TWO_HANDED'
      ? resolveDnd5eActiveShield(
          input.ruleFacts.armorClassFacts?.equipment ?? [],
          input.policyOutput.grantFold.activeEquipmentInstanceIds
        )
      : null
  return shield === null
    ? { kind: 'NONE' }
    : {
        kind: 'STOW_SHIELD',
        shieldItemInstanceId: shield.itemInstanceId,
        armorClassDelta: -resolveDnd5eShieldArmorClass(
          shield,
          input.policyOutput.derivedStats.armorClass
        )
      }
}
