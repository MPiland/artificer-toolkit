import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const parchmentOneSheet: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(159),
    label: 'Parchment (one sheet)',
    description: "A sheet of treated animal skin used as a writing surface for documents and maps.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    attributes: [S.EQUIPMENT_ATTRIBUTE.STACKABLE],
    abilities: [],
    cost: S.sp(1),
    weight: S.lbs(0),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
