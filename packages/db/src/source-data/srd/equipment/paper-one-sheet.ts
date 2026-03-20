import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const paperOneSheet: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(158),
    label: 'Paper (one sheet)',
    description: "A single sheet of fine paper suitable for writing correspondence or recording notes.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    attributes: [S.EQUIPMENT_ATTRIBUTE.STACKABLE],
    abilities: [],
    cost: S.sp(2),
    weight: S.lbs(0),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
