import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const warPick: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(30),
    label: 'War Pick',
    description: 'A pick-shaped weapon designed to pierce armor.',
    category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
    properties: [S.EQUIPMENT_PROPERTY_CODE.MARTIAL, S.EQUIPMENT_PROPERTY_CODE.MELEE],
    abilities: [],
    capabilities: S.meleeWeaponCapabilities(S.equipId(30), 'PIERCING', '1d8'),
    cost: S.gp(5),
    weight: S.lbs(2),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
