import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const lightCrossbow: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(11),
    label: 'Light Crossbow',
    description: 'A small crossbow with a hand-cranked mechanism.',
    category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
    properties: [S.EQUIPMENT_PROPERTY_CODE.SIMPLE, S.EQUIPMENT_PROPERTY_CODE.RANGED, S.EQUIPMENT_PROPERTY_CODE.AMMUNITION, S.EQUIPMENT_PROPERTY_CODE.LOADING, S.EQUIPMENT_PROPERTY_CODE.TWO_HANDED],
    modifiers: S.rangedWeaponAbilityModifiers(S.equipId(11)),
    effects: S.rangedWeaponEffects(S.equipId(11), 'PIERCING', '1d8', 80),
    cost: S.gp(25),
    weight: S.lbs(5),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }

