import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const handaxe: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(4),
    label: 'Handaxe',
    description: 'A small axe suitable for one-handed use or throwing.',
    category: S.EQUIPMENT_CATEGORY_CODE.WEAPON,
    properties: [S.EQUIPMENT_PROPERTY_CODE.SIMPLE, S.EQUIPMENT_PROPERTY_CODE.MELEE, S.EQUIPMENT_PROPERTY_CODE.LIGHT, S.EQUIPMENT_PROPERTY_CODE.THROWN],
    abilities: [],
    cost: S.gp(5),
    weight: S.lbs(2),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
