import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const magnifyingGlass: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(152),
  label: 'Magnifying Glass',
  description: "This lens allows a closer look at small objects. It is also useful as a substitute for flint and steel when starting fires. Lighting a fire with a magnifying glass requires light as bright as sunlight to focus, tinder to ignite, and about 5 minutes for the fire to ignite. A magnifying glass grants advantage on any ability check made to appraise or inspect an item that is small or highly detailed.",
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  cost: S.gp(100),
  weight: S.lbs(0),
  effects: [S.passiveEquipmentClosedRuleEffect(S.equipId(152), 'EQUIPMENT_MAGNIFYING_GLASS')],
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
