import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const lance: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(21),
  label: 'Lance',
  description: "You have disadvantage when you use a lance to attack a target within 5 feet of you. Also, a lance requires two hands to wield when you aren't mounted.",
  category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
  properties: [
    S.EQUIPMENT_PROPERTY_CODE.MARTIAL,
    S.EQUIPMENT_PROPERTY_CODE.MELEE,
    S.EQUIPMENT_PROPERTY_CODE.REACH,
    S.EQUIPMENT_PROPERTY_CODE.SPECIAL
  ],
  modifiers: S.meleeWeaponAbilityModifiers(S.equipId(21)),
  effects: [
    ...S.meleeReachWeaponEffects(S.equipId(21), 'PIERCING', '1d12'),
    S.passiveEquipmentClosedRuleEffect(S.equipId(21), 'EQUIPMENT_LANCE', 2, 0x2e0)
  ],
  cost: S.gp(10),
  weight: S.lbs(6),
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
