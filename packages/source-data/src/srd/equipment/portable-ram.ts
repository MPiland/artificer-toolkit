import type { EquipmentAuthored } from '@artificer-toolkit/shared'
import * as S from './shared.js'

export const portableRam: EquipmentAuthored = {
  kind: S.SUBJECT.EQUIPMENT,
  id: S.equipId(163),
  label: 'Portable Ram',
  description:
    'You can use a portable ram to break down doors. When doing so, you gain a +4 bonus on the Strength check. One other character can help you use the ram, giving you advantage on this check.',
  category: S.EQUIPMENT_CATEGORY_CODE.ADVENTURING_GEAR,
  properties: [],
  cost: S.gp(4),
  weight: S.lbs(35),
  effects: [S.passiveEquipmentClosedRuleEffect(S.equipId(163), 'EQUIPMENT_PORTABLE_RAM')],
  rarityId: S.RARITY_COMMON,
  userId: S.SRD_USER_ID,
  systemId: S.SRD_SYSTEM_ID
}
