import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const heavyCrossbow: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(35),
    label: 'Heavy Crossbow',
    description: 'A large, powerful crossbow requiring two hands.',
    category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
    properties: [S.EQUIPMENT_PROPERTY_CODE.MARTIAL, S.EQUIPMENT_PROPERTY_CODE.RANGED, S.EQUIPMENT_PROPERTY_CODE.AMMUNITION, S.EQUIPMENT_PROPERTY_CODE.HEAVY, S.EQUIPMENT_PROPERTY_CODE.LOADING, S.EQUIPMENT_PROPERTY_CODE.TWO_HANDED],
    effects: S.rangedWeaponEffects(S.equipId(35), 'PIERCING', '1d10', 100),
    cost: S.gp(50),
    weight: S.lbs(18),
    rarityId: S.RARITY_COMMON,
    modifiers: S.heavyRangedWeaponModifiers(S.equipId(35)),
  userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }

