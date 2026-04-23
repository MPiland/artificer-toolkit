import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const viol: EquipmentAuthored = {
    kind: S.SUBJECT.EQUIPMENT,
    id: S.equipId(77),
    label: 'Viol',
    description: "A bowed string instrument held between the legs, ancestor of the modern cello.",
    category: S.EQUIPMENT_CATEGORY_CODE.TOOL,
    properties: [],
    cost: S.gp(30),
    weight: S.lbs(1),
    rarityId: S.RARITY_COMMON,
    userId: S.SRD_USER_ID,
    systemId: S.SRD_SYSTEM_ID,
  }
