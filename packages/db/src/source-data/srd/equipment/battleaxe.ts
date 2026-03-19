import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const battleaxe: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(15),
    label: 'Battleaxe',
    description: 'A medium axe usable one- or two-handed.',
    category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
    properties: [S.EQUIPMENT_PROPERTY_CODE.MARTIAL, S.EQUIPMENT_PROPERTY_CODE.MELEE, S.EQUIPMENT_PROPERTY_CODE.VERSATILE],
    abilities: [],
    cost: S.gp(10),
    weight: S.lbs(4),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
