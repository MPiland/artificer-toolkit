import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const lance: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(21),
    label: 'Lance',
    description: 'A long weapon designed for mounted combat.',
    category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
    properties: [S.EQUIPMENT_PROPERTY_CODE.MARTIAL, S.EQUIPMENT_PROPERTY_CODE.MELEE, S.EQUIPMENT_PROPERTY_CODE.REACH, S.EQUIPMENT_PROPERTY_CODE.SPECIAL],
    abilities: [],
    capabilities: S.meleeReachWeaponCapabilities(S.equipId(21), 'PIERCING', '1d12'),
    cost: S.gp(10),
    weight: S.lbs(6),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
