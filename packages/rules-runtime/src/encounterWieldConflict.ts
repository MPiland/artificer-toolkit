import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'
import { EQUIPMENT_PROPERTY_CODE } from '@artificer-toolkit/shared/core'

import { resolveDnd5eActiveShield } from './systems/dnd5e/characterVitals.js'

export type EncounterWieldConflict =
  | { kind: 'NONE' }
  | { kind: 'STOW_SHIELD'; shieldItemInstanceId: string; armorClassDelta: number }

/**
 * Whether attacking with the chosen weapon forces the Character to stow its
 * active shield. A carried weapon is treated as drawn and any other held
 * weapon can be swapped without an armor class cost, so only a weapon wielded
 * in both hands (TWO_HANDED, or VERSATILE with a two-handed grip) conflicts
 * with a shield. A STOW_SHIELD result lowers armor class by the shield's base
 * contribution in the D&D armor class computation; the caller must obtain the
 * player's explicit acceptance before applying it.
 */
export function evaluateEncounterWieldConflict(input: {
  armorClassFacts: CharacterRulePolicyInput['armorClassFacts']
  activeEquipmentInstanceIds: readonly string[]
  weaponProperties: readonly string[]
  grip: 'ONE_HANDED' | 'TWO_HANDED'
}): EncounterWieldConflict {
  const needsBothHands =
    input.weaponProperties.includes(EQUIPMENT_PROPERTY_CODE.TWO_HANDED) ||
    (input.grip === 'TWO_HANDED' &&
      input.weaponProperties.includes(EQUIPMENT_PROPERTY_CODE.VERSATILE))
  const shield = needsBothHands
    ? resolveDnd5eActiveShield(
        input.armorClassFacts?.equipment ?? [],
        input.activeEquipmentInstanceIds
      )
    : null
  return shield === null
    ? { kind: 'NONE' }
    : {
        kind: 'STOW_SHIELD',
        shieldItemInstanceId: shield.itemInstanceId,
        armorClassDelta: -shield.armorClass
      }
}
