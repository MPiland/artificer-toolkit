import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const chain10Feet: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(372),
  label: 'Chain (10 feet)',
  description:
    'A chain has 10 hit points. It can be burst with a successful DC 20 Strength check.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  cost: S.gp(5),
  weight: S.lbs(10),
  effects: [S.passiveEquipmentClosedRuleEffect(S.equipId(372), 'EQUIPMENT_CHAIN')],
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
