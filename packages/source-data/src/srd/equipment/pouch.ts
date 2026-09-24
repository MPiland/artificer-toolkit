import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const pouch: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(115),
  label: 'Pouch',
  description:
    'A cloth or leather pouch can hold up to 20 sling bullets or 50 blowgun needles, among other things. A compartmentalized pouch for holding spell components is called a component pouch (described earlier in this section).',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [S.EQUIPMENT_PROPERTY_CODE.CONTAINER],
  cost: S.sp(5),
  weight: S.lbs(1),
  capacity: { amount: 6, unit: S.MEASUREMENT_UNIT_CODE.POUNDS },
  effects: [S.passiveEquipmentClosedRuleEffect(S.equipId(115), 'EQUIPMENT_POUCH_CAPACITY')],
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
