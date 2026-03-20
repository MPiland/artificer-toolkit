import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const holySymbolReliquary: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(98),
    label: 'Holy Symbol: Reliquary',
    description: "A small box or locket containing sacred relics, used as a holy spellcasting focus.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    abilities: [],
    cost: S.gp(5),
    weight: S.lbs(2),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
