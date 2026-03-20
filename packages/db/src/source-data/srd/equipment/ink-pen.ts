import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const inkPen: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(145),
    label: 'Ink Pen',
    description: "A quill or reed pen for writing with ink.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    abilities: [],
    cost: S.cp(2),
    weight: S.lbs(0),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
