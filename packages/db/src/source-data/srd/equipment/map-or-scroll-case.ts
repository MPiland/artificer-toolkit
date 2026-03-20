import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const mapOrScrollCase: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(114),
    label: 'Map or Scroll Case',
    description: "A cylindrical leather or metal case for protecting rolled maps and scrolls.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [S.EQUIPMENT_PROPERTY_CODE.CONTAINER],
    abilities: [],
    cost: S.gp(1),
    weight: S.lbs(1),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
