import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const greatsword: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(19),
    label: 'Greatsword',
    description: 'A large two-handed sword.',
    category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
    properties: [S.EQUIPMENT_PROPERTY_CODE.MARTIAL, S.EQUIPMENT_PROPERTY_CODE.MELEE, S.EQUIPMENT_PROPERTY_CODE.HEAVY, S.EQUIPMENT_PROPERTY_CODE.TWO_HANDED],
    abilities: [],
    cost: S.gp(50),
    weight: S.lbs(6),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
