import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const holySymbolAmulet: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(96),
    label: 'Holy Symbol: Amulet',
    description: "A pendant bearing the symbol of a deity, worn around the neck as a divine focus.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    abilities: [],
    cost: S.gp(5),
    weight: S.lbs(1),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
