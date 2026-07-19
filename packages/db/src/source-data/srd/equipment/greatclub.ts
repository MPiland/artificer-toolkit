import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const greatclub: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(3),
    label: 'Greatclub',
    description: 'A heavy, two-handed bludgeoning weapon.',
    category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
    properties: [S.EQUIPMENT_PROPERTY_CODE.SIMPLE, S.EQUIPMENT_PROPERTY_CODE.MELEE, S.EQUIPMENT_PROPERTY_CODE.TWO_HANDED],
    modifiers: S.meleeWeaponAbilityModifiers(S.equipId(3)),
    effects: S.meleeWeaponEffects(S.equipId(3), 'BLUDGEONING', '1d8'),
    cost: S.sp(2),
    weight: S.lbs(10),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }

