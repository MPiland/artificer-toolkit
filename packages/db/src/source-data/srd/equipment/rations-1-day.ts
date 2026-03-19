import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const rations1Day: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(166),
    label: 'Rations (1 day)',
    description: "Dry food for one day of travel, including dried meat, hard biscuits, and dried fruit.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    attributes: [S.EQUIPMENT_ATTRIBUTE.STACKABLE],
    abilities: [],
    cost: S.sp(5),
    weight: S.lbs(2),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
