import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const chainMail: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(47),
  label: 'Chain Mail',
  description:
    'Made of interlocking metal rings, chain mail includes a layer of quilted fabric worn underneath the mail to prevent chafing and to cushion the impact of blows. The suit includes gauntlets.',
  category: S.EQUIPMENT_CATEGORY_CODE.ARMOR,
  properties: [S.EQUIPMENT_PROPERTY_CODE.HEAVY, S.EQUIPMENT_PROPERTY_CODE.METAL],
  armorClass: 16,
  cost: S.gp(75),
  weight: S.lbs(55),
  modifiers: [
    S.stealthDisadvantageModifier(S.equipId(47)),
    S.heavyArmorStrengthModifier(S.equipId(47), 13, 2)
  ],
  effects: [S.passiveEquipmentClosedRuleEffect(S.equipId(47), 'EQUIPMENT_ARMOR_STRENGTH_13')],
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
