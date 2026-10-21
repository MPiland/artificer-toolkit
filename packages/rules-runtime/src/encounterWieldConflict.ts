import type { CharacterActionCandidate } from '@artificer-toolkit/schema/api/characterActionRules'
import type {
  CharacterRulePolicyInput,
  CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'
import type { EncounterAcceptedWieldConflictDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'

import { armorClassCapabilityRegistry } from './platformEncounterPolicy.js'

type EncounterWieldConflict =
  | { kind: 'NONE' }
  | { kind: 'STOW_SHIELD'; shieldItemInstanceId: string; armorClassDelta: number }

/**
 * Whether an action path asks its submitter about wield conflicts. Only a directly resolved
 * action prompts; unprompted paths (declared, reactive and follow-up attacks) never stow or draw.
 * `handHolds` is how many of the actor's hands the creatures it holds fill, which a draw needs.
 */
export type EncounterWieldConflictAcceptance =
  | {
      kind: 'PROMPTED'
      accepted: EncounterAcceptedWieldConflictDto | null
      handHolds: number
    }
  | { kind: 'UNPROMPTED' }

/** The item an accepted wield conflict stows: the shield, or the held weapon (D152). */
export function encounterStowedItemInstanceId(stow: EncounterAcceptedWieldConflictDto): string {
  return stow.kind === 'STOW_SHIELD' ? stow.shieldItemInstanceId : stow.itemInstanceId
}

/**
 * Whether attacking with the chosen action forces the Character to stow its active shield,
 * shared by the action choices query and action preparation. A carried weapon is treated as
 * drawn and any other held weapon can be swapped without an armor class cost, so only an
 * action wielded in both hands (its authored grip) conflicts with a shield. A STOW_SHIELD result
 * lowers armor class by everything the shield adds in the System's armor class computation, magic
 * bonuses included; the caller must obtain the submitter's explicit acceptance before applying it.
 */
export function evaluateEncounterCharacterActionWieldConflict(input: {
  gameSystemId: string
  candidate: Pick<CharacterActionCandidate, 'equipment'>
  ruleFacts: Pick<CharacterRulePolicyInput, 'armorClassFacts'>
  policyOutput: {
    grantFold: Pick<CharacterRulePolicyOutput['grantFold'], 'activeEquipmentInstanceIds'>
    derivedStats: Pick<CharacterRulePolicyOutput['derivedStats'], 'armorClass'>
  }
}): EncounterWieldConflict {
  const shield =
    input.candidate.equipment?.grip === 'TWO_HANDED'
      ? armorClassCapabilityRegistry.require(input.gameSystemId).countedShield({
          equipment: input.ruleFacts.armorClassFacts?.equipment ?? [],
          activeEquipmentInstanceIds: input.policyOutput.grantFold.activeEquipmentInstanceIds,
          armorClass: input.policyOutput.derivedStats.armorClass
        })
      : null
  return shield === null
    ? { kind: 'NONE' }
    : {
        kind: 'STOW_SHIELD',
        shieldItemInstanceId: shield.itemInstanceId,
        armorClassDelta: -shield.armorClass
      }
}
