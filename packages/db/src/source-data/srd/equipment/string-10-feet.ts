import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const string10Feet: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(176),
    label: 'String (10 feet)',
    description: "Ten feet of thin but strong string useful for rigging simple traps or tying bundles.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    abilities: [],
    cost: S.cp(1),
    weight: S.lbs(0),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
