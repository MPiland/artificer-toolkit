import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const rope50FtHempen: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(167),
    label: 'Rope (50 ft, hempen)',
    description: "Fifty feet of sturdy hemp rope able to support up to 1,500 pounds.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    cost: S.gp(1),
    weight: S.lbs(10),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
