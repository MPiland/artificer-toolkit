import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const studdedLeatherArmor: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(40),
  label: 'Studded Leather Armor',
  description: "Made from tough but flexible leather, studded leather is reinforced with close-set rivets or spikes.",
  category: S.EQUIPMENT_CATEGORY_CODE.ARMOR,
  properties: [S.EQUIPMENT_PROPERTY_CODE.LIGHT],
  armorClass: 12,
  cost: S.gp(45),
  weight: S.lbs(13),
  rarityId: S.RARITY_COMMON,
  modifiers: S.lightArmorModifiers(S.equipId(40)),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
