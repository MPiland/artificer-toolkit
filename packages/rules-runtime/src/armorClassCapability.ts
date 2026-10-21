import type {
  CharacterRulePolicyInput,
  CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'
import type { EquipmentSlotCode } from '@artificer-toolkit/shared/core'
import type { CompiledEquipment } from '@artificer-toolkit/shared/subjects/compilers'

export type CreatureArmorClassEquipment = {
  id: string
  useState: EquipmentSlotCode
  compiled: CompiledEquipment
}

export type ArmorClassResult =
  | { ok: true; armorClass: number }
  | { ok: false; equipmentId: string; reason: string }

/** System-owned armor class policy the Encounter reads (D107). */
export interface ArmorClassCapabilityAdapter {
  gameSystemId: string
  /**
   * A Creature's armor class from its effective loadout, or null when its ability scores lack one
   * the System's formula reads. Equipment the formula cannot evaluate yields a failure the caller
   * decides on.
   */
  creatureArmorClass(input: {
    abilityScores: Readonly<Record<string, number>>
    naturalArmorBonus: number
    equipment: readonly CreatureArmorClassEquipment[]
  }): ArmorClassResult | null
  /**
   * The one active held shield a Character's armor class counts, with everything it adds (magic
   * bonuses included), or null without one.
   */
  countedShield(input: {
    equipment: NonNullable<CharacterRulePolicyInput['armorClassFacts']>['equipment']
    activeEquipmentInstanceIds: readonly string[]
    armorClass: Pick<CharacterRulePolicyOutput['derivedStats']['armorClass'], 'contributions'>
  }): { itemInstanceId: string; armorClass: number } | null
}
