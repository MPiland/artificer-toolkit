import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const piton: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(161),
    label: 'Piton',
    description: "A metal spike driven into stone or wood to anchor a rope for climbing.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    attributes: [S.EQUIPMENT_ATTRIBUTE.STACKABLE],
    abilities: [],
    cost: S.cp(5),
    weight: S.lbs(0.25),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
