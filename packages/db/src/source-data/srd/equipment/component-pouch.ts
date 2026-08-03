import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const componentPouch: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(135),
  label: 'Component Pouch',
  description: "A component pouch is a small, watertight leather belt pouch that has compartments to hold all the material components and other special items you need to cast your spells, except for those components that have a specific cost (as indicated in a spell's description).",
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  cost: S.gp(25),
  weight: S.lbs(2),
  effects: [S.passiveEquipmentClosedRuleEffect(S.equipId(135), 'EQUIPMENT_COMPONENT_POUCH')],
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
