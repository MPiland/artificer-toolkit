import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const plateArmor: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(49),
  label: 'Plate Armor',
  description:
    'Plate consists of shaped, interlocking metal plates to cover the entire body. A suit of plate includes gauntlets, heavy leather boots, a visored helmet, and thick layers of padding underneath the armor. Buckles and straps distribute the weight over the body.',
  category: S.EQUIPMENT_CATEGORY_CODE.ARMOR,
  properties: [S.EQUIPMENT_PROPERTY_CODE.HEAVY, S.EQUIPMENT_PROPERTY_CODE.METAL],
  armorClass: 18,
  cost: S.gp(1500),
  weight: S.lbs(65),
  modifiers: [
    S.stealthDisadvantageModifier(S.equipId(49)),
    S.heavyArmorStrengthModifier(S.equipId(49), 15, 2)
  ],
  effects: [S.passiveEquipmentClosedRuleEffect(S.equipId(49), 'EQUIPMENT_ARMOR_STRENGTH_15')],
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
