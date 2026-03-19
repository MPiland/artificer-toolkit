import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const greataxe: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(18),
    label: 'Greataxe',
    description: 'A massive two-handed axe.',
    category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
    properties: [S.EQUIPMENT_PROPERTY_CODE.MARTIAL, S.EQUIPMENT_PROPERTY_CODE.MELEE, S.EQUIPMENT_PROPERTY_CODE.HEAVY, S.EQUIPMENT_PROPERTY_CODE.TWO_HANDED],
    abilities: [],
    cost: S.gp(30),
    weight: S.lbs(7),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
