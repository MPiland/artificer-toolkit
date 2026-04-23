import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const messKit: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(154),
    label: 'Mess Kit',
    description: "A tin box containing a cup, fork, knife, and spoon for eating in the field.",
    category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
    properties: [],
    cost: S.sp(2),
    weight: S.lbs(1),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
