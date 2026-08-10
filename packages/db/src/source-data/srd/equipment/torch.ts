import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const torch: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(179),
  label: 'Torch',
  description:
    'A torch burns for 1 hour, providing bright light in a 20-foot radius and dim light for an additional 20 feet. If you make a melee attack with a burning torch and hit, it deals 1 fire damage.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  attributes: [S.EQUIPMENT_ATTRIBUTE.STACKABLE],
  cost: S.cp(1),
  weight: S.lbs(1),
  effects: [
    S.lightSourceEffect(S.equipId(179), 20, 20, 1),
    S.fixedMeleeWeaponEffect(S.equipId(179), 'FIRE', 1, 2, 0x220)
  ],
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
