import type { EquipmentVariantAuthored } from '@artificer-toolkit/shared'
import { blowgunNeedles50 } from './blowgun-needles-50.js'
import * as S from './shared.js'

export const blowgunNeedlesPlus2: EquipmentVariantAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(346),
  label: 'Blowgun Needles +2',
  description:
    'These 50 magic blowgun needles grant a +2 bonus to attack and damage rolls made with them.',
  category: S.EQUIPMENT_CATEGORY_CODE.VARIANT,
  parentEquipmentId: blowgunNeedles50.id,
  properties: [S.EQUIPMENT_PROPERTY_CODE.AMMUNITION, S.EQUIPMENT_PROPERTY_CODE.MAGIC],
  rarityId: S.RARITY_RARE,
  maxBonus: 2,
  modifiers: S.magicAmmoModifiers(S.equipId(346), 2),
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
