import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const blowgun: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(33),
    label: 'Blowgun',
    description: 'A tube used to propel needles with a sharp breath.',
    category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
    properties: [S.EQUIPMENT_PROPERTY_CODE.MARTIAL, S.EQUIPMENT_PROPERTY_CODE.RANGED, S.EQUIPMENT_PROPERTY_CODE.AMMUNITION, S.EQUIPMENT_PROPERTY_CODE.LOADING],
    modifiers: S.rangedWeaponAbilityModifiers(S.equipId(33)),
    effects: S.rangedFixedDamageWeaponEffects(S.equipId(33), 'PIERCING', 1, 25),
    cost: S.gp(10),
    weight: S.lbs(1),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }

