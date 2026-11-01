import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import { SRD_UNARMED_STRIKE_EQUIPMENT_ID } from '../vocabulary.js'
import * as S from './shared.js'

/**
 * The natural weapon the SRD System gives every Character (`defaults.unarmedStrikeEquipmentId`).
 * It is never carried, bought or listed; the Character rule snapshot adds it outside the inventory.
 */
export const unarmedStrike: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: SRD_UNARMED_STRIKE_EQUIPMENT_ID,
  label: 'Unarmed Strike',
  description:
    'A punch, kick, head-butt or similar forceful blow. On a hit, it deals bludgeoning damage equal to 1 + your Strength modifier.',
  category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
  properties: [S.EQUIPMENT_PROPERTY_CODE.SIMPLE, S.EQUIPMENT_PROPERTY_CODE.MELEE],
  modifiers: S.unarmedStrikeAbilityModifiers(SRD_UNARMED_STRIKE_EQUIPMENT_ID),
  effects: [S.unarmedStrikeEffect(SRD_UNARMED_STRIKE_EQUIPMENT_ID, 'BLUDGEONING', 1)],
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
