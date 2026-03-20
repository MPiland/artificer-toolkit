import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const arcaneFocusStaff: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(90),
    label: 'Arcane Focus: Staff',
    description: "A wooden or metal staff carved with arcane symbols, serving as a spellcasting focus.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    abilities: [],
    cost: S.gp(5),
    weight: S.lbs(4),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
