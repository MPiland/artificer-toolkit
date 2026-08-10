import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const quiver: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(104),
  label: 'Quiver',
  description: 'A quiver can hold up to 20 arrows.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [S.EQUIPMENT_PROPERTY_CODE.CONTAINER],
  cost: S.gp(1),
  weight: S.lbs(1),
  effects: [S.passiveEquipmentClosedRuleEffect(S.equipId(104), 'EQUIPMENT_QUIVER_CAPACITY')],
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
